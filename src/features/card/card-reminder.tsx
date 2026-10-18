"use client";

import { PlusIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { ESCAPE_LOCAL } from "@/components/notes/escape-local";
import { SavedHint } from "@/components/notes/note-editor";
import { useAutosave } from "@/components/notes/use-autosave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PlanItem } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import { useActions, useToday } from "@/lib/store/hooks";
import { CardSection } from "./card-section";

/** card-detail.md §Reminder: a one-line note of at most 120 characters. */
export const MAX_REMINDER_NOTE = 120;

const isDayKey = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * Reminder (C-4): a date (today or later) and a one-line note, shown on the
 * dashboard's Reminders widget. Autosaves like everything else; Done only
 * closes the fields. Read-only cards show it without controls.
 */
export function CardReminder({ item, readOnly }: { item: PlanItem; readOnly: boolean }) {
  const { setReminder } = useActions();
  const [editing, setEditing] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const reminder = item.reminder;

  if (readOnly && !reminder) return null;

  const stopEditing = () => {
    setEditing(false);
    requestAnimationFrame(() => addRef.current?.focus());
  };

  return (
    <CardSection title="Reminder">
      {editing && !readOnly ? (
        <ReminderFields item={item} onDone={stopEditing} />
      ) : reminder ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span>
            <span className="font-medium">{formatShortDate(reminder.date)}</span>
            {reminder.note && <span className="text-muted-foreground"> · {reminder.note}</span>}
          </span>
          {!readOnly && (
            <span className="flex items-center gap-1">
              <Button ref={addRef} variant="link" size="xs" className="px-1" aria-label="Edit reminder" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button variant="link" size="xs" className="px-1" aria-label="Clear reminder" onClick={() => setReminder(item.id, undefined)}>
                Clear
              </Button>
            </span>
          )}
        </div>
      ) : (
        <Button ref={addRef} variant="ghost" size="sm" className="self-start text-muted-foreground" onClick={() => setEditing(true)}>
          <PlusIcon aria-hidden />
          Add reminder
        </Button>
      )}
    </CardSection>
  );
}

function ReminderFields({ item, onDone }: { item: PlanItem; onDone: () => void }) {
  const { setReminder } = useActions();
  const today = useToday();
  const dateId = useId();
  const noteId = useId();
  const [date, setDate] = useState(item.reminder?.date ?? "");
  const validDate = isDayKey(date) && date >= today ? date : undefined;

  // The note autosaves once there is a date to attach it to.
  const [initialNote] = useState(item.reminder?.note ?? "");
  const note = useAutosave(initialNote, (text) => {
    if (validDate) setReminder(item.id, { date: validDate, note: text.trim() });
  });

  return (
    <div className="flex flex-col gap-2">
      <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
        <div className="flex flex-col gap-1">
          <label htmlFor={dateId} className="text-xs font-medium text-muted-foreground">
            Date
          </label>
          <Input
            id={dateId}
            {...ESCAPE_LOCAL}
            type="date"
            min={today}
            value={date}
            autoFocus
            required
            onChange={(event) => {
              const next = event.target.value;
              setDate(next);
              if (isDayKey(next) && next >= today) setReminder(item.id, { date: next, note: note.draft.trim() });
            }}
            onKeyDown={(event) => event.key === "Escape" && onDone()}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={noteId} className="text-xs font-medium text-muted-foreground">
            Note <span className="font-normal">(optional)</span>
          </label>
          <Input
            id={noteId}
            {...ESCAPE_LOCAL}
            maxLength={MAX_REMINDER_NOTE}
            placeholder="Finish the strategy section"
            value={note.draft}
            onChange={(event) => note.change(event.target.value)}
            onBlur={note.flush}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === "Escape") {
                note.flush();
                onDone();
              }
            }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            note.flush();
            onDone();
          }}
        >
          Done
        </Button>
        {date && !validDate && <p className="text-xs text-destructive">Pick today or a later date.</p>}
        <SavedHint saved={note.saved} />
      </div>
    </div>
  );
}
