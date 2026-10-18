import type { AIErrorCode } from "./schemas";

/**
 * Codes for failures seen by the browser: the server's codes plus the ones
 * that only arise client-side (network, direct Claude API calls, AI off).
 */
export type AIClientErrorCode =
  | AIErrorCode
  | "network"
  | "key-rejected"
  | "rate-limited"
  | "refusal"
  | "truncated"
  | "not-implemented"
  | "off";

/** A failed AI request, with a message that is safe to show to the user. */
export class AIRequestError extends Error {
  override name = "AIRequestError";

  constructor(
    message: string,
    readonly code: AIClientErrorCode,
  ) {
    super(message);
  }
}
