import { describe, expect, it } from "vitest";
import { ClaudeCliError } from "./errors";
import { extractPayload, parseEnvelope, parseJsonText } from "./parse";
import { recommendationsSchema, summaryFeedbackSchema } from "./schemas";

/** Shape of `claude -p --output-format json` output (trimmed to the fields we use). */
const envelope = (overrides: Record<string, unknown> = {}) =>
  JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    duration_ms: 2849,
    num_turns: 1,
    session_id: "a8a90c17-e8f7-4d4e-a0f5-ae49d25b0d47",
    total_cost_usd: 0.0157,
    ...overrides,
  });

const feedback = { strengths: ["Clear"], gaps: ["Misses opportunity solution trees"], suggestions: ["Add an example"] };

describe("parseEnvelope", () => {
  it("parses the CLI's JSON result", () => {
    expect(parseEnvelope(envelope({ result: "hi" }))).toMatchObject({ type: "result", subtype: "success", result: "hi" });
  });

  it("finds the result line when other output precedes it", () => {
    expect(parseEnvelope(`warning: something\n${envelope({ result: "hi" })}\n`).result).toBe("hi");
  });

  it("rejects non-result output", () => {
    expect(() => parseEnvelope("Not logged in")).toThrow(ClaudeCliError);
    expect(() => parseEnvelope(JSON.stringify({ type: "assistant" }))).toThrow(/not a JSON result/);
  });
});

describe("extractPayload", () => {
  it("prefers structured_output from --json-schema", () => {
    const parsed = parseEnvelope(envelope({ structured_output: feedback, result: "ignored" }));
    expect(extractPayload(parsed, summaryFeedbackSchema)).toEqual(feedback);
  });

  it("falls back to JSON in the text result", () => {
    const parsed = parseEnvelope(envelope({ result: "```json\n" + JSON.stringify(feedback) + "\n```" }));
    expect(extractPayload(parsed, summaryFeedbackSchema)).toEqual(feedback);
  });

  it("normalises absent optional fields and caps recommendations at five", () => {
    const item = { title: "Inspired", author: "Marty Cagan", type: "book", why: "Foundational.", url: null, estimatedHours: "" };
    const parsed = parseEnvelope(envelope({ structured_output: { recommendations: Array(7).fill(item) } }));
    const { recommendations } = extractPayload(parsed, recommendationsSchema);

    expect(recommendations).toHaveLength(5);
    expect(recommendations[0]).toEqual({ title: "Inspired", author: "Marty Cagan", type: "book", why: "Foundational." });
  });

  it("rejects payloads that do not match the schema", () => {
    const bad = { recommendations: [{ title: "X", author: "Y", type: "video", why: "Z" }] };
    const parsed = parseEnvelope(envelope({ structured_output: bad }));

    expect(() => extractPayload(parsed, recommendationsSchema)).toThrow(
      expect.objectContaining({ code: "invalid-output", message: expect.stringMatching(/unexpected shape/) }),
    );
  });

  it("rejects non-http URLs", () => {
    const bad = { recommendations: [{ title: "X", author: "Y", type: "book", why: "Z", url: "javascript:alert(1)" }] };
    expect(() => extractPayload(parseEnvelope(envelope({ structured_output: bad })), recommendationsSchema)).toThrow(
      ClaudeCliError,
    );
  });

  it("surfaces errors reported by the CLI", () => {
    const parsed = parseEnvelope(envelope({ is_error: true, subtype: "success", result: "Credit balance is too low" }));
    expect(() => extractPayload(parsed, summaryFeedbackSchema)).toThrow(
      expect.objectContaining({ code: "model-error", message: expect.stringMatching(/Credit balance/) }),
    );

    const maxTurns = parseEnvelope(envelope({ subtype: "error_max_turns" }));
    expect(() => extractPayload(maxTurns, summaryFeedbackSchema)).toThrow(/error_max_turns/);
  });

  it("fails clearly when there is no JSON at all", () => {
    const parsed = parseEnvelope(envelope({ result: "Sorry, I can't help with that." }));
    expect(() => extractPayload(parsed, summaryFeedbackSchema)).toThrow(/did not contain JSON/);
  });
});

describe("parseJsonText", () => {
  it("handles plain JSON, fenced JSON and JSON wrapped in prose", () => {
    expect(parseJsonText('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonText('```\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonText('Here you go: {"a":{"b":2}} Hope that helps!')).toEqual({ a: { b: 2 } });
    expect(parseJsonText("no json here")).toBeUndefined();
  });
});
