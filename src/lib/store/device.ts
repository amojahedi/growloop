"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";
import { reportStorageError, reportStorageWrite } from "./storage-health";

/**
 * Device preferences (ADR 009): state that belongs to this browser, not to the
 * user's plan. Stored under its own key, never exported, imported or migrated;
 * unknown or malformed fields are ignored, so any build can read any version.
 */

export const DEVICE_STORAGE_KEY = "growloop:device";

export interface DevicePreferences {
  /** When the first-launch screen was answered (any choice). */
  welcomeDoneAt?: string;
  /** When the tour was shown (it auto-starts only once). */
  tourSeenAt?: string;
  /** When the tour was finished or skipped. */
  tourCompletedAt?: string;
  /** Sample mode: the store loads `growloop:sample` instead of `growloop:data`. */
  sampleMode?: boolean;
}

const lenient = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

const devicePreferencesSchema = z.object({
  welcomeDoneAt: lenient(z.string()),
  tourSeenAt: lenient(z.string()),
  tourCompletedAt: lenient(z.string()),
  sampleMode: lenient(z.boolean()),
});

/**
 * Set once a write fails (blocked or full storage): from then on this tab's
 * copy wins over whatever storage still holds, so a flag such as sampleMode
 * can never read differently from what was just set.
 */
let memory: DevicePreferences | null = null;
/** The parsed value for a raw stored string, so snapshots stay referentially stable. */
let cache: { raw: string | null; value: DevicePreferences } | undefined;

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function parse(raw: string | null): DevicePreferences {
  if (raw === null) return {};
  try {
    const result = devicePreferencesSchema.safeParse(JSON.parse(raw));
    if (!result.success) return {};
    // Drop keys the lenient parse turned into undefined.
    return Object.fromEntries(Object.entries(result.data).filter(([, value]) => value !== undefined));
  } catch {
    return {};
  }
}

const EMPTY: DevicePreferences = {};

export function readDevicePreferences(): DevicePreferences {
  if (memory) return memory;
  let raw: string | null;
  try {
    raw = localStorage.getItem(DEVICE_STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (cache?.raw !== raw) cache = { raw, value: parse(raw) };
  return cache.value;
}

function write(next: DevicePreferences): void {
  try {
    localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify(next));
    memory = null;
    reportStorageWrite();
  } catch (error) {
    memory = next;
    reportStorageError(error);
  }
  notify();
}

/** Merges a patch into the device preferences; `undefined` values remove a key. */
export function updateDevicePreferences(patch: Partial<DevicePreferences>): void {
  const next: DevicePreferences = { ...readDevicePreferences(), ...patch };
  for (const key of Object.keys(next) as (keyof DevicePreferences)[]) if (next[key] === undefined) delete next[key];
  write(next);
}

/** Forgets every device preference (Erase everything). */
export function clearDevicePreferences(): void {
  memory = null;
  try {
    localStorage.removeItem(DEVICE_STORAGE_KEY);
  } catch (error) {
    // Storage unavailable: nothing is stored, and nothing is kept in memory either.
    memory = {};
    reportStorageError(error);
  }
  notify();
}

export const isSampleModeOn = (): boolean => readDevicePreferences().sampleMode === true;

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed them (e.g. switched sample mode).
  const onStorage = (event: StorageEvent) => {
    if (event.key === DEVICE_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

const SERVER_SNAPSHOT: DevicePreferences | null = null;

/** The device preferences, or `null` on the server and during hydration (unknown until the client reads storage). */
export function useDevicePreferences(): DevicePreferences | null {
  return useSyncExternalStore(subscribe, readDevicePreferences, () => SERVER_SNAPSHOT);
}

/** Whether sample mode is on; false on the server and during hydration. */
export function useSampleMode(): boolean {
  return useSyncExternalStore(subscribe, isSampleModeOn, () => false);
}
