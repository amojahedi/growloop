// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The real SDK with only `fetch` stubbed: checks what actually goes over the
 * wire. Nothing leaves the process.
 */

const KEY = "sk-ant-api03-wire-test-SECRET";

type Call = { url: string; headers: Headers; body: string };
const calls: Call[] = [];
let respond: (call: Call) => Response;

const fetchStub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
  const request = new Request(input, init);
  const call = { url: request.url, headers: request.headers, body: init?.body ? String(init.body) : "" };
  calls.push(call);
  return respond(call);
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "request-id": "req_test" } });

const answer = (payload: unknown) =>
  json({
    id: "msg_1",
    type: "message",
    role: "assistant",
    model: "claude-opus-5-5",
    content: [{ type: "text", text: JSON.stringify(payload) }],
    stop_reason: "end_turn",
    stop_details: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  });

const { ownKeyProvider, validateApiKey } = await import("./own-key");
const { forgetApiKey, saveApiKey } = await import("./key-storage");

beforeEach(() => {
  calls.length = 0;
  fetchStub.mockClear();
  // The SDK picks up the global fetch when a client is created.
  vi.stubGlobal("fetch", fetchStub);
  localStorage.clear();
  forgetApiKey();
  saveApiKey(KEY);
});

afterEach(() => vi.unstubAllGlobals());

function expectOnlyAnthropicWithKeyInHeader() {
  expect(calls.length).toBeGreaterThan(0);
  for (const call of calls) {
    expect(new URL(call.url).origin).toBe("https://api.anthropic.com");
    expect(call.headers.get("x-api-key")).toBe(KEY);
    expect(call.headers.get("anthropic-dangerous-direct-browser-access")).toBe("true");
    expect(call.url).not.toContain(KEY);
    expect(call.body).not.toContain(KEY);
    // The key travels only in x-api-key.
    for (const [name, value] of call.headers) if (name !== "x-api-key") expect(value).not.toContain(KEY);
  }
}

describe("own-key provider on the wire", () => {
  it("contacts only api.anthropic.com, with the key only in x-api-key", async () => {
    respond = () => answer({ recommendations: [{ title: "Inspired", author: "Marty Cagan", type: "book", why: "Discovery." }] });

    const result = await ownKeyProvider.recommend({ context: { kind: "skill", name: "Discovery" } });

    expect(result.recommendations).toHaveLength(1);
    expectOnlyAnthropicWithKeyInHeader();
    expect(calls[0].url).toBe("https://api.anthropic.com/v1/messages?beta=true");
    expect(calls[0].headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    const body = JSON.parse(calls[0].body);
    expect(body).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", output_config: { effort: "low" } });
  });

  it("turns a 401 into key-rejected, without the key in the error", async () => {
    respond = () => json({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }, 401);

    const error = await ownKeyProvider.recommend({ context: { kind: "skill", name: "Discovery" } }).catch((caught: unknown) => caught);

    expect(error).toMatchObject({ code: "key-rejected", message: "Your Claude key was rejected. Check it in Settings." });
    expect(JSON.stringify(error)).not.toContain(KEY);
    expect(String((error as Error).stack)).not.toContain(KEY);
    // 401s are not retried.
    expect(calls).toHaveLength(1);
    expectOnlyAnthropicWithKeyInHeader();
  });

  it("validates a key by listing models", async () => {
    respond = () => json({ data: [], has_more: false, first_id: null, last_id: null });

    await validateApiKey(KEY);

    expect(calls).toHaveLength(1);
    expect(new URL(calls[0].url).pathname).toBe("/v1/models");
    expect(new URL(calls[0].url).searchParams.get("limit")).toBe("1");
    expectOnlyAnthropicWithKeyInHeader();
  });
});
