"use client";

import { useSyncExternalStore } from "react";

/**
 * The visitor's own Claude API key (ADR 008). Stored in this browser only,
 * under its own localStorage entry: it is never part of the persisted
 * workspace, so JSON export/import can't include it. Never log the key.
 */

export const API_KEY_STORAGE_KEY = "growloop:claude-api-key";

const MAX_KEY_LENGTH = 500;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function readApiKey(): string | null {
  try {
    const value = localStorage.getItem(API_KEY_STORAGE_KEY);
    return value?.trim() ? value : null;
  } catch {
    return null;
  }
}

/** Returns false when storage is unavailable (e.g. blocked site data). */
export function saveApiKey(key: string): boolean {
  let saved = true;
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, key.trim());
  } catch {
    saved = false;
  }
  notify();
  return saved;
}

export function forgetApiKey(): void {
  try {
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  } catch {
    // Storage unavailable: nothing is stored.
  }
  notify();
}

/** A friendly problem with a pasted key's format, or null when it looks usable. */
export function apiKeyFormatProblem(input: string): string | null {
  const key = input.trim();
  if (!key) return "Paste a key first.";
  if (/\s/.test(key) || key.length > MAX_KEY_LENGTH) return "That doesn't look like a Claude API key.";
  if (key.startsWith("sk-ant-admin")) return "That's an Admin key. Use a regular API key instead.";
  if (!key.startsWith("sk-ant-")) return "Claude API keys start with “sk-ant-”.";
  return null;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep other tabs in sync when the key is saved or forgotten there.
  const onStorage = (event: StorageEvent) => {
    if (event.key === API_KEY_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The saved key, or null. Always null on the server and during hydration. */
export function useClaudeApiKey(): string | null {
  return useSyncExternalStore(subscribe, readApiKey, () => null);
}
