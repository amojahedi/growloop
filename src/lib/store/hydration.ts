"use client";

import { useEffect, useSyncExternalStore } from "react";
import { STORAGE_KEY, useAppStore } from "./app-store";

const subscribe = (onChange: () => void) => useAppStore.persist.onFinishHydration(onChange);
const getSnapshot = () => useAppStore.persist.hasHydrated();
const getServerSnapshot = () => false;

/**
 * True once persisted data has been loaded from localStorage. Always false on
 * the server and during hydration, so server HTML and the first client render
 * agree; render a placeholder until it flips.
 */
export function useStoreHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Loads persisted data after mount and keeps open tabs in sync. Render once,
 * near the root of the app.
 */
export function useStoreRehydration(): void {
  useEffect(() => {
    void useAppStore.persist.rehydrate();

    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) void useAppStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}
