// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEV_NOW_STORAGE_KEY, now, resolveNow } from "./clock";

const real = new Date(2026, 9, 18, 14, 30);

describe("resolveNow", () => {
  it("moves to a day, keeping the time of day", () => {
    const moved = resolveNow("2027-01-01", real);
    expect([moved.getFullYear(), moved.getMonth(), moved.getDate(), moved.getHours(), moved.getMinutes()]).toEqual([2027, 0, 1, 14, 30]);
  });

  it("uses an exact moment when given one", () => {
    expect(resolveNow("2026-12-31T23:50:00.000Z", real).toISOString()).toBe("2026-12-31T23:50:00.000Z");
  });

  it("ignores missing or unreadable overrides", () => {
    expect(resolveNow(null, real)).toBe(real);
    expect(resolveNow("  ", real)).toBe(real);
    expect(resolveNow("next tuesday", real)).toBe(real);
  });
});

describe("now", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("follows the override in development builds only", () => {
    localStorage.setItem(DEV_NOW_STORAGE_KEY, "2027-01-01");

    vi.stubEnv("NODE_ENV", "development");
    expect(now().getFullYear()).toBe(2027);

    vi.stubEnv("NODE_ENV", "production");
    expect(now().getFullYear()).not.toBe(2027);
  });
});
