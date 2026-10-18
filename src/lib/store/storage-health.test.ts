// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BACKUPS_STORAGE_KEY, LEGACY_BACKUP_STORAGE_KEY, readBackups, saveBackup } from "./backup";
import { clearDevicePreferences, readDevicePreferences, updateDevicePreferences } from "./device";
import { isQuotaError, reportStorageError, reportStorageWrite, resetStorageHealth, useStorageHealth } from "./storage-health";

const target = (): Storage => (localStorage instanceof Storage ? Storage.prototype : localStorage);
const quota = () => new DOMException("Quota", "QuotaExceededError");

beforeEach(() => {
  localStorage.clear();
  clearDevicePreferences();
  resetStorageHealth();
});

afterEach(() => vi.restoreAllMocks());

describe("useStorageHealth", () => {
  it("tells blocked from full storage; full clears after a later write, blocked lasts", () => {
    const { result } = renderHook(() => useStorageHealth());
    expect(result.current).toBe("ok");

    act(() => reportStorageError(quota()));
    expect(result.current).toBe("full");
    act(() => reportStorageWrite());
    expect(result.current).toBe("ok");

    act(() => reportStorageError(new DOMException("Denied", "SecurityError")));
    act(() => reportStorageError(quota()));
    act(() => reportStorageWrite());
    expect(result.current).toBe("blocked");
  });

  it("recognises quota errors across browsers", () => {
    expect(isQuotaError(quota())).toBe(true);
    expect(isQuotaError(new DOMException("Quota", "NS_ERROR_DOM_QUOTA_REACHED"))).toBe(true);
    expect(isQuotaError(new DOMException("Denied", "SecurityError"))).toBe(false);
    expect(isQuotaError(new Error("nope"))).toBe(false);
  });

  it("is reported by device preferences and backups", () => {
    const { result } = renderHook(() => useStorageHealth());
    vi.spyOn(target(), "setItem").mockImplementation(() => {
      throw quota();
    });

    act(() => updateDevicePreferences({ tourSeenAt: "now" }));
    expect(result.current).toBe("full");
    act(() => resetStorageHealth());
    act(() => saveBackup("{raw"));
    expect(result.current).toBe("full");
  });
});

describe("device preferences after a failed write", () => {
  it("trust this tab's copy over what storage still holds", () => {
    updateDevicePreferences({ welcomeDoneAt: "earlier" });
    vi.spyOn(target(), "setItem").mockImplementation(() => {
      throw quota();
    });

    updateDevicePreferences({ sampleMode: true });
    expect(readDevicePreferences()).toEqual({ welcomeDoneAt: "earlier", sampleMode: true });
  });
});

describe("backups", () => {
  it("fold a backup made by an older build into the ring", () => {
    localStorage.setItem(LEGACY_BACKUP_STORAGE_KEY, "{legacy");
    expect(readBackups()).toEqual([{ savedAt: "", raw: "{legacy" }]);

    saveBackup("{new");
    expect(readBackups().map((backup) => backup.raw)).toEqual(["{new", "{legacy"]);
    expect(localStorage.getItem(LEGACY_BACKUP_STORAGE_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(BACKUPS_STORAGE_KEY)!)).toHaveLength(2);
  });
});
