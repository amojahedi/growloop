import { addDays, dayKey, toDayKey, type DayKey } from "./dates";
import { createId } from "./ids";
import type { CardNoteKind, ID, Note, PlanItem } from "./types";

/**
 * Notes (ADR 010, docs/product/specs/notebook.md): card summaries, card notes
 * and free notes, all plain text. Pure helpers for the Notebook, the card
 * drawer and the dashboard.
 */

export const MAX_FREE_NOTE_SKILLS = 3;

/**
 * Whether a note shows up anywhere (Notebook, widgets, badge). Card notes are
 * kept when their text is cleared, so their id and review date survive a
 * rewrite, but they only appear while they have text.
 */
export function hasContent(note: Note): boolean {
  return note.body.trim() !== "" || (note.kind === "free" && (note.title ?? "").trim() !== "");
}

export const listedNotes = (notes: readonly Note[]): Note[] => notes.filter(hasContent);

const byUpdatedDesc = (a: Note, b: Note) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);

/** Latest written notes of every kind, newest first (dashboard "Notes & summaries"). */
export function latestNotes(notes: readonly Note[], limit = 5): Note[] {
  return listedNotes(notes).sort(byUpdatedDesc).slice(0, limit);
}

/** Due when its review day has come (N-3). */
export function isDue(note: Note, today: DayKey): boolean {
  return note.reviewAt !== undefined && toDayKey(note.reviewAt) <= today && hasContent(note);
}

/** Due notes, oldest due first (the widget shows the first three). */
export function dueNotes(notes: readonly Note[], today: DayKey): Note[] {
  return notes
    .filter((note) => isDue(note, today))
    .sort((a, b) => toDayKey(a.reviewAt!).localeCompare(toDayKey(b.reviewAt!)) || byUpdatedDesc(a, b));
}

export type ReviewPreset = "tomorrow" | "week" | "month";

/** The review day for "Tomorrow · In a week · In a month". */
export function reviewDay(preset: ReviewPreset, today: DayKey): DayKey {
  if (preset === "tomorrow") return addDays(today, 1);
  if (preset === "week") return addDays(today, 7);
  const [year, month, day] = today.split("-").map(Number);
  // Same day next month, clamped to its last day (Jan 31 → Feb 28).
  const lastDay = new Date(year, month + 1, 0).getDate();
  return dayKey(new Date(year, month, Math.min(day, lastDay)));
}

// --- Search -------------------------------------------------------------------

/** Lower-cases and strips accents, so "resume" finds "Résumé". */
export function normalizeForSearch(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
}

/**
 * Whether a note matches a search query in its title, its material's title or
 * its body, ignoring case and accents. Every word must match somewhere.
 */
export function noteMatches(note: Note, query: string, materialTitle?: string): boolean {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = normalizeForSearch([note.title ?? "", materialTitle ?? "", note.body].join("\n"));
  return words.every((word) => haystack.includes(word));
}

// --- Card notes -----------------------------------------------------------------

/** A card's summary or its notes, if written before. */
export function findCardNote(notes: readonly Note[], itemId: ID, kind: CardNoteKind): Note | undefined {
  return notes.find((note) => note.kind === kind && note.planItemId === itemId);
}

/** Whether a card has a written summary (the dashboard's "summarized" count). */
export function isSummarized(itemId: ID, notes: readonly Note[]): boolean {
  const summary = findCardNote(notes, itemId, "summary");
  return summary !== undefined && hasContent(summary);
}

/** Ids of cards with a written summary. */
export function summarizedItemIds(notes: readonly Note[]): Set<ID> {
  return new Set(notes.flatMap((note) => (note.kind === "summary" && note.planItemId && hasContent(note) ? [note.planItemId] : [])));
}

/** A new card note; card notes follow the card's skills and keep its material for when the card is gone. */
export function createCardNote(item: PlanItem, kind: CardNoteKind, body: string, now: string): Note {
  return {
    id: createId(),
    kind,
    planItemId: item.id,
    materialId: item.materialId,
    body,
    skillIds: [...item.skillIds],
    createdAt: now,
    updatedAt: now,
  };
}

export interface NewFreeNote {
  title?: string;
  body?: string;
  skillIds?: ID[];
}

export function createFreeNote(input: NewFreeNote, now: string): Note {
  return {
    id: createId(),
    kind: "free",
    ...(input.title === undefined ? {} : { title: input.title }),
    body: input.body ?? "",
    skillIds: (input.skillIds ?? []).slice(0, MAX_FREE_NOTE_SKILLS),
    createdAt: now,
    updatedAt: now,
  };
}
