import { EventEmitter } from "node:events";
import os from "node:os";
import { PassThrough, Writable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { askClaude, checkClaudeStatus, parseLoggedIn } from "./claude-cli";
import { summaryFeedbackSchema } from "./schemas";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
const { spawn } = await import("node:child_process");
const spawnMock = vi.mocked(spawn);

interface FakeRun {
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  error?: NodeJS.ErrnoException;
  /** Never exits (for timeout tests). */
  hang?: boolean;
}

/** A stand-in for a spawned child process that replays canned output. */
function fakeProcess({ stdout = "", stderr = "", exitCode = 0, error, hang = false }: FakeRun) {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
    stdin: new Writable({
      write(chunk, _encoding, callback) {
        child.input += String(chunk);
        callback();
      },
    }),
    input: "",
    kill: vi.fn(),
  });

  setTimeout(() => {
    if (error) return void child.emit("error", error);
    if (hang) return;
    child.stdout.write(stdout);
    child.stderr.write(stderr);
    setTimeout(() => child.emit("close", exitCode), 0);
  }, 0);

  return child;
}

function queueRuns(...runs: FakeRun[]) {
  const children: ReturnType<typeof fakeProcess>[] = [];
  for (const run of runs) {
    spawnMock.mockImplementationOnce((() => {
      const child = fakeProcess(run);
      children.push(child);
      return child;
    }) as unknown as typeof spawn);
  }
  return children;
}

const resultEnvelope = (fields: Record<string, unknown>) =>
  JSON.stringify({ type: "result", subtype: "success", is_error: false, ...fields });

const feedback = { strengths: ["Concise"], gaps: [], suggestions: ["Add one example"] };
const spec = { systemPrompt: "SYSTEM", prompt: "--summary that starts with dashes", jsonSchema: { type: "object" } };

beforeEach(() => {
  spawnMock.mockReset();
  vi.stubEnv("CLAUDE_CLI_PATH", "");
  vi.stubEnv("GROWLOOP_CLAUDE_MODEL", "");
  vi.stubEnv("ANTHROPIC_API_KEY", "");
});

describe("askClaude", () => {
  it("runs claude headless with an args array and sends the prompt on stdin", async () => {
    const children = queueRuns({ stdout: resultEnvelope({ structured_output: feedback }) });

    await expect(askClaude({ ...spec, schema: summaryFeedbackSchema })).resolves.toEqual(feedback);

    const [command, args, options] = spawnMock.mock.calls[0];
    expect(command).toBe("claude");
    expect(args).toEqual([
      "--print",
      "--output-format",
      "json",
      "--json-schema",
      '{"type":"object"}',
      "--system-prompt",
      "SYSTEM",
      "--tools",
      "",
      "--no-session-persistence",
      "--strict-mcp-config",
      "--disable-slash-commands",
    ]);
    expect(options).toMatchObject({ cwd: os.tmpdir() });
    expect(options).not.toHaveProperty("shell");
    expect(children[0].input).toBe("--summary that starts with dashes");
  });

  it("honours the binary path and model overrides", async () => {
    vi.stubEnv("CLAUDE_CLI_PATH", "/opt/claude/bin/claude");
    vi.stubEnv("GROWLOOP_CLAUDE_MODEL", "sonnet");
    queueRuns({ stdout: resultEnvelope({ structured_output: feedback }) });

    await askClaude({ ...spec, schema: summaryFeedbackSchema });

    const [command, args] = spawnMock.mock.calls[0];
    expect(command).toBe("/opt/claude/bin/claude");
    expect(args?.slice(-2)).toEqual(["--model", "sonnet"]);
  });

  it("reports a missing CLI", async () => {
    queueRuns({ error: Object.assign(new Error("spawn claude ENOENT"), { code: "ENOENT" }) });
    await expect(askClaude({ ...spec, schema: summaryFeedbackSchema })).rejects.toMatchObject({ code: "not-installed" });
  });

  it("reports a failed process with its last stderr line", async () => {
    queueRuns({ stderr: "Starting...\nInvalid API key · Please run /login\n", exitCode: 1 });
    await expect(askClaude({ ...spec, schema: summaryFeedbackSchema })).rejects.toMatchObject({
      code: "process-failed",
      message: expect.stringContaining("Invalid API key"),
    });
  });

  it("validates the model's answer", async () => {
    queueRuns({ stdout: resultEnvelope({ structured_output: { strengths: "not a list" } }) });
    await expect(askClaude({ ...spec, schema: summaryFeedbackSchema })).rejects.toMatchObject({ code: "invalid-output" });
  });

  it("times out and kills a hung process", async () => {
    const children = queueRuns({ hang: true });
    await expect(askClaude({ ...spec, schema: summaryFeedbackSchema, timeoutMs: 20 })).rejects.toMatchObject({
      code: "timeout",
    });
    expect(children[0].kill).toHaveBeenCalledWith("SIGTERM");
  });
});

describe("checkClaudeStatus", () => {
  it("is available when installed and signed in", async () => {
    queueRuns({ stdout: "2.1.283 (Claude Code)" }, { stdout: JSON.stringify({ loggedIn: true, email: "x@y.z" }) });
    await expect(checkClaudeStatus()).resolves.toEqual({ available: true });
    expect(spawnMock.mock.calls.map(([, args]) => args)).toEqual([["--version"], ["auth", "status"]]);
  });

  it("explains when the user is not signed in", async () => {
    queueRuns({ stdout: "2.1.283" }, { stdout: JSON.stringify({ loggedIn: false }), exitCode: 1 });
    await expect(checkClaudeStatus()).resolves.toMatchObject({ available: false, code: "not-signed-in" });
  });

  it("skips the login check for API-key users", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "sk-test");
    queueRuns({ stdout: "2.1.283" });
    await expect(checkClaudeStatus()).resolves.toEqual({ available: true });
    expect(spawnMock).toHaveBeenCalledTimes(1);
  });

  it("explains when the CLI is missing", async () => {
    queueRuns({ error: Object.assign(new Error("ENOENT"), { code: "ENOENT" }) });
    await expect(checkClaudeStatus()).resolves.toMatchObject({ available: false, code: "not-installed" });
  });

  it("parses auth status output defensively", () => {
    expect(parseLoggedIn('{"loggedIn":true}')).toBe(true);
    expect(parseLoggedIn('{"loggedIn":false}')).toBe(false);
    expect(parseLoggedIn("Logged in as someone")).toBeUndefined();
  });
});
