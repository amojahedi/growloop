import "server-only";

import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { z } from "zod";
import { ClaudeCliError } from "./errors";
import { abortedError, createLimiter } from "./limiter";
import { extractPayload, parseEnvelope } from "./parse";
import type { PromptSpec } from "./prompts";
import type { AIStatus } from "./schemas";

/**
 * Bridge to the user's locally installed Claude Code CLI (ADR 004), run in
 * headless print mode. Arguments are always passed as an array (no shell), and
 * the prompt goes over stdin, so user text is never interpreted by a shell or
 * mistaken for a CLI flag. Each call runs in its own empty temp directory and
 * loads only the user's settings, never a project's.
 */

/** Override with `CLAUDE_CLI_PATH` if `claude` is not on the server's PATH. */
const claudeBinary = () => process.env.CLAUDE_CLI_PATH || "claude";

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const KILL_GRACE_MS = 2_000;

/** At most two model calls run at once; a few more may wait. */
const limiter = createLimiter({ concurrency: 2, maxQueued: 4 });

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

export interface RunCommandOptions {
  cwd: string;
  timeoutMs: number;
  /** Written to the process's stdin, which is then closed. */
  input?: string;
  /** Aborting kills the process (e.g. when the browser request is cancelled). */
  signal?: AbortSignal;
}

/** Runs a command without a shell, with a hard timeout, an output size cap and cancellation. */
export function runCommand(command: string, args: readonly string[], options: RunCommandOptions): Promise<CommandResult> {
  const { signal } = options;
  if (signal?.aborted) return Promise.reject(abortedError());

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const terminate = () => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), KILL_GRACE_MS).unref();
    };

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      callback();
    };

    const onAbort = () => {
      terminate();
      finish(() => reject(abortedError()));
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    const timer = setTimeout(() => {
      terminate();
      finish(() => reject(new ClaudeCliError(`Claude Code did not respond within ${options.timeoutMs / 1000}s.`, "timeout")));
    }, options.timeoutMs);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      if (stdout.length > MAX_OUTPUT_BYTES) {
        child.kill("SIGKILL");
        finish(() => reject(new ClaudeCliError("Claude Code produced unexpectedly large output.", "invalid-output")));
      }
    });
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-10_000);
    });

    child.on("error", (error: NodeJS.ErrnoException) => {
      finish(() =>
        reject(
          error.code === "ENOENT"
            ? new ClaudeCliError("Claude Code (`claude`) was not found on your PATH.", "not-installed", { cause: error })
            : new ClaudeCliError(`Could not start Claude Code: ${error.message}`, "process-failed", { cause: error }),
        ),
      );
    });

    child.on("close", (exitCode) => finish(() => resolve({ stdout, stderr, exitCode })));

    child.stdin.on("error", () => {
      // The process exited before reading stdin; the close/error handlers report why.
    });
    child.stdin.end(options.input ?? "");
  });
}

/** Runs `task` in a fresh, private temp directory that is removed afterwards. */
export async function withPrivateDir<T>(task: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "growloop-claude-"));
  try {
    return await task(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export interface AskClaudeOptions<T> extends PromptSpec {
  schema: z.ZodType<T>;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/** CLI flags for a one-shot, tool-less, structured-output request. */
export function buildClaudeArgs({ systemPrompt, jsonSchema }: Pick<PromptSpec, "systemPrompt" | "jsonSchema">): string[] {
  const args = [
    "--print",
    "--output-format",
    "json",
    "--json-schema",
    JSON.stringify(jsonSchema),
    "--system-prompt",
    systemPrompt,
    // No tools: the model only reads the prompt and answers.
    "--tools",
    "",
    "--no-session-persistence",
    // Only the user's own settings (auth, model); never project or local settings.
    "--setting-sources",
    "user",
    "--strict-mcp-config",
    "--disable-slash-commands",
  ];
  const model = process.env.GROWLOOP_CLAUDE_MODEL;
  if (model) args.push("--model", model);
  return args;
}

/** Sends one prompt to the local Claude Code CLI and returns its validated JSON answer. */
export function askClaude<T>({
  prompt,
  schema,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  signal,
  ...spec
}: AskClaudeOptions<T>): Promise<T> {
  return limiter.run(async () => {
    const { stdout, stderr, exitCode } = await withPrivateDir((cwd) =>
      runCommand(claudeBinary(), buildClaudeArgs(spec), { cwd, timeoutMs, input: prompt, signal }),
    );

    let envelope;
    try {
      envelope = parseEnvelope(stdout);
    } catch (error) {
      // A non-zero exit without a JSON result is a process failure (e.g. bad flags, not signed in).
      if (exitCode !== 0) {
        const detail = stderr.trim().split("\n").at(-1) || `exit code ${exitCode}`;
        throw new ClaudeCliError(`Claude Code failed: ${detail}`, "process-failed", { cause: error });
      }
      throw error;
    }
    return extractPayload(envelope, schema);
  }, signal);
}

// --- Availability -------------------------------------------------------------------

const STATUS_TTL_MS = 30_000;
let cachedStatus: { value: AIStatus; expiresAt: number } | undefined;
let statusInFlight: Promise<AIStatus> | undefined;

/**
 * Whether `claude` is installed and signed in. Results are cached briefly and
 * concurrent checks share one run, since each check spawns processes.
 */
export function getClaudeStatus({ fresh = false }: { fresh?: boolean } = {}): Promise<AIStatus> {
  if (statusInFlight) return statusInFlight;
  if (!fresh && cachedStatus && cachedStatus.expiresAt > Date.now()) return Promise.resolve(cachedStatus.value);

  statusInFlight = checkClaudeStatus()
    .then((value) => {
      cachedStatus = { value, expiresAt: Date.now() + STATUS_TTL_MS };
      return value;
    })
    .finally(() => {
      statusInFlight = undefined;
    });
  return statusInFlight;
}

export async function checkClaudeStatus(): Promise<AIStatus> {
  const binary = claudeBinary();
  try {
    return await withPrivateDir(async (cwd) => {
      const version = await runCommand(binary, ["--version"], { cwd, timeoutMs: 10_000 });
      if (version.exitCode !== 0) {
        return { available: false, code: "error", reason: "Claude Code is installed but did not start correctly." };
      }

      // API-key users authenticate via the environment, not a login session.
      if (process.env.ANTHROPIC_API_KEY) return { available: true };

      const auth = await runCommand(binary, ["auth", "status"], { cwd, timeoutMs: 15_000 });
      if (parseLoggedIn(auth.stdout) === false) {
        return {
          available: false,
          code: "not-signed-in",
          reason: "Claude Code is installed but not signed in. Run `claude` once to log in.",
        };
      }
      return { available: true };
    });
  } catch (error) {
    if (error instanceof ClaudeCliError && error.code === "not-installed") {
      return {
        available: false,
        code: "not-installed",
        reason: "Claude Code isn't installed. Install it and sign in to enable AI features.",
      };
    }
    return { available: false, code: "error", reason: "Couldn't reach Claude Code." };
  }
}

/** Reads `loggedIn` from `claude auth status` JSON; `undefined` when the output isn't recognisable. */
export function parseLoggedIn(stdout: string): boolean | undefined {
  try {
    const value: unknown = JSON.parse(stdout);
    if (typeof value === "object" && value !== null && "loggedIn" in value && typeof value.loggedIn === "boolean") {
      return value.loggedIn;
    }
  } catch {
    // Older CLI versions print plain text; fall through.
  }
  return undefined;
}
