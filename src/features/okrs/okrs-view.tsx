"use client";

import { cn } from "cn";
import { ArchiveIcon, TargetIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs } from "radix-ui";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { compareQuarters, formatQuarter, quarterOfDay, yearOf, type DayKey } from "@/lib/domain/dates";
import { activeObjectives, isLinkable, isPlannable, plannableQuarters, roomInYear, wizardScope } from "@/lib/domain/okrs";
import type { Objective, QuarterKey } from "@/lib/domain/types";
import { useActions, useArchivedYears, useObjectives, usePlanItems, useToday } from "@/lib/store/hooks";
import {
  blankObjective,
  fieldIds,
  formFromObjective,
  newKeyResultsFrom,
  objectiveProblems,
  yearCapProblems,
  type ObjectiveForm,
} from "./editor-model";
import { focusSoon } from "./focus";
import { ObjectiveCard } from "./objective-card";
import { ObjectiveEditor } from "./objective-editor";
import { ObjectiveMenu } from "./objective-menu";
import { AddObjectiveButton, EmptyQuarter, QuarterColumn, QuarterGrid, quartersOf } from "./quarter-grid";
import { useEditorData } from "./use-editor-data";

/**
 * The OKR page (okrs-and-wizard.md §3, O-8): year tabs (each unarchived year
 * with objectives or in the plannable window, then Archive), Q1–Q4 columns,
 * objective cards with computed progress and pace, and the shared
 * ObjectiveEditor for adding and editing.
 */

const ARCHIVE_TAB = "archive";
const PLAN_PATH = "/okrs/plan";
const addButtonId = (quarter: QuarterKey) => `add-objective-${quarter}`;
const tabId = (value: string) => `okrs-tab-${value}`;
const PLAN_LINK_ID = "okrs-plan-my-year";

/** The year tabs, in order: unarchived years with objectives or in the plannable window, then Archive. */
export function yearTabs(objectives: readonly Objective[], archivedYears: readonly number[], today: DayKey): string[] {
  const years = new Set(plannableQuarters(today).map(yearOf));
  for (const objective of objectives) years.add(yearOf(objective.quarter));
  const open = [...years].filter((year) => !archivedYears.includes(year)).sort((a, b) => a - b);
  return [...open.map(String), ...(archivedYears.length > 0 ? [ARCHIVE_TAB] : [])];
}

/** The contextual header action: Plan my year · Fill empty quarters · nothing. */
export function OkrsHeaderAction() {
  const objectives = useObjectives();
  const today = useToday();
  const label =
    objectives.length === 0 ? "Plan my year" : wizardScope(objectives, today).length > 0 ? "Fill empty quarters" : undefined;
  if (!label) return null;
  return (
    <Button asChild>
      <Link href={PLAN_PATH}>{label}</Link>
    </Button>
  );
}

type Editing = { kind: "new"; form: ObjectiveForm } | { kind: "edit"; id: string; form: ObjectiveForm };

export function OkrsView() {
  const objectives = useObjectives();
  const archivedYears = useArchivedYears();
  const today = useToday();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tabs = useMemo(() => yearTabs(objectives, archivedYears, today), [objectives, archivedYears, today]);
  const currentYear = String(yearOf(today));
  const requested = searchParams.get("year");
  const selected = requested && tabs.includes(requested) ? requested : currentYear;

  const selectTab = (value: string) => router.replace(`${pathname}?year=${value}`, { scroll: false });

  return (
    <Tabs.Root value={selected} onValueChange={selectTab} className="flex flex-col gap-5">
      <Tabs.List aria-label="Years" className="inline-flex gap-0.5 self-start rounded-lg border bg-muted p-0.5">
        {tabs.map((tab) => (
          <Tabs.Trigger
            key={tab}
            id={tabId(tab)}
            value={tab}
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            {tab === ARCHIVE_TAB && <ArchiveIcon className="size-3.5" aria-hidden />}
            {tab === ARCHIVE_TAB ? "Archive" : tab}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      {tabs.map((tab) => (
        <Tabs.Content key={tab} value={tab} className="outline-none focus-visible:ring-3 focus-visible:ring-ring/50 rounded-lg">
          {tab === ARCHIVE_TAB ? (
            <ArchivePanel years={[...archivedYears].sort((a, b) => b - a)} />
          ) : (
            <YearPanel year={Number(tab)} isCurrentYear={tab === currentYear} onArchived={() => selectTab(ARCHIVE_TAB)} />
          )}
        </Tabs.Content>
      ))}
    </Tabs.Root>
  );
}

function YearPanel({ year, isCurrentYear, onArchived }: { year: number; isCurrentYear: boolean; onArchived: () => void }) {
  const objectives = useObjectives();
  const items = usePlanItems();
  const archivedYears = useArchivedYears();
  const today = useToday();
  const { addObjective, updateObjective, deleteObjective, restoreObjective, archiveYear } = useActions();
  const { materials, visibleSkills, lookup } = useEditorData();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [showAll, setShowAll] = useState(false);

  const nowQuarter = quarterOfDay(today);
  const inYear = objectives.filter((objective) => yearOf(objective.quarter) === year);
  const room = roomInYear(objectives, year);

  const startNew = (quarter: QuarterKey) => {
    const form = blankObjective(quarter);
    setEditing({ kind: "new", form });
    setShowAll(false);
    focusSoon(fieldIds.title(form));
  };
  const startEdit = (objective: Objective) => {
    const form = formFromObjective(objective, lookup);
    setEditing({ kind: "edit", id: objective.id, form });
    setShowAll(false);
    focusSoon(fieldIds.title(form));
  };
  const cancel = () => {
    if (!editing) return;
    focusSoon(editing.kind === "edit" ? fieldIds.menu(editing.form) : addButtonId(editing.form.quarter));
    setEditing(null);
  };
  const save = () => {
    if (!editing) return;
    const { form } = editing;
    const others = editing.kind === "edit" ? objectives.filter((o) => o.id !== editing.id) : objectives;
    const problems = [...yearCapProblems([form], others), ...objectiveProblems(form, lookup)];
    if (problems.length > 0) {
      setShowAll(true);
      focusSoon(problems[0].fieldId);
      return;
    }
    const keyResults = newKeyResultsFrom(form, lookup);
    if (editing.kind === "edit") {
      updateObjective(editing.id, { title: form.title.trim(), why: form.why.trim(), keyResults });
      focusSoon(fieldIds.menu(form));
    } else {
      const id = addObjective({ quarter: form.quarter, title: form.title, why: form.why, source: "manual", keyResults });
      focusSoon(fieldIds.menu({ key: id }));
      toast({ message: "Objective added." });
    }
    setEditing(null);
  };

  /** Empty in-window quarters it can move to (doesn't count as the quarter-end move). */
  const moveTargets = (objective: Objective) =>
    plannableQuarters(today).filter(
      (quarter) =>
        quarter !== objective.quarter &&
        !activeObjectives(objectives).some((other) => other.quarter === quarter) &&
        (yearOf(quarter) === yearOf(objective.quarter) || roomInYear(objectives, yearOf(quarter)) > 0),
    );

  const move = (objective: Objective, quarter: QuarterKey) => {
    const from = objective.quarter;
    updateObjective(objective.id, { quarter });
    focusSoon(fieldIds.menu({ key: objective.id }));
    toast({
      message: `Moved to ${formatQuarter(quarter)}.`,
      // A hand move clears `movedFrom`, which undo can't put back; only offer it when there is none.
      action: objective.movedFrom ? undefined : { label: "Undo", onClick: () => updateObjective(objective.id, { quarter: from }) },
    });
  };

  const remove = (objective: Objective) => {
    const deleted = deleteObjective(objective.id);
    if (!deleted) return;
    focusSoon(
      objectives.length === 1 ? PLAN_LINK_ID : isPlannable(objective.quarter, today) ? addButtonId(objective.quarter) : tabId(String(year)),
    );
    toast({ message: "Objective deleted.", action: { label: "Undo", onClick: () => restoreObjective(deleted) } });
  };

  // Soft gate (O-6): no objectives at all → one calm prompt in the current year.
  if (objectives.length === 0 && isCurrentYear && !editing) {
    return <OkrsEmptyState year={year} onAddMyself={() => startNew(nowQuarter)} />;
  }

  const archived = archivedYears.includes(year);
  const canArchive =
    yearOf(nowQuarter) > year && !archived && inYear.length > 0 && inYear.every((o) => o.status === "closed");

  return (
    <div className="flex flex-col gap-4">
      {canArchive && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">{year} is done. Archive it to keep your OKRs focused on what&apos;s next.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              archiveYear(year);
              onArchived();
              toast({ message: `${year} is archived. You can still open it under Archive.` });
            }}
          >
            <ArchiveIcon aria-hidden />
            Archive {year}
          </Button>
        </div>
      )}
      <QuarterGrid label={`${year} by quarter`}>
        {quartersOf(year).map((quarter) => {
          const here = inYear.filter((objective) => objective.quarter === quarter);
          const plannable = isPlannable(quarter, today);
          const isPast = compareQuarters(quarter, nowQuarter) < 0;
          const addingHere = editing?.kind === "new" && editing.form.quarter === quarter;
          return (
            <QuarterColumn
              key={quarter}
              quarter={quarter}
              isNow={quarter === nowQuarter}
              collapseOnMobile={isPast && here.length === 0 && !addingHere}
            >
              {here.length === 0 && isPast && !addingHere && <EmptyQuarter />}
              {here.map((objective) => {
                const editable = objective.status === "active" && isLinkable(objective, archivedYears);
                if (editing?.kind === "edit" && editing.id === objective.id) {
                  return (
                    <ObjectiveEditor
                      key={objective.id}
                      label={`Edit objective in ${formatQuarter(quarter)}`}
                      value={editing.form}
                      onChange={(form) => setEditing({ ...editing, form })}
                      lookup={lookup}
                      skills={visibleSkills}
                      materials={materials}
                      problems={[...yearCapProblems([editing.form], objectives.filter((o) => o.id !== objective.id)), ...objectiveProblems(editing.form, lookup)]}
                      showAllProblems={showAll}
                      footer={<EditorButtons onCancel={cancel} onSave={save} />}
                    />
                  );
                }
                return (
                  <ObjectiveCard
                    key={objective.id}
                    objective={objective}
                    items={items}
                    materials={lookup.materials}
                    skills={lookup.skills}
                    today={today}
                    editable={editable}
                    onPickAnother={editable ? () => startEdit(objective) : undefined}
                    menu={
                      editable ? (
                        <ObjectiveMenu
                          triggerId={fieldIds.menu({ key: objective.id })}
                          objectiveTitle={objective.title}
                          onEdit={() => startEdit(objective)}
                          moveTargets={moveTargets(objective)}
                          onMove={(target) => move(objective, target)}
                          removeLabel="Delete"
                          onRemove={() => remove(objective)}
                        />
                      ) : undefined
                    }
                  />
                );
              })}
              {addingHere && editing.kind === "new" && (
                <ObjectiveEditor
                  label={`New objective in ${formatQuarter(quarter)}`}
                  value={editing.form}
                  onChange={(form) => setEditing({ kind: "new", form })}
                  lookup={lookup}
                  skills={visibleSkills}
                  materials={materials}
                  problems={[...yearCapProblems([editing.form], objectives), ...objectiveProblems(editing.form, lookup)]}
                  showAllProblems={showAll}
                  footer={<EditorButtons onCancel={cancel} onSave={save} saveLabel="Add objective" />}
                />
              )}
              {plannable && !archived && room > 0 && !addingHere && (
                <AddObjectiveButton quarter={quarter} id={addButtonId(quarter)} onClick={() => startNew(quarter)} />
              )}
              {!plannable && !isPast && here.length === 0 && <EmptyQuarter />}
            </QuarterColumn>
          );
        })}
      </QuarterGrid>
    </div>
  );
}

function EditorButtons({ onCancel, onSave, saveLabel = "Save" }: { onCancel: () => void; onSave: () => void; saveLabel?: string }) {
  return (
    <>
      <Button variant="ghost" size="sm" onClick={onCancel}>
        Cancel
      </Button>
      <Button size="sm" onClick={onSave}>
        {saveLabel}
      </Button>
    </>
  );
}

function ArchivePanel({ years }: { years: readonly number[] }) {
  const objectives = useObjectives();
  const items = usePlanItems();
  const today = useToday();
  const { lookup } = useEditorData();
  return (
    <div className="flex flex-col gap-8">
      {years.map((year) => (
        <section key={year} aria-labelledby={`archive-${year}`} className="flex flex-col gap-3">
          <h2 id={`archive-${year}`} className="font-display text-lg font-semibold">
            {year}
          </h2>
          <QuarterGrid label={`${year} by quarter`}>
            {quartersOf(year).map((quarter) => {
              const here = objectives.filter((objective) => objective.quarter === quarter);
              return (
                <QuarterColumn key={quarter} quarter={quarter} isNow={false} heading="h3">
                  {here.length === 0 && <EmptyQuarter />}
                  {here.map((objective) => (
                    <ObjectiveCard
                      key={objective.id}
                      objective={objective}
                      items={items}
                      materials={lookup.materials}
                      skills={lookup.skills}
                      today={today}
                      editable={false}
                    />
                  ))}
                </QuarterColumn>
              );
            })}
          </QuarterGrid>
        </section>
      ))}
    </div>
  );
}

/** okrs-and-wizard.md §Empty state. */
function OkrsEmptyState({ year, onAddMyself }: { year: number; onAddMyself: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-12 text-center shadow-xs">
      <span className="grid size-11 place-items-center rounded-full bg-accent text-accent-foreground">
        <TargetIcon className="size-5" aria-hidden />
      </span>
      <h2 className="font-display text-xl font-semibold">Set your year</h2>
      <p className="text-sm text-muted-foreground">
        Answer two questions and get a draft plan for the rest of {year} and {year + 1}. You can change everything.
      </p>
      <div className={cn("mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-2")}>
        <Button asChild>
          <Link id={PLAN_LINK_ID} href={PLAN_PATH}>
            Plan my year
          </Link>
        </Button>
        <Button variant="link" onClick={onAddMyself}>
          Add an objective myself
        </Button>
      </div>
    </div>
  );
}
