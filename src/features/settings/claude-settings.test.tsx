// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, Toaster } from "@/components/ui/toast";
import { AIRequestError } from "@/lib/ai/request-error";

const validateApiKey = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/providers/own-key", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/providers/own-key")>()),
  validateApiKey,
}));

const fetchMock = vi.fn<typeof fetch>();
const { ClaudeSettings } = await import("./claude-settings");
const { API_KEY_STORAGE_KEY, forgetApiKey } = await import("@/lib/ai/providers/key-storage");

const KEY = "sk-ant-api03-test-key-wxyz";
const keyInput = () => screen.getByLabelText(/Your Claude API key/);
const statusFor = (local: Record<string, unknown>) =>
  fetchMock.mockImplementation(() => Promise.resolve(Response.json(local)));

async function saveKey(value: string) {
  fireEvent.change(keyInput(), { target: { value } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save key" })));
}

beforeEach(() => {
  dismissToast();
  localStorage.clear();
  forgetApiKey();
  validateApiKey.mockReset();
  fetchMock.mockReset();
  // Hosted site by default: the local Claude Code routes are disabled.
  statusFor({ available: false, code: "disabled", reason: "Not on localhost" });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(cleanup);

describe("ClaudeSettings", () => {
  it("checks the key once, saves it, masks it, and forgets it", async () => {
    validateApiKey.mockResolvedValueOnce(undefined);
    render(
      <>
        <ClaudeSettings />
        <Toaster />
      </>,
    );
    await waitFor(() => expect(screen.getByText("Claude is off")).toBeInTheDocument());
    expect(screen.getByText(/goes only to Anthropic/)).toBeInTheDocument();
    expect(screen.getByText(/usually a few cents/)).toBeInTheDocument();
    // Hosted: no Claude Code row.
    expect(screen.queryByText("Claude Code on this computer")).not.toBeInTheDocument();

    // Not a form, and opted out of password managers.
    const input = keyInput();
    expect(input.closest("form")).toBeNull();
    expect(input).toHaveAttribute("type", "password");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(input).toHaveAttribute("data-1p-ignore");
    expect(input).toHaveAttribute("data-lpignore", "true");
    expect(input).toHaveAttribute("data-bwignore");
    expect(input).toHaveAttribute("data-form-type", "other");

    await saveKey(KEY);

    expect(validateApiKey).toHaveBeenCalledWith(KEY, expect.any(AbortSignal));
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe(KEY);
    expect(screen.getByText("Claude is on · your API key")).toBeInTheDocument();
    expect(screen.getByText("Claude is on.")).toBeInTheDocument();
    const saved = screen.getByRole("group", { name: "Your Claude API key" });
    expect(saved).toHaveTextContent("Saved key ending in wxyz");
    expect(saved).toHaveTextContent(/•+wxyz/);
    // Focus lands on the masked key, not on Forget key, so a second Enter can't forget it.
    expect(saved).toHaveFocus();
    fireEvent.keyDown(saved, { key: "Enter" });
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe(KEY);
    // No label points at the masked key (only the input has one).
    expect(document.querySelector("label")).toBeNull();
    // The full key is never shown on the page.
    expect(document.body.innerHTML).not.toContain(KEY);

    fireEvent.click(screen.getByRole("button", { name: "Forget key" }));
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
    expect(screen.getByText("Key forgotten. It's no longer stored in this browser.")).toBeInTheDocument();
    expect(keyInput()).toHaveFocus();
    await waitFor(() => expect(screen.getByText("Claude is off")).toBeInTheDocument());
  });

  it("says when blocked storage keeps the key only for this tab", async () => {
    validateApiKey.mockResolvedValueOnce(undefined);
    // jsdom's Storage, or the in-memory one test/setup.ts swaps in on newer Node.
    const storagePrototype = Object.getPrototypeOf(localStorage) as Storage;
    vi.spyOn(storagePrototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    render(
      <>
        <ClaudeSettings />
        <Toaster />
      </>,
    );
    await saveKey(KEY);
    expect(screen.getByText("Your browser blocks storage, so the key lasts only for this tab.")).toBeInTheDocument();
    expect(screen.getByText("Claude is on · your API key")).toBeInTheDocument();
    // The tab-only copy must not leak into the next test.
    forgetApiKey();
  });

  it("rejects obviously wrong keys without a network call", async () => {
    render(<ClaudeSettings />);
    await saveKey("not-a-key");

    expect(screen.getByRole("alert")).toHaveTextContent("That key didn't work. Check it and try again.");
    expect(validateApiKey).not.toHaveBeenCalled();
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
  });

  it.each([
    ["key-rejected", "That key didn't work. Check it and try again."],
    ["network", "Couldn't reach Anthropic. Check your connection and try again."],
  ] as const)("stores nothing when the check fails (%s)", async (code, text) => {
    validateApiKey.mockRejectedValueOnce(new AIRequestError("x", code));
    render(<ClaudeSettings />);
    await saveKey(KEY);

    expect(screen.getByRole("alert")).toHaveTextContent(text);
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
  });

  it("shows Claude Code on this computer when running locally", async () => {
    statusFor({ available: true });
    validateApiKey.mockResolvedValueOnce(undefined);
    // Fresh modules: the local status is fetched once per page load.
    vi.resetModules();
    const { ClaudeSettings: LocalSettings } = await import("./claude-settings");
    render(<LocalSettings />);

    await waitFor(() => expect(screen.getByText("Claude is on · Claude Code on this computer")).toBeInTheDocument());
    expect(screen.getByText(/Found · signed in/)).toBeInTheDocument();
    expect(screen.getByText(/Optional: use an API key instead/)).toBeInTheDocument();

    await saveKey(KEY);
    expect(screen.getByText("Claude is on · your API key")).toBeInTheDocument();
    expect(screen.getByText(/Found · not used while your API key is saved/)).toBeInTheDocument();
  });
});
