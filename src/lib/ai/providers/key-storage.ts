"use client";

import { useSyncExternalStore } from "react";
import { resetOwnKeyClient } from "./own-key-client";

/**
 * The visitor's own Claude API key (ADR 008). Stored in this browser only,
 * under its own localStorage entry, never in the persisted workspace, so
 * export/import can't include it. Only the provider modules read the raw key;
 * UI code gets `useHasApiKey()` and `useApiKeyLast4()`. Never log the key.
 */

export const API_KEY_STORAGE_KEY = "growloop:claude-key";

const MAX_KEY_LENGTH = 500;

/** Used only when the browser blocks storage: the key then lasts for this tab. */
let memoryKey: string | null = null;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function readApiKey(): string | null {
  try {
    const value = localStorage.getItem(API_KEY_STORAGE_KEY);
    if (value?.trim()) return value;
  } catch {
    // Storage blocked: fall back to this tab's copy.
  }
  return memoryKey;
}

/** "memory" when the browser blocked storage, so the key lasts only for this tab. */
export function saveApiKey(key: string): "stored" | "memory" {
  resetOwnKeyClient();
  let result: "stored" | "memory" = "stored";
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
    memoryKey = null;
  } catch {
    memoryKey = key.trim();
    result = "memory";
  }
  notify();
  return result;
}

/** Removes the key everywhere, cancels requests using it and drops the client holding it. */
export function forgetApiKey(): void {
  memoryKey = null;
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing is stored.
  }
  resetOwnKeyClient();
  notify();
}

/** True when a pasted key is obviously not a Claude API key (checked before any network call). */
export function isMalformedApiKey(input: string): boolean {
  const key = input.trim();
  return (
    !key.startsWith("sk-ant-") || key.startsWith("sk-ant-admin") || /\s/.test(key) || key.length > MAX_KEY_LENGTH
  );
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep other tabs in sync when the key is saved or forgotten there.
  const onStorage = (event: StorageEvent) => {
    if (event.key === API_KEY_STORAGE_KEY || event.key === null) {
      resetOwnKeyClient();
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Whether a key is saved. Always false on the server and during hydration. */
export function useHasApiKey(): boolean {
  return useSyncExternalStore(subscribe, () => readApiKey() !== null, () => false);
}

/** The saved key's last four characters, for the masked field; null when none is saved. */
export function useApiKeyLast4(): string | null {
  return useSyncExternalStore(subscribe, () => readApiKey()?.slice(-4) ?? null, () => null);
}
