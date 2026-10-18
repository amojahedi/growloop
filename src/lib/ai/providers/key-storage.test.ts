// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  API_KEY_STORAGE_KEY,
  forgetApiKey,
  isMalformedApiKey,
  readApiKey,
  saveApiKey,
  useApiKeyLast4,
  useHasApiKey,
} from "./key-storage";

beforeEach(() => {
  localStorage.clear();
  forgetApiKey();
});

afterEach(() => vi.restoreAllMocks());

describe("API key storage", () => {
  it("saves, reads and forgets the key under its own entry", () => {
    expect(readApiKey()).toBeNull();
    expect(saveApiKey("  sk-ant-api03-abcd  ")).toBe("stored");
    expect(localStorage.getItem("growloop:claude-key")).toBe("sk-ant-api03-abcd");
    expect(API_KEY_STORAGE_KEY).toBe("growloop:claude-key");
    expect(readApiKey()).toBe("sk-ant-api03-abcd");

    forgetApiKey();
    expect(readApiKey()).toBeNull();
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
  });

  it("keeps the key for this tab only when the browser blocks storage", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(saveApiKey("sk-ant-api03-abcd")).toBe("memory");
    expect(readApiKey()).toBe("sk-ant-api03-abcd");

    forgetApiKey();
    expect(readApiKey()).toBeNull();
  });

  it("exposes only whether a key is saved and its last four characters to the UI", () => {
    const { result } = renderHook(() => ({ hasKey: useHasApiKey(), last4: useApiKeyLast4() }));
    expect(result.current).toEqual({ hasKey: false, last4: null });

    act(() => {
      saveApiKey("sk-ant-api03-wxyz");
    });
    expect(result.current).toEqual({ hasKey: true, last4: "wxyz" });

    act(() => forgetApiKey());
    expect(result.current).toEqual({ hasKey: false, last4: null });
  });

  it("spots obviously wrong formats before any network call", () => {
    expect(isMalformedApiKey("sk-ant-api03-abc")).toBe(false);
    expect(isMalformedApiKey(" sk-ant-api03-abc\n")).toBe(false);
    expect(isMalformedApiKey("")).toBe(true);
    expect(isMalformedApiKey("sk-ant-api03 abc")).toBe(true);
    expect(isMalformedApiKey("sk-ant-admin01-abc")).toBe(true);
    expect(isMalformedApiKey("sk-proj-abc")).toBe(true);
  });
});
