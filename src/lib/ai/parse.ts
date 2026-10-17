import { z } from "zod";
import { ClaudeCliError } from "./errors";

/**
 * Parsing for `claude -p --output-format json`. The CLI prints one JSON
 * "result" envelope; with `--json-schema` the validated payload is in
 * `structured_output`, otherwise the model's text answer is in `result`.
 */

const envelopeSchema = z.looseObject({
  type: z.literal("result"),
  subtype: z.string(),
  is_error: z.boolean(),
  result: z.string().optional(),
  structured_output: z.unknown().optional(),
});
export type ClaudeEnvelope = z.infer<typeof envelopeSchema>;

/** Parses the CLI's stdout into a result envelope. */
export function parseEnvelope(stdout: string): ClaudeEnvelope {
  // Expect a single JSON document; fall back to the last JSON line in case anything else was printed first.
  const candidates = [stdout.trim(), ...stdout.trim().split("\n").reverse()];
  for (const candidate of candidates) {
    const json = tryParseJson(candidate);
    const envelope = envelopeSchema.safeParse(json);
    if (envelope.success) return envelope.data;
  }
  throw new ClaudeCliError("Claude Code returned output that is not a JSON result.", "invalid-output");
}

/** Extracts and validates the model's JSON payload from an envelope. */
export function extractPayload<T>(envelope: ClaudeEnvelope, schema: z.ZodType<T>): T {
  if (envelope.is_error || envelope.subtype !== "success") {
    const detail = envelope.result?.trim();
    throw new ClaudeCliError(
      detail ? `Claude Code reported an error: ${detail}` : `Claude Code did not finish (${envelope.subtype}).`,
      "model-error",
    );
  }

  const payload = envelope.structured_output ?? (envelope.result ? parseJsonText(envelope.result) : undefined);
  if (payload === undefined) {
    throw new ClaudeCliError("Claude's answer did not contain JSON.", "invalid-output");
  }

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ClaudeCliError(`Claude's answer had an unexpected shape: ${z.prettifyError(result.error)}`, "invalid-output", {
      cause: result.error,
    });
  }
  return result.data;
}

/**
 * Reads JSON from a model's text answer, tolerating Markdown code fences and
 * prose around a single top-level object. Returns `undefined` if none is found.
 */
export function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed)?.[1];
  for (const candidate of [trimmed, fenced]) {
    if (candidate === undefined) continue;
    const parsed = tryParseJson(candidate.trim());
    if (parsed !== undefined) return parsed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  return start !== -1 && end > start ? tryParseJson(trimmed.slice(start, end + 1)) : undefined;
}

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
