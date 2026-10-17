import { beforeEach, describe, expect, it, vi } from "vitest";
import { ClaudeCliError } from "@/lib/ai/errors";

const env = vi.hoisted(() => ({ demo: false }));

vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/lib/ai/claude-cli", () => ({ askClaude: vi.fn(), getClaudeStatus: vi.fn() }));
vi.mock("@/lib/env", () => ({
  get isDemoMode() {
    return env.demo;
  },
}));

const cli = vi.mocked(await import("@/lib/ai/claude-cli"));
const status = await import("./status/route");
const recommend = await import("./recommend/route");
const refine = await import("./refine-summary/route");

const json = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost:3000/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const recommendBody = { context: { kind: "skill", name: "Roadmapping" }, existingTitles: ["Inspired"] };
const refineBody = { material: { title: "Inspired" }, summary: "Empowered teams solve problems." };

beforeEach(() => {
  env.demo = false;
  cli.askClaude.mockReset();
  cli.getClaudeStatus.mockReset();
});

describe("GET /api/ai/status", () => {
  it("reports the CLI status", async () => {
    cli.getClaudeStatus.mockResolvedValue({ available: true });

    const response = await status.GET(new Request("http://localhost:3000/api/ai/status"));
    expect(await response.json()).toEqual({ available: true });
  });

  it("is disabled in demo mode without touching the CLI", async () => {
    env.demo = true;

    const response = await status.GET(new Request("http://localhost:3000/api/ai/status"));
    expect(await response.json()).toMatchObject({ available: false, code: "demo-mode" });
    expect(cli.getClaudeStatus).not.toHaveBeenCalled();
  });
});

describe("POST /api/ai/recommend", () => {
  it("returns validated recommendations", async () => {
    const result = { recommendations: [{ title: "Product Roadmaps Relaunched", author: "C. Todd Lombardo", type: "book", why: "…" }] };
    cli.askClaude.mockResolvedValue(result);

    const response = await recommend.POST(json(recommendBody));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(result);

    const call = cli.askClaude.mock.calls[0][0];
    expect(call.prompt).toContain("Roadmapping");
    expect(call.prompt).toContain("- Inspired");
  });

  it("rejects invalid bodies", async () => {

    const invalid = await recommend.POST(json({ context: { kind: "team" } }));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({ code: "bad-request" });

    expect((await recommend.POST(json("{oops"))).status).toBe(400);
    expect(cli.askClaude).not.toHaveBeenCalled();
  });

  it("rejects cross-site and non-JSON requests", async () => {

    expect((await recommend.POST(json(recommendBody, { "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect((await recommend.POST(json(recommendBody, { "content-type": "text/plain" }))).status).toBe(400);
    expect(cli.askClaude).not.toHaveBeenCalled();
  });

  it("maps CLI failures to HTTP errors", async () => {
    cli.askClaude.mockRejectedValue(new ClaudeCliError("Claude Code (`claude`) was not found on your PATH.", "not-installed"));

    const response = await recommend.POST(json(recommendBody));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "not-installed", error: expect.stringContaining("not found") });
  });

  it("is disabled in demo mode", async () => {
    env.demo = true;

    const response = await recommend.POST(json(recommendBody));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "demo-mode" });
  });
});

describe("POST /api/ai/refine-summary", () => {
  it("returns feedback", async () => {
    const feedback = { strengths: ["Clear"], gaps: [], suggestions: [] };
    cli.askClaude.mockResolvedValue(feedback);

    const response = await refine.POST(json(refineBody));
    expect(await response.json()).toEqual(feedback);
    expect(cli.askClaude.mock.calls[0][0].prompt).toContain("Empowered teams solve problems.");
  });

  it("requires a summary", async () => {
    const response = await refine.POST(json({ ...refineBody, summary: "   " }));

    expect(response.status).toBe(400);
    expect((await response.json()).error).toMatch(/Write a summary first/);
  });

  it("maps timeouts to 504", async () => {
    cli.askClaude.mockRejectedValue(new ClaudeCliError("Claude Code did not respond within 120s.", "timeout"));

    expect((await refine.POST(json(refineBody))).status).toBe(504);
  });
});
