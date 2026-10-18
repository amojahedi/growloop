"use client";

import { useSyncExternalStore } from "react";
import { now } from "@/lib/clock";
import { reportStorageError, reportStorageWrite } from "./storage-health";

/**
 * Copies of saved data that could not be read (corrupt JSON, failed
 * validation, or a newer schema). Kept so a bad load never silently destroys
 * the user's data; the app shell offers the newest for download until deleted.
 * A new backup never replaces an older one: the last few are kept, newest
 * first, and the same raw value is stored only once.
 */

export const BACKUPS_STORAGE_KEY = "growloop:data:backups";
/** Where builds before the ring kept their single backup; still read, folded into the ring on the next save. */
export const LEGACY_BACKUP_STORAGE_KEY = "growloop:data:backup";
export const MAX_BACKUPS = 3;

export interface Backup {
  /** ISO timestamp; empty for a backup made by an older build. */
  savedAt: string;
  raw: string;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function readRing(): Backup[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(BACKUPS_STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is Backup => typeof entry?.raw === "string" && typeof entry?.savedAt === "string")
      : [];
  } catch {
    return [];
  }
}

/** Every kept backup, newest first. */
export function readBackups(): Backup[] {
  let legacy: string | null = null;
  try {
    legacy = localStorage.getItem(LEGACY_BACKUP_STORAGE_KEY);
  } catch {
    return [];
  }
  const ring = readRing();
  return legacy !== null && !ring.some((entry) => entry.raw === legacy) ? [...ring, { savedAt: "", raw: legacy }] : ring;
}

/** The newest backup's raw data, or null. */
export function readBackup(): string | null {
  return readBackups()[0]?.raw ?? null;
}

export function saveBackup(raw: string): void {
  const kept = readBackups().filter((entry) => entry.raw !== raw);
  const ring = [{ savedAt: now().toISOString(), raw }, ...kept].slice(0, MAX_BACKUPS);
  try {
    localStorage.setItem(BACKUPS_STORAGE_KEY, JSON.stringify(ring));
    localStorage.removeItem(LEGACY_BACKUP_STORAGE_KEY);
    reportStorageWrite();
  } catch (error) {
    // Storage unavailable or full: nothing more we can do, but the banner can say so.
    reportStorageError(error);
  }
  notify();
}

/** Deletes every backup. */
export function deleteBackup(): void {
  try {
    localStorage.removeItem(BACKUPS_STORAGE_KEY);
    localStorage.removeItem(LEGACY_BACKUP_STORAGE_KEY);
  } catch (error) {
    reportStorageError(error);
  }
  notify();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The newest backup's raw data, or null. Always null on the server. */
export function useBackup(): string | null {
  return useSyncExternalStore(subscribe, readBackup, () => null);
}
