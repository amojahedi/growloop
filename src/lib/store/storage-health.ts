"use client";

import { useSyncExternalStore } from "react";

/**
 * Whether this browser lets Growloop keep data (navigation-and-empty-states.md
 * §Errors): "blocked" when storage is disabled, "full" when the quota is
 * reached. Reported by every module that touches localStorage (workspace,
 * device preferences, backups), read by the storage banner via
 * useStorageHealth(). "blocked" lasts for the session; "full" clears after a
 * later write succeeds.
 */

export type StorageHealth = "ok" | "blocked" | "full";

let health: StorageHealth = "ok";
const listeners = new Set<() => void>();

function set(next: StorageHealth) {
  if (next === health) return;
  health = next;
  listeners.forEach((listener) => listener());
}

/** Quota errors differ by browser: the name in modern ones, legacy codes in older WebKit and Firefox. */
export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014;
}

/** Records a failed storage access. */
export function reportStorageError(error: unknown): void {
  if (isQuotaError(error)) {
    if (health !== "blocked") set("full");
  } else {
    set("blocked");
  }
}

/** Records a successful write, which ends a "full" state. */
export function reportStorageWrite(): void {
  if (health === "full") set("ok");
}

export const readStorageHealth = (): StorageHealth => health;

/** For tests: back to "ok". */
export function resetStorageHealth(): void {
  set("ok");
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** "ok", "blocked" or "full"; always "ok" on the server and during hydration. */
export function useStorageHealth(): StorageHealth {
  return useSyncExternalStore(subscribe, readStorageHealth, () => "ok");
}
