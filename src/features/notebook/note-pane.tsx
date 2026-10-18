"use client";

import { ArrowLeftIcon, ArrowRightIcon, ChevronDownIcon, EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { NoteEditor, SavedHint } from "@/components/notes/note-editor";
import { noteKindLabel, noteSource } from "@/components/notes/note-labels";
import { RefinePanel } from "@/components/notes/refine-panel";
import { REVIEW_PRESETS, ReviewLaterMenu } from "@/components/notes/review-later-menu";
import { useAutosave } from "@/components/notes/use-autosave";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { hasContent, isDue, MAX_FREE_NOTE_SKILLS, reviewDay, type ReviewPreset } from "@/lib/domain/notes";
import type { ID, Note, Skill } from "@/lib/domain/types";
import { useActions, useMaterialMap, useNote, usePlanItems, useSkills, useToday } from "@/lib/store/hooks";
import { skillColorVar } from "@/lib/theme/skill-colors";

const AGAIN_TOASTS: Record<ReviewPreset, string> = {
  tomorrow: "Nice. See you tomorrow.",
  week: "Nice. See you in a week.",
  month: "Nice. See you in a month.",
};

/**
 * The Notebook's reader/editor (notebook.md §Editor): the same NoteEditor as
 * the card. Card notes link back to their card; summaries offer Get feedback;
 * free notes add a title and up to 3 skills. Never read-only.
 */
export function NotePane({ noteId, onBack, onLeave }: { noteId: ID; onBack: () => void; onLeave: () => void }) {
  const note = useNote(noteId);

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" size="sm" className="self-start lg:hidden" onClick={onBack}>
        <ArrowLeftIcon aria-hidden />
        All notes
      </Button>
      {note ? (
        <NoteEditorPane note={note} onLeave={onLeave} />
      ) : (
        <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">That note is gone.</p>
      )}
    </div>
  );
}

function NoteEditorPane({ note, onLeave }: { note: Note; onLeave: () => void }) {
  const materials = useMaterialMap();
  const today = useToday();
  const { updateNote } = useActions();
  const material = note.materialId ? materials.get(note.materialId) : undefined;
  const source = noteSource(note, materials);
  // A new, untouched free note opens with the cursor in its title.
  const [isNew] = useState(() => note.kind === "free" && !hasContent(note));
  const isCardNote = note.kind !== "free";

  return (
    <article
      data-note-pane
      tabIndex={-1}
      aria-label={`${noteKindLabel(note.kind)}: ${source}`}
      className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:p-6"
    >
      <header className="flex items-start gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {isCardNote ? (
            <>
              <p className="text-xs text-muted-foreground">{noteKindLabel(note.kind)}</p>
              <h2 className="font-display text-xl leading-snug font-semibold">
                {source}
                {material?.author && <span className="font-sans text-sm font-normal text-muted-foreground"> · {material.author}</span>}
              </h2>
              <CardLink planItemId={note.planItemId} />
            </>
          ) : (
            <FreeNoteTitle note={note} autoFocus={isNew} />
          )}
        </div>
        <NoteMenu note={note} onLeave={onLeave} />
      </header>

      {isDue(note, today) && <DueBar noteId={note.id} />}

      <NoteEditor
        label={note.kind === "summary" ? "Summary" : "Note"}
        hideLabel
        toolbar="footer"
        value={note.body}
        onSave={(body) => updateNote(note.id, { body })}
        placeholder={note.kind === "summary" ? "What's the one idea you'll use?" : "Write anything worth keeping…"}
        textareaClassName="min-h-40 border-transparent bg-transparent px-0 font-display text-base shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
        actions={
          <>
            {note.kind === "free" ? <SkillsPicker note={note} /> : <SkillDots skillIds={note.skillIds} />}
            <ReviewLaterMenu noteId={hasContent(note) ? note.id : undefined} reviewAt={note.reviewAt} />
          </>
        }
      >
        {(editor) =>
          note.kind === "summary" && note.planItemId ? (
            <RefinePanel
              itemId={note.planItemId}
              summary={editor.draft}
              flush={editor.flush}
              material={{ title: source, author: material?.author, brief: material?.summary }}
            />
          ) : null
        }
      </NoteEditor>
    </article>
  );
}

function CardLink({ planItemId }: { planItemId?: ID }) {
  const exists = usePlanItems().some((item) => item.id === planItemId);
  if (!planItemId || !exists) return <p className="text-sm text-muted-foreground">Card removed</p>;
  return (
    <Link
      href={`/board?item=${encodeURIComponent(planItemId)}`}
      className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      Open card
      <ArrowRightIcon aria-hidden className="size-3.5" />
    </Link>
  );
}

function FreeNoteTitle({ note, autoFocus }: { note: Note; autoFocus: boolean }) {
  const { updateNote } = useActions();
  const title = useAutosave(note.title ?? "", (text) => updateNote(note.id, { title: text }));
  return (
    <div className="flex items-center gap-2">
      <Input
        aria-label="Title"
        placeholder="Untitled note"
        autoFocus={autoFocus}
        value={title.draft}
        onChange={(event) => title.change(event.target.value)}
        onBlur={title.flush}
        className="h-auto border-transparent bg-transparent px-0 font-display text-xl font-semibold shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent"
      />
      <SavedHint saved={title.saved} />
    </div>
  );
}

/** "Due for review" [Reviewed] [Again ▾]: Reviewed clears the date; Again sets a new one. */
function DueBar({ noteId }: { noteId: ID }) {
  const { markNoteReviewed, setNoteReview } = useActions();
  const today = useToday();
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-soft px-3 py-2 text-sm text-brand-soft-foreground">
      <span className="mr-auto font-medium">Due for review</span>
      <Button
        size="xs"
        onClick={(event) => {
          // The bar goes away with its buttons; keep focus in the note.
          const pane = event.currentTarget.closest("[data-note-pane]");
          markNoteReviewed(noteId);
          requestAnimationFrame(() => pane?.querySelector<HTMLElement>("textarea")?.focus());
        }}
      >
        Reviewed
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="xs">
            Again
            <ChevronDownIcon aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          {REVIEW_PRESETS.map(({ preset, label }) => (
            <DropdownMenuItem
              key={preset}
              onSelect={() => {
                setNoteReview(noteId, reviewDay(preset, today));
                toast({ message: AGAIN_TOASTS[preset] });
              }}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** ⋯ → Delete for free notes; ⋯ → Clear for card notes (empties the text, so it leaves the Notebook). Both undoable. */
function NoteMenu({ note, onLeave }: { note: Note; onLeave: () => void }) {
  const { deleteNote, updateNote, restoreNote } = useActions();
  const isFree = note.kind === "free";

  const act = () => {
    const previous = note;
    if (isFree) deleteNote(note.id);
    else updateNote(note.id, { body: "" });
    // Undo puts back a deleted note whole, but only a cleared note's text, so changes made since are kept.
    const undo = () => (isFree ? restoreNote(previous) : updateNote(previous.id, { body: previous.body }));
    onLeave();
    toast({
      message: isFree ? "Note deleted" : note.kind === "summary" ? "Summary cleared" : "Note cleared",
      action: { label: "Undo", onClick: undo },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Note actions">
          <EllipsisIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuItem variant="destructive" onSelect={act}>
          {isFree ? "Delete" : "Clear"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Card notes follow their card's skills, so they're shown, not picked. */
function SkillDots({ skillIds }: { skillIds: readonly ID[] }) {
  const skills = useSkillMap();
  const list = skillIds.flatMap((id) => skills.get(id) ?? []);
  if (list.length === 0) return null;
  return (
    <span className="mr-auto flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      {list.map((skill) => (
        <span key={skill.id} className="inline-flex items-center gap-1">
          <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: skillColorVar(skill.color) }} />
          {skill.name}
        </span>
      ))}
    </span>
  );
}

/** Free notes: 0–3 skills of the user's choosing. */
function SkillsPicker({ note }: { note: Note }) {
  const { updateNote } = useActions();
  const skills = useSkills();
  const byId = useSkillMap();
  const chosen = note.skillIds.flatMap((id) => byId.get(id) ?? []);
  const full = note.skillIds.length >= MAX_FREE_NOTE_SKILLS;

  const toggle = (id: ID) =>
    updateNote(note.id, {
      skillIds: note.skillIds.includes(id) ? note.skillIds.filter((other) => other !== id) : [...note.skillIds, id].slice(0, MAX_FREE_NOTE_SKILLS),
    });

  return (
    <span className="mr-auto flex flex-wrap items-center gap-2">
      <SkillDots skillIds={chosen.map((skill) => skill.id)} />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="xs" className="text-muted-foreground" aria-label="Choose skills for this note">
            Skills
            <ChevronDownIcon aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64">
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">Skills (up to {MAX_FREE_NOTE_SKILLS})</legend>
            <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
              {skills.map((skill) => {
                const checked = note.skillIds.includes(skill.id);
                return (
                  <label key={skill.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      checked={checked}
                      disabled={!checked && full}
                      onChange={() => toggle(skill.id)}
                    />
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: skillColorVar(skill.color) }} />
                    <span className="truncate">{skill.name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        </PopoverContent>
      </Popover>
    </span>
  );
}

function useSkillMap(): ReadonlyMap<ID, Skill> {
  const skills = useSkills({ includeHidden: true });
  return new Map(skills.map((skill) => [skill.id, skill]));
}
