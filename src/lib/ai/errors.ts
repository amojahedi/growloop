import type { AIErrorCode } from "./schemas";

/** A failure talking to the local Claude Code CLI, with a code the API maps to an HTTP status. */
export class ClaudeCliError extends Error {
  override name = "ClaudeCliError";

  constructor(
    message: string,
    readonly code: Extract<
      AIErrorCode,
      "not-installed" | "timeout" | "process-failed" | "model-error" | "invalid-output" | "busy" | "aborted"
    >,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
