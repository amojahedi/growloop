"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";
import type { ID } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";
import { parseNotebookParams, serializeNotebookParams, type NotebookParams } from "./notebook-params";

export const NOTEBOOK_PATH = "/notebook";

/** Writes Notebook state to the URL with the History API, which Next's router picks up (no server round trip). */
function writeUrl(state: NotebookParams, { replace = false, pathname = NOTEBOOK_PATH } = {}) {
  const query = serializeNotebookParams(state);
  if (query === window.location.search.replace(/^\?/, "") && window.location.pathname === pathname) return;
  const url = query ? `${pathname}?${query}` : pathname;
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
}

/** Notebook filters and selection, kept in the URL so views are shareable and Back steps through them. */
export function useNotebookParams(knownSkillIds: ReadonlySet<ID>) {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const params = useMemo(() => parseNotebookParams(searchParams, knownSkillIds), [searchParams, knownSkillIds]);

  /** Takes an updater, so debounced callers build on the latest URL rather than a stale render. */
  const update = useCallback(
    (recipe: (current: NotebookParams) => NotebookParams, options: { replace?: boolean } = {}) => {
      const current = parseNotebookParams(new URLSearchParams(window.location.search), knownSkillIds);
      writeUrl(recipe(current), { ...options, pathname });
    },
    [knownSkillIds, pathname],
  );

  return { params, update };
}

/**
 * "New note": creates a free note at once and opens it with the title focused
 * (filters are cleared so it is in view). An untouched empty note is discarded
 * when the user moves on (see NotebookView).
 */
export function createNoteAndOpen(): ID {
  const id = useAppStore.getState().createNote({ title: "" });
  writeUrl({ query: "", show: "all", skills: [], due: false, note: id });
  return id;
}
