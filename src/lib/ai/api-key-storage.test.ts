// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  API_KEY_STORAGE_KEY,
  apiKeyFormatProblem,
  forgetApiKey,
  readApiKey,
  saveApiKey,
  useClaudeApiKey,
} from "./api-key-storage";

beforeEach(() => localStorage.clear());

describe("API key storage", () => {
  it("saves, reads and forgets the key under its own entry", () => {
    expect(readApiKey()).toBeNull();
    expect(saveApiKey("  sk-ant-api03-abc  ")).toBe(true);
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBe("sk-ant-api03-abc");
    expect(readApiKey()).toBe("sk-ant-api03-abc");

    forgetApiKey();
    expect(readApiKey()).toBeNull();
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
  });

  it("keeps the hook in sync", () => {
    const { result } = renderHook(() => useClaudeApiKey());
    expect(result.current).toBeNull();

    act(() => {
      saveApiKey("sk-ant-api03-abc");
    });
    expect(result.current).toBe("sk-ant-api03-abc");

    act(() => forgetApiKey());
    expect(result.current).toBeNull();
  });

  it("checks the format of a pasted key", () => {
    expect(apiKeyFormatProblem("sk-ant-api03-abc")).toBeNull();
    expect(apiKeyFormatProblem(" sk-ant-api03-abc\n")).toBeNull();
    expect(apiKeyFormatProblem("")).toMatch(/Paste a key/);
    expect(apiKeyFormatProblem("sk-ant-api03 abc")).toMatch(/doesn't look like/);
    expect(apiKeyFormatProblem("sk-ant-admin01-abc")).toMatch(/Admin key/);
    expect(apiKeyFormatProblem("sk-proj-abc")).toMatch(/start with/);
  });
});
