import type { DayKey } from "@/lib/domain/dates";
import { toDayKey } from "@/lib/domain/dates";
import { hasContent, isDue, noteMatches } from "@/lib/domain/notes";
import type { ID, Note } from "@/lib/domain/types";
import type { NotebookFilters } from "./notebook-params";

/**
 * The Notebook list (notebook.md §Layout): written notes that pass every
 * filter, newest updated first; with Due on, oldest due first. Search, source,
 * skills and Due combine.
 */
export function filterNotes(
  notes: readonly Note[],
  filters: NotebookFilters,
  {
    today,
    materialTitle,
    include,
  }: {
    today: DayKey;
    /** A card note's material title, for search. */
    materialTitle: (note: Note) => string | undefined;
    /** A note to list even while empty: the free note just created, until it is discarded. */
    include?: ID | null;
  },
): Note[] {
  const pinned = include ? notes.find((note) => note.id === include && note.kind === "free" && !hasContent(note)) : undefined;
  const listed = notes.filter((note) => {
    if (!hasContent(note)) return false;
    if (filters.show === "summaries" && note.kind !== "summary") return false;
    if (filters.show === "notes" && note.kind === "summary") return false;
    if (filters.skills.length > 0 && !note.skillIds.some((id) => filters.skills.includes(id))) return false;
    if (filters.due && !isDue(note, today)) return false;
    return noteMatches(note, filters.query, materialTitle(note));
  });

  listed.sort(
    filters.due
      ? (a, b) => toDayKey(a.reviewAt!).localeCompare(toDayKey(b.reviewAt!)) || b.updatedAt.localeCompare(a.updatedAt)
      : (a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id),
  );
  return pinned ? [pinned, ...listed] : listed;
}
