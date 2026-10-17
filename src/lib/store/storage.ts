import type { PersistStorage, StorageValue } from "zustand/middleware";
import { saveBackup } from "./backup";

/**
 * localStorage adapter for the persisted store. Unlike zustand's
 * `createJSONStorage`, reads never throw: unparseable JSON is backed up and
 * treated as "nothing saved", and blocked storage (e.g. disabled cookies)
 * degrades to an in-memory session instead of leaving the app stuck loading.
 * This is the only code that touches the browser's storage for app data.
 */
export function createSafeStorage<S>(): PersistStorage<S> {
  return {
    getItem(name) {
      let raw: string | null;
      try {
        raw = localStorage.getItem(name);
      } catch {
        return null;
      }
      if (raw === null) return null;

      try {
        return JSON.parse(raw) as StorageValue<S>;
      } catch {
        console.warn("[growloop] Saved data is not valid JSON; it was backed up and the app started fresh.");
        saveBackup(raw);
        return null;
      }
    },
    setItem(name, value) {
      try {
        localStorage.setItem(name, JSON.stringify(value));
      } catch {
        // Blocked or full storage: keep working in memory for this session.
      }
    },
    removeItem(name) {
      try {
        localStorage.removeItem(name);
      } catch {
        // Storage unavailable.
      }
    },
  };
}
