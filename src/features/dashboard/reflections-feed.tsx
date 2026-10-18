"use client";

import { EmptyHint, Section } from "@/components/app/section";
import { latestNotes } from "@/lib/domain/notes";
import type { NoteKind } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import { useMaterialMap, useNotes } from "@/lib/store/hooks";

const KIND_LABELS: Record<NoteKind, string> = { summary: "summary", item_note: "notes", free: "note" };

/** Latest summaries and notes (D-5), read from the Notebook's notes. */
export function ReflectionsFeed() {
  const notes = latestNotes(useNotes(), 5);
  const materials = useMaterialMap();

  return (
    <Section title="Notes & summaries" description="Latest first" className="h-full">
      {notes.length === 0 ? (
        <EmptyHint>Summaries you write in your own words will show up here.</EmptyHint>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => {
            const source =
              note.kind === "free"
                ? note.title?.trim() || "Untitled note"
                : (materials.get(note.materialId ?? "")?.title ?? "Removed material");
            return (
              <li key={note.id} className="text-sm">
                <p className="font-medium">
                  {source}{" "}
                  <span className="font-normal text-muted-foreground">
                    · {KIND_LABELS[note.kind]} · {formatShortDate(note.updatedAt)}
                  </span>
                </p>
                <p className="line-clamp-2 text-muted-foreground">{note.body}</p>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}
