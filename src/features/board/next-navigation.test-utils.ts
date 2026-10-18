import { useMemo, useSyncExternalStore } from "react";

/**
 * A stand-in for `next/navigation` in board tests: the URL is jsdom's, and
 * `useSearchParams` follows pushState / replaceState / popstate like Next's router.
 *
 *   vi.mock("next/navigation", () => import("./next-navigation.test-utils"));
 */

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

for (const method of ["pushState", "replaceState"] as const) {
  const original = window.history[method].bind(window.history);
  window.history[method] = (...args: Parameters<History["pushState"]>) => {
    original(...args);
    notify();
  };
}
window.addEventListener("popstate", notify);

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const usePathname = () => window.location.pathname;

export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, () => window.location.search);
  return useMemo(() => new URLSearchParams(search), [search]);
}
