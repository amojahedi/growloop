"use client";

import { cn } from "cn";
import { NotebookPenIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { hasContent } from "@/lib/domain/notes";
import type { ID } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";
import { useDueNotes, useMaterialMap, useNotes, useSkills, useToday } from "@/lib/store/hooks";
import type { FilterGroup } from "../library/filter-groups";
import { FilterPopover } from "../library/filter-popover";
import { NoteList } from "./note-list";
import { NotePane } from "./note-pane";
import { filterNotes } from "./notebook-list";
import { clearNotebookFilters, hasActiveFilters, NOTEBOOK_SHOW, type NotebookShow } from "./notebook-params";
import { NotebookSearch } from "./notebook-search";
import { createNoteAndOpen, useNotebookParams } from "./use-notebook-params";

/** Below 1024 px the Notebook shows one pane at a time. Optional call: jsdom has no matchMedia. */
const isSinglePane = () => !(window.matchMedia?.("(min-width: 1024px)").matches ?? false);

const SHOW_LABELS: Record<NotebookShow, string> = { all: "All", summaries: "Summaries", notes: "Notes" };

/** Deletes a free note that was left without a title and a body (notebook.md §New note). */
function discardIfEmpty(id: ID) {
  const { data, deleteNote } = useAppStore.getState();
  const note = data.notes.find((candidate) => candidate.id === id);
  if (note && note.kind === "free" && !hasContent(note)) deleteNote(id);
}

/**
 * The Notebook (`/notebook`, N-1 to N-5): everything the user has written,
 * searchable and filterable, in two panes from 1024 px (list · editor) and one
 * pane with back navigation below. Filters and the selected note live in the URL.
 */
export function NotebookView() {
  const notes = useNotes();
  const materials = useMaterialMap();
  const allSkills = useSkills({ includeHidden: true });
  const visibleSkills = useSkills();
  const today = useToday();
  const dueCount = useDueNotes().length;
  const knownSkillIds = useMemo(() => new Set(allSkills.map((skill) => skill.id)), [allSkills]);
  const skillMap = useMemo(() => new Map(allSkills.map((skill) => [skill.id, skill])), [allSkills]);
  const { params, update } = useNotebookParams(knownSkillIds);
  const selected = params.note;

  const listed = useMemo(
    () =>
      filterNotes(notes, params, {
        today,
        include: selected,
        materialTitle: (note) => (note.materialId ? materials.get(note.materialId)?.title : undefined),
      }),
    [notes, params, today, selected, materials],
  );
  const anyWritten = notes.some(hasContent);

  useDiscardEmptyNote(selected);

  const skillGroup: FilterGroup = {
    category: "skills",
    label: "Skills",
    chipLabel: "Skill",
    options: visibleSkills.map((skill) => ({ value: skill.id, label: skill.name, color: skill.color })),
  };

  // In one pane the list and the editor replace each other, so focus follows: editor on open, list on back.
  const rootRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<"pane" | "list" | null>(null);
  useEffect(() => {
    const target = pendingFocus.current;
    pendingFocus.current = null;
    const root = rootRef.current;
    if (!target || !root) return;
    const element =
      target === "pane"
        ? root.querySelector<HTMLElement>("[data-note-pane]")
        : (root.querySelector<HTMLElement>("[role=listbox]") ?? root.querySelector<HTMLElement>("input[type=search]"));
    element?.focus();
  }, [selected]);

  const open = (id: ID) => {
    if (isSinglePane()) pendingFocus.current = "pane";
    update((current) => ({ ...current, note: id }));
  };
  const leave = () => {
    pendingFocus.current = "list";
    update((current) => ({ ...current, note: null }));
  };

  let listContent: React.ReactNode;
  if (!anyWritten && listed.length === 0) {
    listContent = (
      <EmptyState>
        <p className="font-medium text-foreground">Your notebook is empty.</p>
        <p>Summaries you write on cards land here automatically.</p>
        <Button size="sm" className="mt-2" onClick={createNoteAndOpen}>
          <PlusIcon aria-hidden />
          New note
        </Button>
      </EmptyState>
    );
  } else if (listed.length === 0 && params.due && dueCount === 0) {
    listContent = <EmptyState>Nothing due. Nice.</EmptyState>;
  } else if (listed.length === 0) {
    listContent = (
      <EmptyState>
        <p>No notes match.</p>
        <Button variant="outline" size="sm" className="mt-2" onClick={() => update(clearNotebookFilters)}>
          Clear filters
        </Button>
      </EmptyState>
    );
  } else {
    listContent = <NoteList notes={listed} selectedId={selected} onOpen={open} materials={materials} skills={skillMap} today={today} />;
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-4">
      <div className={cn("flex flex-wrap items-center gap-2", selected && "hidden lg:flex")} role="search" aria-label="Filter notes">
        <NotebookSearch value={params.query} onCommit={(query) => update((current) => ({ ...current, query }), { replace: true })} />
        <div role="group" aria-label="Show" className="flex items-center gap-1">
          {NOTEBOOK_SHOW.map((show) => (
            <Chip key={show} pressed={params.show === show} onClick={() => update((current) => ({ ...current, show }))}>
              {SHOW_LABELS[show]}
            </Chip>
          ))}
        </div>
        <Chip pressed={params.due} onClick={() => update((current) => ({ ...current, due: !current.due }))}>
          {dueCount > 0 ? `Due ${dueCount}` : "Due"}
        </Chip>
        <FilterPopover
          group={skillGroup}
          selected={params.skills}
          onToggle={(id) =>
            update((current) => ({
              ...current,
              skills: current.skills.includes(id) ? current.skills.filter((other) => other !== id) : [...current.skills, id],
            }))
          }
        />
        {hasActiveFilters(params) && (
          <Button variant="link" size="xs" onClick={() => update(clearNotebookFilters)}>
            Clear filters
          </Button>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-[22.5rem_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className={cn(selected && "hidden lg:block")}>{listContent}</div>
        <div className={cn("lg:sticky lg:top-4", !selected && "hidden lg:block")}>
          {selected ? (
            <NotePane key={selected} noteId={selected} onBack={leave} onLeave={leave} />
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              <NotebookPenIcon aria-hidden className="size-5" />
              <p>Pick a note to read or edit it.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * A new free note left with no title and no body is discarded silently when
 * the user moves to another note or leaves the page. The check waits a tick,
 * so the editors' own unmount saves land first (and React's development
 * double-mount doesn't discard a note that's still open).
 */
function useDiscardEmptyNote(selected: ID | null) {
  const previous = useRef<ID | null>(selected);
  const mounted = useRef(false);

  useEffect(() => {
    const last = previous.current;
    previous.current = selected;
    if (last && last !== selected) setTimeout(() => discardIfEmpty(last), 0);
  }, [selected]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      const last = previous.current;
      setTimeout(() => {
        if (!mounted.current && last) discardIfEmpty(last);
      }, 0);
    };
  }, []);
}

function Chip({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        pressed ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-xl border bg-card p-6 text-sm text-muted-foreground">{children}</div>
  );
}
