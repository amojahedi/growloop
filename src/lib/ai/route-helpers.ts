import "server-only";

import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { ClaudeCliError } from "./errors";
import type { AIErrorCode, AIErrorResponse } from "./schemas";

/** Helpers shared by the `/api/ai/*` route handlers. */

const STATUS_BY_CODE: Record<AIErrorCode, number> = {
  "demo-mode": 403,
  forbidden: 403,
  "bad-request": 400,
  "not-installed": 503,
  timeout: 504,
  "process-failed": 502,
  "model-error": 502,
  "invalid-output": 502,
};

export function errorResponse(code: AIErrorCode, error: string): Response {
  return Response.json({ error, code } satisfies AIErrorResponse, { status: STATUS_BY_CODE[code] });
}

/**
 * Rejects requests the AI endpoints should never serve: any request on the
 * hosted demo, and cross-site browser requests (another website must not be
 * able to spend the user's Claude subscription through their local server).
 * Requiring a JSON content type also forces a CORS preflight, which fails.
 */
export function rejectDisallowedRequest(request: Request): Response | null {
  if (isDemoMode) {
    return errorResponse("demo-mode", "AI features run on your own machine. Clone the repo and run it locally to enable them.");
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return errorResponse("forbidden", "Cross-site requests are not allowed.");
  }
  if (request.method === "POST" && !request.headers.get("content-type")?.includes("application/json")) {
    return errorResponse("bad-request", "Expected a JSON request body.");
  }
  return null;
}

/** Parses and validates a JSON body. Returns the data, or an error response. */
export async function readJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T; response?: never } | { data?: never; response: Response }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { response: errorResponse("bad-request", "The request body is not valid JSON.") };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    return { response: errorResponse("bad-request", z.prettifyError(result.error)) };
  }
  return { data: result.data };
}

/** Maps a failure from the CLI bridge to an API response. */
export function aiFailureResponse(error: unknown): Response {
  if (error instanceof ClaudeCliError) return errorResponse(error.code, error.message);
  console.error("[growloop] Unexpected AI error", error);
  return errorResponse("process-failed", "Something went wrong while asking Claude.");
}
