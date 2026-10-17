// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn<typeof fetch>();

const respond = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

/** Fresh module per test: the hook shares one status request per page load. */
async function loadHook() {
  vi.resetModules();
  return (await import("./use-ai")).useAI;
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

describe("useAI", () => {
  it("reports availability", async () => {
    fetchMock.mockImplementation(() => respond({ available: false, code: "not-installed", reason: "Install Claude Code" }));
    const useAI = await loadHook();
    const { result } = renderHook(() => useAI());

    expect(result.current.status).toEqual({ state: "checking" });
    await waitFor(() =>
      expect(result.current.status).toEqual({ state: "unavailable", code: "not-installed", reason: "Install Claude Code" }),
    );
    expect(fetchMock).toHaveBeenCalledWith("/api/ai/status", { cache: "no-store" });
  });

  it("tracks loading, data and errors for a call", async () => {
    const feedback = { strengths: ["Clear"], gaps: [], suggestions: [] };
    fetchMock.mockImplementation((input) =>
      String(input).endsWith("/status") ? respond({ available: true }) : respond(feedback),
    );
    const useAI = await loadHook();
    const { result } = renderHook(() => useAI());
    await waitFor(() => expect(result.current.status.state).toBe("available"));

    let pending!: Promise<unknown>;
    act(() => {
      pending = result.current.refineSummary.run({ material: { title: "Inspired" }, summary: "My summary" });
    });
    expect(result.current.refineSummary.loading).toBe(true);

    await act(async () => {
      await expect(pending).resolves.toEqual(feedback);
    });
    expect(result.current.refineSummary).toMatchObject({ loading: false, data: feedback, error: undefined });

    const [, init] = fetchMock.mock.calls.at(-1)!;
    expect(init).toMatchObject({ method: "POST", headers: { "Content-Type": "application/json" } });
  });

  it("exposes API errors", async () => {
    fetchMock.mockImplementation((input) =>
      String(input).endsWith("/status")
        ? respond({ available: true })
        : respond({ error: "Claude Code did not respond within 120s.", code: "timeout" }, 504),
    );
    const useAI = await loadHook();
    const { result } = renderHook(() => useAI());

    await act(async () => {
      await result.current.recommend.run({ context: { kind: "skill", name: "Roadmapping" } });
    });

    expect(result.current.recommend.data).toBeUndefined();
    expect(result.current.recommend.error).toMatchObject({ code: "timeout", message: expect.stringContaining("120s") });
  });
});
