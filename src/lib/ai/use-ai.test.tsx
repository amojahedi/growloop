// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn<typeof fetch>();

/** The Claude SDK is mocked: no test makes a real API call. */
const sdk = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@anthropic-ai/sdk")>();
  class FakeAnthropic {
    beta = { messages: { create: sdk.create } };
  }
  return { ...actual, default: FakeAnthropic, Anthropic: FakeAnthropic };
});

const respond = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));

/** Fresh module per test: the hook shares one status request per page load. */
async function loadHook() {
  vi.resetModules();
  return (await import("./use-ai")).useAI;
}

beforeEach(() => {
  fetchMock.mockReset();
  sdk.create.mockReset();
  localStorage.clear();
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
    await waitFor(() => expect(result.current.provider).toBe("local"));

    await act(async () => {
      await result.current.recommend.run({ context: { kind: "skill", name: "Roadmapping" } });
    });

    expect(result.current.recommend.data).toBeUndefined();
    expect(result.current.recommend.error).toMatchObject({ code: "timeout", message: expect.stringContaining("120s") });
  });
});

describe("useAI provider selection", () => {
  it("uses the visitor's own key first, without asking the local server", async () => {
    localStorage.setItem("growloop:claude-api-key", "sk-ant-api03-test");
    const feedback = { strengths: ["Clear"], gaps: [], suggestions: [] };
    sdk.create.mockResolvedValue({ content: [{ type: "text", text: JSON.stringify(feedback) }], stop_reason: "end_turn" });
    fetchMock.mockImplementation(() => respond({ available: true }));
    const useAI = await loadHook();
    const { result } = renderHook(() => useAI());

    await waitFor(() => expect(result.current.provider).toBe("own-key"));
    expect(result.current.status).toEqual({ state: "available" });

    await act(async () => {
      await result.current.refineSummary.run({ material: { title: "Inspired" }, summary: "My summary" });
    });
    expect(result.current.refineSummary.data).toEqual(feedback);
    expect(sdk.create).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls.map(([input]) => String(input)).filter((url) => !url.startsWith("/api/ai/status"))).toEqual([]);
  });

  it("uses local Claude Code when there is no key and it is available", async () => {
    fetchMock.mockImplementation(() => respond({ available: true }));
    const useAI = await loadHook();
    const { result } = renderHook(() => useAI());

    expect(result.current.provider).toBe("off");
    await waitFor(() => expect(result.current.provider).toBe("local"));
  });

  it("is off without a key or local Claude Code, and calls point to Settings", async () => {
    fetchMock.mockImplementation(() => respond({ available: false, code: "disabled", reason: "Not on localhost" }));
    const useAI = await loadHook();
    const { result } = renderHook(() => useAI());

    await waitFor(() => expect(result.current.status.state).toBe("unavailable"));
    expect(result.current.provider).toBe("off");

    await act(async () => {
      await result.current.recommend.run({ context: { kind: "skill", name: "Roadmapping" } });
    });
    expect(result.current.recommend.error).toMatchObject({ code: "off", message: expect.stringContaining("Settings") });
    expect(sdk.create).not.toHaveBeenCalled();
  });

  it("switches provider when a key is saved or forgotten", async () => {
    fetchMock.mockImplementation(() => respond({ available: false, code: "disabled" }));
    const useAI = await loadHook();
    const { saveApiKey, forgetApiKey } = await import("./api-key-storage");
    const { result } = renderHook(() => useAI());
    await waitFor(() => expect(result.current.status.state).toBe("unavailable"));

    act(() => {
      saveApiKey("sk-ant-api03-test");
    });
    expect(result.current.provider).toBe("own-key");

    act(() => forgetApiKey());
    await waitFor(() => expect(result.current.provider).toBe("off"));
  });
});
