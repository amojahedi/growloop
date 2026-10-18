"use client";

import { cn } from "cn";
import { SparklesIcon } from "lucide-react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import { dueChipLabel, noteKindLabel, noteSource } from "@/components/notes/note-labels";
import { isDue } from "@/lib/domain/notes";
import type { ID, Material, Note, Skill } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import { skillColorVar } from "@/lib/theme/skill-colors";

/**
 * The Notebook list as a listbox (notebook.md §Acceptance): ↑/↓ move, Home/End
 * jump, Enter or Space opens; a click opens too. Focus stays on the listbox and
 * the active option is announced through aria-activedescendant.
 */
export function NoteList({
  notes,
  selectedId,
  onOpen,
  materials,
  skills,
  today,
}: {
  notes: readonly Note[];
  selectedId: ID | null;
  onOpen: (id: ID) => void;
  materials: ReadonlyMap<ID, Material>;
  skills: ReadonlyMap<ID, Skill>;
  today: string;
}) {
  const baseId = useId();
  const optionId = (id: ID) => `${baseId}-${id}`;
  const [activeId, setActiveId] = useState<ID | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  // The active option must be in the list; otherwise fall back to the selected one, then the first.
  const active = notes.find((note) => note.id === activeId) ?? notes.find((note) => note.id === selectedId) ?? notes[0];

  const moveTo = (index: number) => {
    const note = notes[Math.max(0, Math.min(index, notes.length - 1))];
    if (!note) return;
    setActiveId(note.id);
    // Optional call: not every environment implements scrollIntoView (e.g. jsdom).
    document.getElementById(optionId(note.id))?.scrollIntoView?.({ block: "nearest" });
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const index = active ? notes.indexOf(active) : -1;
    const keys: Record<string, () => void> = {
      ArrowDown: () => moveTo(index + 1),
      ArrowUp: () => moveTo(index - 1),
      Home: () => moveTo(0),
      End: () => moveTo(notes.length - 1),
      Enter: () => active && onOpen(active.id),
      " ": () => active && onOpen(active.id),
    };
    const handler = keys[event.key];
    if (!handler) return;
    event.preventDefault();
    handler();
  };

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Notes"
      tabIndex={0}
      aria-activedescendant={active ? optionId(active.id) : undefined}
      onKeyDown={onKeyDown}
      className="group/list flex flex-col gap-1 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {notes.map((note) => {
        const selected = note.id === selectedId;
        const due = isDue(note, today);
        const noteSkills = note.skillIds.flatMap((id) => skills.get(id) ?? []);
        return (
          <div
            key={note.id}
            id={optionId(note.id)}
            role="option"
            aria-selected={selected}
            onClick={() => {
              setActiveId(note.id);
              onOpen(note.id);
            }}
            className={cn(
              "flex cursor-pointer flex-col gap-1 rounded-lg border border-transparent px-3 py-2.5 text-sm hover:bg-muted/70",
              selected && "border-border bg-card shadow-xs",
              active?.id === note.id && "group-focus-visible/list:ring-2 group-focus-visible/list:ring-ring",
            )}
          >
            <div className="flex items-baseline gap-2">
              <p className="min-w-0 flex-1 truncate">
                <span className="text-muted-foreground">{noteKindLabel(note.kind)} · </span>
                <span className="font-medium">{noteSource(note, materials)}</span>
              </p>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatShortDate(note.updatedAt)}</span>
            </div>
            {note.body.trim() && <p className="line-clamp-2 font-display text-muted-foreground">{note.body}</p>}
            {(noteSkills.length > 0 || note.refinedAt || due || note.reviewAt) && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                {noteSkills.map((skill) => (
                  <span key={skill.id} className="inline-flex items-center gap-1 text-muted-foreground">
                    <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: skillColorVar(skill.color) }} />
                    {skill.name}
                  </span>
                ))}
                {note.refinedAt && (
                  <span className="inline-flex items-center gap-0.5 text-brand-soft-foreground">
                    <SparklesIcon aria-hidden className="size-3" />
                    Refined
                  </span>
                )}
                {note.reviewAt && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium",
                      due ? "bg-brand-soft text-brand-soft-foreground" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {dueChipLabel(note.reviewAt, today)}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
