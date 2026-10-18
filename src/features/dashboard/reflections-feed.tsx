"use client";

import Link from "next/link";
import { EmptyHint, Section } from "@/components/app/section";
import { noteKindLabel, noteSource } from "@/components/notes/note-labels";
import { NoteText } from "@/components/notes/note-text";
import { Button } from "@/components/ui/button";
import { latestNotes } from "@/lib/domain/notes";
import { formatShortDate } from "@/lib/format";
import { useMaterialMap, useNotes } from "@/lib/store/hooks";

/** Notes & summaries (D-5): the latest 5 Notebook notes of every kind, each opening in the Notebook. */
export function ReflectionsFeed() {
  const notes = latestNotes(useNotes(), 5);
  const materials = useMaterialMap();

  return (
    <Section
      title="Notes & summaries"
      description="Latest first"
      className="h-full"
      action={
        <Button asChild variant="ghost" size="sm">
          <Link href="/notebook">View all</Link>
        </Button>
      }
    >
      {notes.length === 0 ? (
        <EmptyHint>Summaries you write land here.</EmptyHint>
      ) : (
        <ul className="flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="text-sm">
              <p>
                <span className="text-muted-foreground">{noteKindLabel(note.kind)} · </span>
                <Link
                  href={`/notebook?note=${encodeURIComponent(note.id)}`}
                  className="rounded-sm font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {noteSource(note, materials)}
                </Link>
                <span className="text-muted-foreground"> · {formatShortDate(note.updatedAt)}</span>
              </p>
              {note.body.trim() && <NoteText text={note.body} className="line-clamp-2 font-display text-muted-foreground" />}
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
