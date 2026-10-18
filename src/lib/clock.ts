/**
 * "Now" for the whole app. In development builds QA can move the clock to
 * simulate month, quarter and year ends:
 *
 *   localStorage.setItem("growloop:dev-now", "2027-01-01")   // that day, at the current time of day
 *   localStorage.setItem("growloop:dev-now", "2026-12-31T23:50:00")  // an exact moment (frozen)
 *   localStorage.removeItem("growloop:dev-now")              // back to the real clock
 *
 * Production builds never read the override: `process.env.NODE_ENV` is inlined
 * at build time, so the branch is removed from the bundle.
 */

export const DEV_NOW_STORAGE_KEY = "growloop:dev-now";

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Applies an override value to the real time. Unreadable overrides are ignored. */
export function resolveNow(override: string | null, real: Date): Date {
  const value = override?.trim();
  if (!value) return real;
  const day = DAY.exec(value);
  if (day) {
    const [year, month, date] = day.slice(1).map(Number);
    const moved = new Date(real);
    moved.setFullYear(year, month - 1, date);
    return Number.isNaN(moved.getTime()) ? real : moved;
  }
  const exact = new Date(value);
  return Number.isNaN(exact.getTime()) ? real : exact;
}

function readOverride(): string | null {
  try {
    return localStorage.getItem(DEV_NOW_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** The current time; in development builds, shifted by the `growloop:dev-now` override. */
export function now(): Date {
  if (process.env.NODE_ENV !== "development") return new Date();
  return resolveNow(typeof window === "undefined" ? null : readOverride(), new Date());
}

/** Calls `onChange` when the override changes in another tab (development builds only). */
export function subscribeToDevClock(onChange: () => void): () => void {
  if (process.env.NODE_ENV !== "development") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === DEV_NOW_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}
