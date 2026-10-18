// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDevicePreferences,
  DEVICE_STORAGE_KEY,
  readDevicePreferences,
  updateDevicePreferences,
  useDevicePreferences,
  useSampleMode,
} from "./device";

beforeEach(() => {
  localStorage.clear();
  clearDevicePreferences();
});

afterEach(() => vi.restoreAllMocks());

describe("device preferences", () => {
  it("stores preferences under their own key and removes keys set to undefined", () => {
    updateDevicePreferences({ welcomeDoneAt: "2026-10-18T10:00:00Z", sampleMode: true });
    updateDevicePreferences({ sampleMode: undefined, tourSeenAt: "2026-10-18T10:05:00Z" });

    expect(JSON.parse(localStorage.getItem(DEVICE_STORAGE_KEY)!)).toEqual({
      welcomeDoneAt: "2026-10-18T10:00:00Z",
      tourSeenAt: "2026-10-18T10:05:00Z",
    });
  });

  it("ignores unknown and malformed fields, and unreadable JSON", () => {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify({ sampleMode: "yes", tourSeenAt: "2026-10-18", future: 1 }));
    expect(readDevicePreferences()).toEqual({ tourSeenAt: "2026-10-18" });

    localStorage.setItem(DEVICE_STORAGE_KEY, "{oops");
    expect(readDevicePreferences()).toEqual({});
  });

  it("returns the same object until the stored value changes (stable snapshots)", () => {
    updateDevicePreferences({ tourSeenAt: "a" });
    expect(readDevicePreferences()).toBe(readDevicePreferences());
  });

  it("keeps preferences for this tab when storage is blocked", () => {
    const target: Storage = localStorage instanceof Storage ? Storage.prototype : localStorage;
    vi.spyOn(target, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    updateDevicePreferences({ sampleMode: true });
    expect(readDevicePreferences()).toEqual({ sampleMode: true });
  });

  it("is unknown during hydration and updates subscribers, including from other tabs", () => {
    const { result } = renderHook(() => ({ prefs: useDevicePreferences(), sample: useSampleMode() }));
    expect(result.current).toEqual({ prefs: {}, sample: false });

    act(() => updateDevicePreferences({ sampleMode: true }));
    expect(result.current.sample).toBe(true);

    act(() => {
      localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify({}));
      window.dispatchEvent(new StorageEvent("storage", { key: DEVICE_STORAGE_KEY }));
    });
    expect(result.current.sample).toBe(false);
  });
});
