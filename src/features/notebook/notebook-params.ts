import type { ID } from "@/lib/domain/types";

/**
 * Notebook state ⇄ URL (notebook.md §Filters): `?q=` search, `?show=` source,
 * `?skill=` skills (comma-separated), `?due=1` and `?note=<id>` for the
 * selected note. Defaults are omitted, so the plain page has a clean URL.
 * Parsing never throws: unknown values are dropped.
 */

export const NOTEBOOK_SHOW = ["all", "summaries", "notes"] as const;
export type NotebookShow = (typeof NOTEBOOK_SHOW)[number];

export interface NotebookFilters {
  query: string;
  show: NotebookShow;
  skills: ID[];
  due: boolean;
}

export interface NotebookParams extends NotebookFilters {
  /** The selected note. */
  note: ID | null;
}

export const DEFAULT_NOTEBOOK_PARAMS: NotebookParams = { query: "", show: "all", skills: [], due: false, note: null };

const MAX_QUERY_LENGTH = 200;
const MAX_SKILLS = 50;

type ParamsLike = Pick<URLSearchParams, "get">;

export function parseNotebookParams(params: ParamsLike, knownSkillIds?: ReadonlySet<ID>): NotebookParams {
  const show = params.get("show");
  const skills = [
    ...new Set(
      (params.get("skill") ?? "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_SKILLS);
  return {
    query: (params.get("q") ?? "").slice(0, MAX_QUERY_LENGTH),
    show: (NOTEBOOK_SHOW as readonly string[]).includes(show ?? "") ? (show as NotebookShow) : "all",
    skills: knownSkillIds ? skills.filter((id) => knownSkillIds.has(id)) : skills,
    due: params.get("due") === "1",
    note: params.get("note") || null,
  };
}

/** The query string without "?" ("" when everything is default). */
export function serializeNotebookParams(state: NotebookParams): string {
  const params = new URLSearchParams();
  const query = state.query.trim();
  if (query) params.set("q", query);
  if (state.show !== "all") params.set("show", state.show);
  if (state.skills.length > 0) params.set("skill", state.skills.join(","));
  if (state.due) params.set("due", "1");
  if (state.note) params.set("note", state.note);
  // Keep commas readable in shared links.
  return params.toString().replaceAll("%2C", ",");
}

export function hasActiveFilters(filters: NotebookFilters): boolean {
  return filters.query.trim() !== "" || filters.show !== "all" || filters.skills.length > 0 || filters.due;
}

/** Clears search, source, skills and Due; keeps the selected note. */
export const clearNotebookFilters = (state: NotebookParams): NotebookParams => ({ ...DEFAULT_NOTEBOOK_PARAMS, note: state.note });
