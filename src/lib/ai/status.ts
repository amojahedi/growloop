"use client";

import { useEffect, useSyncExternalStore } from "react";
import { fetchAIStatus } from "./client";
import { selectProviderKind, type AIProviderKind } from "./provider";
import { useHasApiKey } from "./providers/key-storage";
import type { AIStatus } from "./schemas";

/**
 * The one shared Claude status (settings spec §Provider order): which provider
 * is active, app-wide. Local Claude Code availability is checked once per page
 * load and shared, so "Check again" anywhere updates every component.
 */

export type LocalClaudeStatus =
  | { state: "checking" }
  | { state: "available" }
  /** `reason` and `code` describe why Claude Code can't be used here ("disabled" when not on localhost). */
  | { state: "unavailable"; reason?: string; code?: AIStatus["code"] };

const CHECKING: LocalClaudeStatus = { state: "checking" };

let snapshot: LocalClaudeStatus = CHECKING;
let started = false;
/** Only the latest check may update the snapshot. */
let generation = 0;
const listeners = new Set<() => void>();

function setSnapshot(next: LocalClaudeStatus) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

function check(fresh: boolean) {
  const current = ++generation;
  fetchAIStatus({ fresh })
    .then((status): LocalClaudeStatus =>
      status.available ? { state: "available" } : { state: "unavailable", reason: status.reason, code: status.code },
    )
    .catch(
      (error: unknown): LocalClaudeStatus => ({
        state: "unavailable",
        code: "error",
        reason: error instanceof Error ? error.message : "Couldn't check whether Claude Code is available.",
      }),
    )
    .then((next) => {
      if (current !== generation) return;
      // A failed check may be retried by the next caller.
      if (next.state === "unavailable" && next.code === "error") started = false;
      setSnapshot(next);
    });
}

/** Starts the shared check once per page load. */
export function ensureLocalClaudeStatus(): void {
  if (started) return;
  started = true;
  check(false);
}

/** Checks again, e.g. after the user installs or signs in to Claude Code. */
export function recheckLocalClaudeStatus(): void {
  started = true;
  setSnapshot(CHECKING);
  check(true);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Local Claude Code availability. Pass `enabled: false` to skip the check (it spawns processes on the server). */
export function useLocalClaudeStatus({ enabled = true }: { enabled?: boolean } = {}): {
  status: LocalClaudeStatus;
  recheck: () => void;
} {
  useEffect(() => {
    if (enabled) ensureLocalClaudeStatus();
  }, [enabled]);
  const status = useSyncExternalStore(subscribe, () => snapshot, () => CHECKING);
  return { status, recheck: recheckLocalClaudeStatus };
}

export interface AIStatusInfo {
  /** The active provider: "key" (own API key), "local" (Claude Code) or null (off, or still checking). */
  provider: AIProviderKind | null;
  /** True while there is no key and the local check hasn't answered yet ("Checking Claude…"). */
  checking: boolean;
  /** Claude Code on this computer, for Settings and setup hints. */
  local: LocalClaudeStatus;
  recheck: () => void;
}

/** The shared status: own key → Claude Code on this computer → off. */
export function useAIStatus(): AIStatusInfo {
  // A boolean, never the key itself: the key isn't held in React state (or visible in DevTools).
  const hasKey = useHasApiKey();
  // With a key the local CLI is never used, so skip its status check.
  const { status: local, recheck } = useLocalClaudeStatus({ enabled: !hasKey });
  return {
    provider: selectProviderKind({ hasKey, localAvailable: local.state === "available" }),
    checking: !hasKey && local.state === "checking",
    local,
    recheck,
  };
}
