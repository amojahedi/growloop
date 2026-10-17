"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import { parseFilters, serializeFilters } from "./filter-params";
import type { ResourceFilters } from "./resource-filters";

export interface UpdateFiltersOptions {
  /** Replace the current history entry instead of adding one (used while typing a search). */
  replace?: boolean;
}

/**
 * Filter state that lives in the URL query string. Updates go through the
 * native History API, which Next's router picks up (see "Linking and
 * Navigating" in the Next docs): no server round trip, and the back button
 * steps through earlier filter states.
 */
export function useResourceFilters(knownSkillIds: ReadonlySet<string>) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const filters = useMemo(() => parseFilters(searchParams, knownSkillIds), [searchParams, knownSkillIds]);

  /** Takes an updater so debounced callers always build on the latest URL, never a stale render. */
  const updateFilters = useCallback(
    (update: (current: ResourceFilters) => ResourceFilters, { replace = false }: UpdateFiltersOptions = {}) => {
      const current = parseFilters(new URLSearchParams(window.location.search), knownSkillIds);
      const query = serializeFilters(update(current));
      if (query === window.location.search.replace(/^\?/, "")) return;
      const url = query ? `${pathname}?${query}` : pathname;
      if (replace) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    },
    [pathname, knownSkillIds],
  );

  return { filters, updateFilters };
}
