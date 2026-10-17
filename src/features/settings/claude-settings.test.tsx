// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIRequestError } from "@/lib/ai/request-error";

const testApiKey = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/providers/own-key", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/providers/own-key")>()),
  testApiKey,
}));

const fetchMock = vi.fn<typeof fetch>();
const { ClaudeSettings } = await import("./claude-settings");
const { API_KEY_STORAGE_KEY } = await import("@/lib/ai/api-key-storage");

const KEY = "sk-ant-api03-test-key";
const keyInput = () => screen.getByLabelText("Claude API key");

beforeEach(() => {
  localStorage.clear();
  testApiKey.mockReset();
  fetchMock.mockReset();
  // Hosted site: the local Claude Code routes are disabled.
  fetchMock.mockImplementation(() =>
    Promise.resolve(Response.json({ available: false, code: "disabled", reason: "Not on localhost" })),
  );
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(cleanup);

describe("ClaudeSettings", () => {
  it("saves a key, uses it, and forgets it", async () => {
    render(<ClaudeSettings />);
    await waitFor(() => expect(screen.getByText("AI is off")).toBeInTheDocument());
    expect(keyInput()).toHaveAttribute("type", "password");
    expect(screen.getByText(/stays in this browser only and is sent only to Anthropic/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Forget key" })).not.toBeInTheDocument();

    fireEvent.change(keyInput(), { target: { value: KEY } });
    fireEvent.click(screen.getByRole("button", { name: "Save key" }));

    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe(KEY);
    expect(keyInput()).toHaveValue("");
    expect(screen.getByText("Using your key")).toBeInTheDocument();
    // The saved key is never shown on the page.
    expect(document.body.textContent).not.toContain(KEY);

    fireEvent.click(screen.getByRole("button", { name: "Forget key" }));
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
    await waitFor(() => expect(screen.getByText("AI is off")).toBeInTheDocument());
  });

  it("rejects keys with the wrong format without saving", () => {
    render(<ClaudeSettings />);
    fireEvent.change(keyInput(), { target: { value: "not-a-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Save key" }));

    expect(screen.getByRole("alert")).toHaveTextContent("sk-ant-");
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
  });

  it("tests the pasted key and reports the result", async () => {
    testApiKey.mockResolvedValueOnce(undefined);
    render(<ClaudeSettings />);
    fireEvent.change(keyInput(), { target: { value: KEY } });

    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Test key" })));
    expect(testApiKey).toHaveBeenCalledWith(KEY, expect.any(AbortSignal));
    expect(screen.getByText(/The key works/)).toBeInTheDocument();

    testApiKey.mockRejectedValueOnce(new AIRequestError("Key rejected. Check your Claude API key in Settings.", "key-rejected"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Test key" })));
    expect(screen.getByRole("alert")).toHaveTextContent("Key rejected");
  });
});
