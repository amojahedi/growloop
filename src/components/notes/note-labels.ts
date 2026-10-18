import { addDays, toDayKey, type DayKey } from "@/lib/domain/dates";
import type { ID, Material, Note, NoteKind } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";

/**
 * Display helpers shared by the card drawer, the Notebook and the dashboard
 * (notebook.md, dashboard.md §Due for review). Pure, so they are unit-tested.
 */

/** "Summary" for summaries; card notes and free notes are both "Note". */
export function noteKindLabel(kind: NoteKind): string {
  return kind === "summary" ? "Summary" : "Note";
}

/** Where a note comes from: its material's title for card notes, its own title for free notes. */
export function noteSource(note: Note, materials: ReadonlyMap<ID, Material>): string {
  if (note.kind === "free") return note.title?.trim() || "Untitled note";
  return materials.get(note.materialId ?? "")?.title ?? "Removed material";
}

/** A due date in the dashboard widget: "today", "yesterday" or "Oct 12". */
export function dueDayLabel(reviewAt: string, today: DayKey): string {
  const day = toDayKey(reviewAt);
  if (day === today) return "today";
  if (day === addDays(today, -1)) return "yesterday";
  return formatShortDate(day);
}

/** The due chip on a Notebook list item: "Due today" or "Due Oct 25". */
export function dueChipLabel(reviewAt: string, today: DayKey): string {
  const day = toDayKey(reviewAt);
  return day === today ? "Due today" : `Due ${formatShortDate(day)}`;
}

/** The Review later trigger once a date is set: "Review Oct 25". */
export function reviewLabel(reviewAt: string): string {
  return `Review ${formatShortDate(toDayKey(reviewAt))}`;
}

// --- Links in plain text (ADR 010: bodies are plain text; links are clickable when displayed) ---

export type TextSegment = { kind: "text"; text: string } | { kind: "link"; text: string; href: string };

const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"']+/gi;
/** Punctuation that usually ends a sentence rather than a URL. */
const TRAILING_PUNCTUATION = ".,;:!?]}'\"";

const count = (text: string, char: string) => text.split(char).length - 1;

/** Drops sentence punctuation after a URL, and closing brackets it didn't open ("(see https://x.com/a)"). */
function trimUrl(url: string): string {
  let trimmed = url;
  while (trimmed.length > 0) {
    const last = trimmed[trimmed.length - 1];
    if (last === ")" ? count(trimmed, ")") <= count(trimmed, "(") : !TRAILING_PUNCTUATION.includes(last)) break;
    trimmed = trimmed.slice(0, -1);
  }
  return trimmed;
}

/**
 * Splits plain text into text and link segments. Only http(s) and "www."
 * addresses become links, so `javascript:` and other schemes stay text.
 */
export function linkify(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  let last = 0;
  for (const match of text.matchAll(URL_PATTERN)) {
    const start = match.index;
    const url = trimUrl(match[0]);
    if (start > last) segments.push({ kind: "text", text: text.slice(last, start) });
    segments.push({ kind: "link", text: url, href: /^www\./i.test(url) ? `https://${url}` : url });
    last = start + url.length;
  }
  if (last < text.length) segments.push({ kind: "text", text: text.slice(last) });
  return segments;
}
