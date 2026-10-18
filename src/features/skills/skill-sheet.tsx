"use client";

import { ArrowRightIcon, LibraryIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DataGate } from "@/components/app/data-gate";
import { SkillIcon } from "@/components/icons";
import { LevelControl, LevelDots } from "@/components/skills/skill-level";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { formatQuarter } from "@/lib/domain/dates";
import type { Skill, SkillLevelValue } from "@/lib/domain/types";
import { useActions, useAppData, useMaterialMap, useProfile, useSkill, useSkills, useToday } from "@/lib/store/hooks";
import { useUIStore } from "@/lib/store/ui-store";
import { skillColorVar, skillTextColor } from "@/lib/theme/skill-colors";
import { STATUS_LABELS } from "../board/board-labels";
import { canShowMore, DEFAULT_LEVELS, skillSheetSummary } from "./skill-rules";

/**
 * The skill sheet (skills.md, S-3, S-5), opened from anywhere with
 * `useUIStore.getState().openSkillSheet(skillId)` (or a `SkillChip`). Mounted
 * once in the app shell; it stacks over the card drawer when opened from it.
 */
export function SkillSheet() {
  const skillId = useUIStore((state) => state.skillSheet);
  const closeSkillSheet = useUIStore((state) => state.closeSkillSheet);
  const skill = useSkill(skillId ?? "");
  const open = Boolean(skill);
  // What had focus when the sheet opened. It opens from the UI store, not a dialog
  // trigger, so it returns focus itself. Captured in a layout effect, before the
  // sheet's focus trap moves focus inside (radar axis labels are SVG, hence both types).
  const openerRef = useRef<HTMLElement | SVGElement | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const active = document.activeElement;
    openerRef.current = active instanceof HTMLElement || active instanceof SVGElement ? active : null;
  }, [open]);

  useEffect(() => {
    if (skillId && !skill) {
      console.warn(`[growloop] No skill with id "${skillId}"; the skill sheet stays closed.`);
      closeSkillSheet();
    }
  }, [skillId, skill, closeSkillSheet]);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && closeSkillSheet()}>
      {skill && (
        <SheetContent
          size="skill"
          onCloseAutoFocus={() => {
            const opener = openerRef.current;
            openerRef.current = null;
            if (opener?.isConnected) opener.focus();
          }}
        >
          <SkillSheetHeader skill={skill} />
          <SheetBody className="gap-0 divide-y py-0">
            {/* Opens only after a click, so data is loaded; the gate provides today's date. */}
            <DataGate fallback={null}>
              <SkillSheetSections skill={skill} onNavigate={closeSkillSheet} />
            </DataGate>
          </SheetBody>
          <SheetFooter>
            <Button asChild size="sm">
              <Link href={`/library?skill=${encodeURIComponent(skill.id)}`} onClick={closeSkillSheet}>
                <LibraryIcon aria-hidden />
                Browse resources
              </Link>
            </Button>
          </SheetFooter>
        </SheetContent>
      )}
    </Sheet>
  );
}

function SkillSheetHeader({ skill }: { skill: Skill }) {
  const { setSkillHidden } = useActions();
  const skills = useSkills({ includeHidden: true });
  const limitsId = useId();
  // Same pattern as Settings: still focusable, with the reason as its description.
  const showBlocked = !canShowMore(skills);

  return (
    <SheetHeader className="gap-2">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `color-mix(in oklch, ${skillColorVar(skill.color)} 18%, transparent)` }}
        >
          <SkillIcon name={skill.icon} className="size-5" style={{ color: skillTextColor(skill.color) }} />
        </span>
        <SheetTitle className="min-w-0">{skill.name}</SheetTitle>
        {skill.hidden && (
          <span className="flex shrink-0 items-center gap-1">
            <Badge variant="outline" className="text-muted-foreground">
              Hidden
            </Badge>
            <Button
              variant="ghost"
              size="xs"
              aria-disabled={showBlocked || undefined}
              aria-describedby={showBlocked ? limitsId : undefined}
              className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
              onClick={() => {
                if (!showBlocked) setSkillHidden(skill.id, false);
              }}
            >
              Show
            </Button>
          </span>
        )}
      </div>
      {skill.hidden && showBlocked && (
        <p id={limitsId} className="text-xs text-muted-foreground">
          Keep 3 to 16 visible.
        </p>
      )}
      <SheetDescription>{skill.description || "A skill you added."}</SheetDescription>
    </SheetHeader>
  );
}

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid gap-x-4 gap-y-2 py-4 sm:grid-cols-[6.5rem_1fr]">
      <h3 id={headingId} className="text-xs font-medium text-muted-foreground sm:pt-0.5">
        {title}
      </h3>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

const rowLinkClassName =
  "-mx-1.5 flex items-baseline justify-between gap-3 rounded-md px-1.5 py-1 outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50";

function SkillSheetSections({ skill, onNavigate }: { skill: Skill; onNavigate: () => void }) {
  const { objectives, planItems, notes } = useAppData();
  const today = useToday();
  const materials = useMaterialMap();
  const summary = useMemo(
    () => skillSheetSummary({ objectives, planItems, notes }, skill.id, today),
    [objectives, planItems, notes, skill.id, today],
  );
  const skillParam = encodeURIComponent(skill.id);

  return (
    <>
      <SheetSection title="Your level">
        <LevelSection skill={skill} />
      </SheetSection>

      {summary.objectives.length > 0 && (
        <SheetSection title="This year">
          <ul className="flex flex-col">
            {summary.objectives.map(({ objective, year, measure }) => (
              <li key={objective.id}>
                <Link href={`/okrs?year=${year}`} onClick={onNavigate} className={rowLinkClassName}>
                  <span className="min-w-0">{objective.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {measure.kind === "quarter"
                      ? formatQuarter(measure.quarter)
                      : `${measure.percent}%${objective.status === "closed" ? " · Closed" : ""}`}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SheetSection>
      )}

      <SheetSection title="On your board">
        {summary.cards.length === 0 ? (
          <p className="text-muted-foreground">Nothing planned for {skill.name} yet.</p>
        ) : (
          <ul className="flex flex-col">
            {summary.cards.map((item) => (
              <li key={item.id}>
                <Link href={`/board?item=${encodeURIComponent(item.id)}`} onClick={onNavigate} className={rowLinkClassName}>
                  <span className="min-w-0">{materials.get(item.materialId)?.title ?? "Removed resource"}</span>
                  <Badge variant="secondary" className="shrink-0">
                    {STATUS_LABELS[item.status]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
        {summary.finishedThisYear > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">Finished this year: {summary.finishedThisYear}</p>
        )}
      </SheetSection>

      {summary.noteCount > 0 && (
        <SheetSection title="Notes">
          <Link href={`/notebook?skill=${skillParam}`} onClick={onNavigate} className={rowLinkClassName}>
            <span>
              {summary.noteCount} {summary.noteCount === 1 ? "note" : "notes"}
            </span>
            <ArrowRightIcon aria-hidden className="size-4 self-center text-muted-foreground" />
          </Link>
        </SheetSection>
      )}
    </>
  );
}

/** Now and Goal as dots; Edit turns them into the wizard's 1–5 controls, saved on every change. */
function LevelSection({ skill }: { skill: Skill }) {
  const { setSkillLevel } = useActions();
  const level = useProfile().skillLevels.find((entry) => entry.skillId === skill.id);
  const [editing, setEditing] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const focusAfterToggle = useRef<"editor" | "toggle" | null>(null);

  useEffect(() => {
    const target = focusAfterToggle.current;
    focusAfterToggle.current = null;
    if (target === "editor") editorRef.current?.querySelector<HTMLInputElement>("input:checked")?.focus();
    if (target === "toggle") toggleRef.current?.focus();
  }, [editing]);

  const toggle = (next: boolean) => {
    // Done with the defaults untouched still sets the level the controls showed.
    if (!next && !level) setSkillLevel(skill.id, DEFAULT_LEVELS);
    focusAfterToggle.current = next ? "editor" : "toggle";
    setEditing(next);
  };

  if (!editing) {
    return level ? (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <LevelDots label="Now" value={level.current} />
        <LevelDots label="Goal" value={level.target} />
        <Button ref={toggleRef} variant="ghost" size="xs" className="ml-auto" onClick={() => toggle(true)} aria-label={`Edit your level in ${skill.name}`}>
          Edit
        </Button>
      </div>
    ) : (
      <p className="text-muted-foreground">
        Not set yet ·{" "}
        <Button ref={toggleRef} variant="link" size="xs" className="h-auto px-0 align-baseline" onClick={() => toggle(true)}>
          Set level
        </Button>
      </p>
    );
  }

  const values = level ?? DEFAULT_LEVELS;
  const save = (patch: Partial<{ current: SkillLevelValue; target: SkillLevelValue }>) =>
    setSkillLevel(skill.id, { current: values.current, target: values.target, ...patch });

  return (
    <div ref={editorRef} className="flex flex-col gap-2">
      <LevelControl label="Now" value={values.current} onChange={(current) => save({ current })} />
      <LevelControl label="Goal" value={values.target} onChange={(target) => save({ target })} />
      <p className="text-xs text-muted-foreground">1 New to it · 2 Learning · 3 Capable · 4 Strong · 5 Expert</p>
      {level && level.target <= level.current && level.current < 5 && (
        <p className="text-xs text-muted-foreground" role="status">
          Set a goal above where you are.
        </p>
      )}
      <Button ref={toggleRef} variant="outline" size="xs" className="self-start" onClick={() => toggle(false)}>
        Done
      </Button>
    </div>
  );
}
