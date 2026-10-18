"use client";

import { CalendarClockIcon, ChevronDownIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { reviewDay, type ReviewPreset } from "@/lib/domain/notes";
import type { ID } from "@/lib/domain/types";
import { useActions, useToday } from "@/lib/store/hooks";
import { ESCAPE_LOCAL } from "./escape-local";
import { reviewLabel } from "./note-labels";

export const REVIEW_PRESETS: readonly { preset: ReviewPreset; label: string }[] = [
  { preset: "tomorrow", label: "Tomorrow" },
  { preset: "week", label: "In a week" },
  { preset: "month", label: "In a month" },
];

const isDayKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * "Review later ▾" (N-3): Tomorrow · In a week · In a month · Pick a date….
 * Once set it reads "Review Oct 25" with Clear. A card note that has no text
 * yet has no record, so the menu waits until there is something to review.
 */
export function ReviewLaterMenu({
  noteId,
  reviewAt,
  subject = "this note",
}: {
  /** The note to schedule; undefined while a card note has no text yet. */
  noteId: ID | undefined;
  reviewAt?: string;
  /** For accessible names, e.g. "your summary". */
  subject?: string;
}) {
  const today = useToday();
  const { setNoteReview } = useActions();
  const [picking, setPicking] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // While "Pick a date…" swaps the trigger for the date field, the closing menu must not move focus.
  const pickingRef = useRef(false);
  const disabled = noteId === undefined;

  const set = (day: string | null) => {
    if (noteId) setNoteReview(noteId, day);
  };

  const stopPicking = (returnFocus: boolean) => {
    pickingRef.current = false;
    setPicking(false);
    // The trigger comes back on the next render.
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  if (picking) {
    return (
      <Input
        type="date"
        {...ESCAPE_LOCAL}
        aria-label={`Review date for ${subject}`}
        className="h-7 w-40"
        min={today}
        defaultValue={reviewAt ?? ""}
        autoFocus
        onChange={(event) => {
          const value = event.target.value;
          if (isDayKey(value) && value >= today) set(value);
        }}
        onBlur={() => stopPicking(false)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Escape") {
            event.preventDefault();
            stopPicking(true);
          }
        }}
      />
    );
  }

  return (
    <span className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={disabled}>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            aria-label={reviewAt ? `${reviewLabel(reviewAt)}. Change the review date for ${subject}` : undefined}
            title={disabled ? "Write something first" : undefined}
          >
            <CalendarClockIcon aria-hidden />
            {reviewAt ? reviewLabel(reviewAt) : "Review later"}
            <ChevronDownIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-44"
          onCloseAutoFocus={(event) => {
            if (pickingRef.current) event.preventDefault();
          }}
        >
          {REVIEW_PRESETS.map(({ preset, label }) => (
            <DropdownMenuItem key={preset} onSelect={() => set(reviewDay(preset, today))}>
              {label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              pickingRef.current = true;
              setPicking(true);
            }}
          >
            Pick a date…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {reviewAt && (
        <Button variant="link" size="xs" className="px-1" aria-label={`Clear the review date for ${subject}`} onClick={() => set(null)}>
          Clear
        </Button>
      )}
    </span>
  );
}
