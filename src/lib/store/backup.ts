"use client";

import { useSyncExternalStore } from "react";

/**
 * A copy of saved data that could not be read (corrupt JSON, failed
 * validation, or a newer schema). Kept so a bad load never silently destroys
 * the user's data; the app shell offers it for download until deleted.
 */

export const BACKUP_STORAGE_KEY = "growloop:data:backup";

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function readBackup(): string | null {
  try {
    return localStorage.getItem(BACKUP_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function saveBackup(raw: string): void {
  try {
    localStorage.setItem(BACKUP_STORAGE_KEY, raw);
  } catch {
    // Storage unavailable or full: nothing more we can do.
  }
  notify();
}

export function deleteBackup(): void {
  try {
    localStorage.removeItem(BACKUP_STORAGE_KEY);
  } catch {
    // Storage unavailable.
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The raw backed-up data, or null. Always null on the server. */
export function useBackup(): string | null {
  return useSyncExternalStore(subscribe, readBackup, () => null);
}
