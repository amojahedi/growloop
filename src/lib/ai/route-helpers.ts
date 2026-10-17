import "server-only";

import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { ClaudeCliError } from "./errors";
import type { AIErrorCode, AIErrorResponse } from "./schemas";

/**
 * Guards shared by the `/api/ai/*` route handlers.
 *
 * The AI endpoints spend the user's Claude subscription by spawning a local
 * process, so access is denied by default. They only answer when:
 *  - the app is not in demo mode, and
 *  - the request reached the server through a loopback host name (this also
 *    defeats DNS-rebinding and LAN access), and
 *  - for POSTs, the browser's Origin is this same server and the body is JSON.
 */

const STATUS_BY_CODE: Record<AIErrorCode, number> = {
  "demo-mode": 403,
  forbidden: 403,
  "bad-request": 400,
  "unsupported-media-type": 415,
  "too-large": 413,
  busy: 429,
  aborted: 499,
  "not-installed": 503,
  timeout: 504,
  "process-failed": 502,
  "model-error": 502,
  "invalid-output": 502,
};

const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]"]);
const MAX_BODY_BYTES = 256 * 1024;

export function errorResponse(code: AIErrorCode, error: string): Response {
  return Response.json({ error, code } satisfies AIErrorResponse, { status: STATUS_BY_CODE[code] });
}

/** True when a Host header (with optional port) names this machine's loopback interface. */
export function isLoopbackHost(host: string | null): boolean {
  if (!host) return false;
  try {
    return LOOPBACK_HOSTNAMES.has(new URL(`http://${host}`).hostname);
  } catch {
    return false;
  }
}

/** True when the request's Origin header is this server (same host and port). */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return (url.protocol === "http:" || url.protocol === "https:") && url.host === host;
  } catch {
    return false;
  }
}

/** Exact MIME essence match, so "application/jsonp" or "text/plain" never pass. */
export function isJsonContentType(contentType: string | null): boolean {
  return contentType?.split(";")[0].trim().toLowerCase() === "application/json";
}

export interface AccessDenial {
  code: Extract<AIErrorCode, "demo-mode" | "forbidden">;
  error: string;
}

/** Server-side gate for every AI endpoint. Returns why access is denied, or null. */
export function aiAccessDenial(request: Request): AccessDenial | null {
  if (isDemoMode) {
    return {
      code: "demo-mode",
      error: "AI features run on your own machine with Claude Code. Run Growloop locally to enable them.",
    };
  }
  if (!isLoopbackHost(request.headers.get("host"))) {
    return {
      code: "forbidden",
      error: "AI features are only available when Growloop runs on your own machine at localhost.",
    };
  }
  return null;
}

/** Full check for POST endpoints. Returns an error response, or null to proceed. */
export function rejectDisallowedRequest(request: Request): Response | null {
  const denial = aiAccessDenial(request);
  if (denial) return errorResponse(denial.code, denial.error);
  if (!isSameOrigin(request)) {
    return errorResponse("forbidden", "Requests must come from the Growloop app itself.");
  }
  if (!isJsonContentType(request.headers.get("content-type"))) {
    return errorResponse("unsupported-media-type", "Expected a JSON request body.");
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return errorResponse("too-large", "The request is too large.");
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
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return { response: errorResponse("too-large", "The request is too large.") };
    body = JSON.parse(text);
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
