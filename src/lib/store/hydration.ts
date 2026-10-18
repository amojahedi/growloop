"use client";

import { useEffect, useSyncExternalStore } from "react";
import { APP_DATA_VERSION } from "@/lib/domain/app-data";
import { activeStorageKey, refreshWorkspace, useAppStore } from "./app-store";
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

// --- A newer build in another tab --------------------------------------------------

let newerVersionElsewhere = false;
const newerListeners = new Set<() => void>();

function flagNewerVersion() {
  if (newerVersionElsewhere) return;
  newerVersionElsewhere = true;
  newerListeners.forEach((listener) => listener());
}

/**
 * True once another tab saved the workspace with a newer schema (a newer
 * build). This tab then stops following that tab's changes; the shell should
 * offer "Growloop was updated in another tab. Reload".
 */
export function useNewerVersionInAnotherTab(): boolean {
  return useSyncExternalStore(
    (listener) => {
      newerListeners.add(listener);
      return () => newerListeners.delete(listener);
    },
    () => newerVersionElsewhere,
    () => false,
  );
}

/** For tests. */
export function resetNewerVersionFlag(): void {
  newerVersionElsewhere = false;
}

/** The schema version in a stored value, or undefined when unreadable. */
function storedVersion(raw: string | null): number | undefined {
  if (raw === null) return undefined;
  try {
    const version = (JSON.parse(raw) as { version?: unknown }).version;
    return typeof version === "number" ? version : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reacts to storage changes from other tabs: switching sample mode there
 * switches this tab too, and edits there reload here. Values written by a
 * different build (another schema version) are ignored, so two builds never
 * fight over the data; a newer one raises useNewerVersionInAnotherTab().
 */
export function handleStorageEvent(event: Pick<StorageEvent, "key" | "newValue">): void {
  const current = useAppStore.persist?.getOptions().name;
  const cleared = event.key === null;
  if ((event.key === DEVICE_STORAGE_KEY || cleared) && activeStorageKey() !== current) {
    rehydrateWorkspace();
    return;
  }
  if (event.key !== current && !cleared) return;

  const version = storedVersion(event.newValue);
  if (version !== undefined && version !== APP_DATA_VERSION) {
    if (version > APP_DATA_VERSION) flagNewerVersion();
    return;
  }
  refreshWorkspace();
}

/**
 * Loads persisted data after mount and keeps open tabs in sync. Render once,
 * near the root of the app.
 */
export function useStoreRehydration(): void {
  useEffect(() => {
    rehydrateWorkspace();
    rehydrateWizardSession();

    window.addEventListener("storage", handleStorageEvent);
    return () => window.removeEventListener("storage", handleStorageEvent);
  }, []);
}
