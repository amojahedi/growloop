"use client";

import Link from "next/link";
import { EmptyHint, Section } from "@/components/app/section";
import { dueDayLabel, noteKindLabel, noteSource } from "@/components/notes/note-labels";
import { useDueNotes, useMaterialMap, useToday } from "@/lib/store/hooks";

/** How many due notes the widget lists before "{n} more". */
export const DUE_WIDGET_LIMIT = 3;

/**
 * Due for review (D-5, dashboard.md §New widget): the 3 oldest due notes, each
 * opening in the Notebook, then "{n} more" for the Notebook's Due filter.
 */
export function DueForReviewWidget() {
  const due = useDueNotes();
  const materials = useMaterialMap();
  const today = useToday();
  const shown = due.slice(0, DUE_WIDGET_LIMIT);
  const more = due.length - shown.length;

  return (
    <Section title="Due for review" className="h-full">
      {due.length === 0 ? (
        <EmptyHint>Nothing to review. Mark a note Review later to see it here.</EmptyHint>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-2.5">
            {shown.map((note) => (
              <li key={note.id} className="text-sm">
                <Link
                  href={`/notebook?note=${encodeURIComponent(note.id)}`}
                  className="block rounded-md font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {noteSource(note, materials)}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {noteKindLabel(note.kind)} · Due {dueDayLabel(note.reviewAt!, today)}
                </p>
              </li>
            ))}
          </ul>
          {more > 0 && (
            <Link href="/notebook?due=1" className="self-start text-sm font-medium text-primary underline-offset-4 hover:underline">
              {more} more
            </Link>
          )}
        </div>
      )}
    </Section>
  );
}
