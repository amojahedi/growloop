"use client";

import { useEffect, useSyncExternalStore } from "react";
import { activeStorageKey, useAppStore } from "./app-store";
import { DEVICE_STORAGE_KEY } from "./device";
import { rehydrateWizardSession } from "./ui-store";

// `persist` is accessed defensively: without usable storage there is nothing to hydrate.
const subscribe = (onChange: () => void) => useAppStore.persist?.onFinishHydration(onChange) ?? (() => {});
const getSnapshot = () => useAppStore.persist?.hasHydrated() ?? true;
const getServerSnapshot = () => false;

/**
 * True once persisted data has been loaded from localStorage. Always false on
 * the server and during hydration, so server HTML and the first client render
 * agree; render a placeholder until it flips.
 */
export function useStoreHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Loads the workspace for the current mode: the own workspace, or the sample in sample mode. */
export function rehydrateWorkspace(): void {
  const api = useAppStore.persist;
  if (!api) return;
  api.setOptions({ name: activeStorageKey() });
  void api.rehydrate();
}

/**
 * Loads persisted data after mount and keeps open tabs in sync: edits in
 * another tab reload the workspace, and switching sample mode there switches
 * this tab too. Render once, near the root of the app.
 */
export function useStoreRehydration(): void {
  useEffect(() => {
    rehydrateWorkspace();
    rehydrateWizardSession();

    const onStorage = (event: StorageEvent) => {
      const current = useAppStore.persist?.getOptions().name;
      const modeChanged = (event.key === DEVICE_STORAGE_KEY || event.key === null) && activeStorageKey() !== current;
      if (modeChanged || event.key === current || event.key === null) rehydrateWorkspace();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}
