"use client";

import { useId, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { yearOf, type DayKey } from "@/lib/domain/dates";
import {
  defaultItemDecision,
  defaultDecisions,
  moveChecks,
  pendingReview,
  reviewRecap,
  type ObjectiveDecision,
  type PendingReview,
  type ResolvedDecisions,
} from "@/lib/domain/month-review";
import { isMet, objectiveProgress, type MoveCheck } from "@/lib/domain/okrs";
import type { Objective, PlanItem, RolloverDecision } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";
import { useActions, useMaterialMap, useNotes, usePendingReview, useSkills, useToday } from "@/lib/store/hooks";
import { skillColorVar } from "@/lib/theme/skill-colors";
import { STATUS_LABELS } from "../board/board-labels";
import { monthsLabel } from "./labels";
import { effectiveDecision, moveHint, quarterLabel, wrappedUp, yearSummary } from "./review-model";
import { SegmentedControl } from "./segmented-control";

export interface MonthReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ITEM_OPTIONS: { value: RolloverDecision; label: string }[] = [
  { value: "carry_over", label: "Carry over" },
  { value: "backlog", label: "Backlog" },
  { value: "drop", label: "Drop" },
];

/**
 * The month-end review (board.md §The review dialog, R-1 to R-4): one dialog
 * with a recap, the unfinished items, a Close block per ended quarter and the
 * year archive, applied together by one Done. Never blocking: Later closes it
 * and the banner stays. Must be inside `<DataGate>`.
 */
export function MonthReviewDialog({ open, onOpenChange }: MonthReviewDialogProps) {
  const pending = usePendingReview();
  return (
    <Dialog open={open && pending !== null} onOpenChange={onOpenChange}>
      {/* Rendered only while open, so every opening starts from the defaults and today's date. */}
      {open && pending && <ReviewContent onClose={() => onOpenChange(false)} />}
    </Dialog>
  );
}

/** The data the review reads, as a stable selection. */
function useReviewData() {
  return useAppStore(
    useShallow((state) => ({
      planItems: state.data.planItems,
      objectives: state.data.objectives,
      archivedYears: state.data.archivedYears,
      rollovers: state.data.rollovers,
    })),
  );
}

function ReviewContent({ onClose }: { onClose: () => void }) {
  // The day the dialog opened: a review left open over midnight applies what it showed.
  const today = useToday();
  const [day] = useState<DayKey>(today);
  const data = useReviewData();
  const pending = useMemo(() => pendingReview(data, day), [data, day]);
  const [initial] = useState(() => (pending ? defaultDecisions(pending) : null));
  const [decisions, setDecisions] = useState<ResolvedDecisions | null>(initial);
  const completed = useRef(false);

  if (!pending || !decisions) return null;
  return (
    <DialogContent
      className="gap-6 p-6 sm:max-w-xl"
      onCloseAutoFocus={(event) => {
        // The banner that opened the review is gone once it's done: continue from the page content.
        if (!completed.current) return;
        event.preventDefault();
        document.getElementById("content")?.focus();
      }}
    >
      <ReviewBody
        pending={pending}
        day={day}
        decisions={decisions}
        onChange={setDecisions}
        onLater={onClose}
        onDone={() => {
          completed.current = true;
          onClose();
        }}
      />
    </DialogContent>
  );
}

function ReviewBody({
  pending,
  day,
  decisions,
  onChange,
  onLater,
  onDone,
}: {
  pending: PendingReview;
  day: DayKey;
  decisions: ResolvedDecisions;
  onChange: (update: (current: ResolvedDecisions | null) => ResolvedDecisions | null) => void;
  onLater: () => void;
  onDone: () => void;
}) {
  const { applyMonthReview } = useActions();
  const { planItems, objectives } = useReviewData();
  const notes = useNotes();
  const skills = useSkills({ includeHidden: true });
  const materials = useMaterialMap();
  const currentYear = yearOf(day);

  const months = monthsLabel(pending.months);
  const recap = reviewRecap(planItems, notes, skills, pending.months);
  const topSkill = skills.find((skill) => skill.id === recap.topSkillId);
  // The same sequential checks the store applies, so what's offered is what happens.
  const checks = moveChecks(pending, { objectives, planItems }, day, decisions.objectives);

  const setItem = (id: string, value: RolloverDecision) =>
    onChange((current) => current && { ...current, items: { ...current.items, [id]: value } });
  const setObjective = (id: string, value: ObjectiveDecision) =>
    onChange((current) => current && { ...current, objectives: { ...current.objectives, [id]: value } });
  const setArchive = (year: number, value: boolean) =>
    onChange((current) => current && { ...current, archive: { ...current.archive, [year]: value } });

  const done = () => {
    applyMonthReview(decisions, day);
    toast({ message: wrappedUp(pending.months) });
    onDone();
  };

  return (
    <>
      <DialogHeader className="gap-3">
        <DialogTitle className="font-display text-2xl font-medium tracking-tight">Wrap up {months}</DialogTitle>
        <DialogDescription asChild>
          {recap.finished === 0 ? (
            <p className="text-base">A quiet month. That happens.</p>
          ) : (
            <p className="text-sm leading-relaxed">
              <Figure value={recap.finished} label="finished" />
              <Separator />
              <Figure value={recap.summarized} label="summarized" />
              {topSkill && (
                <>
                  <Separator />
                  <span aria-hidden className="mr-1.5 inline-block size-2 rounded-full" style={{ backgroundColor: skillColorVar(topSkill.color) }} />
                  <span className="font-display text-lg text-foreground">{topSkill.name}</span> grew most
                </>
              )}
            </p>
          )}
        </DialogDescription>
      </DialogHeader>

      {pending.unfinished.length > 0 && (
        <ReviewSection title="Unfinished">
          <ul className="flex flex-col divide-y">
            {pending.unfinished.map((item) => (
              <UnfinishedRow
                key={item.id}
                item={item}
                title={materials.get(item.materialId)?.title ?? "Removed material"}
                value={decisions.items[item.id] ?? defaultItemDecision(item)}
                onChange={(value) => setItem(item.id, value)}
              />
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">Dropped items leave the board. Their notes stay in your Notebook.</p>
        </ReviewSection>
      )}

      {pending.quarters.map((block) => (
        <ReviewSection key={block.quarter} title={`Close ${quarterLabel(block.quarter, currentYear)}`}>
          <ul className="flex flex-col divide-y">
            {block.objectives.map((objective) => (
              <ObjectiveRow
                key={objective.id}
                objective={objective}
                score={objectiveProgress(objective, planItems)}
                check={checks.get(objective.id)!}
                currentYear={currentYear}
                value={effectiveDecision(objectiveProgress(objective, planItems), decisions.objectives[objective.id], checks.get(objective.id))}
                onChange={(value) => setObjective(objective.id, value)}
              />
            ))}
          </ul>
        </ReviewSection>
      ))}

      {pending.years.map((year) => (
        <ReviewSection key={year} title={`Wrap up ${year}`}>
          <p className="text-sm">
            {yearSummary(year, planItems, objectives, pending, decisions.objectives, checks)} Archive it to keep your OKRs
            focused on what&apos;s next. You can still open it under Archive.
          </p>
          <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={decisions.archive[year] ?? true}
              onChange={(event) => setArchive(year, event.target.checked)}
            />
            Archive {year}
          </label>
        </ReviewSection>
      ))}

      <DialogFooter>
        <Button variant="ghost" onClick={onLater}>
          Later
        </Button>
        <Button onClick={done}>Done</Button>
      </DialogFooter>
    </>
  );
}

/** A small serif number and its label; plain text in between, so it reads as "7 finished". */
function Figure({ value, label }: { value: number; label: string }) {
  return (
    <span className="whitespace-nowrap">
      <span className="font-display text-lg text-foreground tabular-nums">{value}</span> {label}
    </span>
  );
}

const Separator = () => (
  <>
    {" "}
    <span className="mx-1 text-muted-foreground">·</span>{" "}
  </>
);

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function UnfinishedRow({
  item,
  title,
  value,
  onChange,
}: {
  item: PlanItem;
  title: string;
  value: RolloverDecision;
  onChange: (value: RolloverDecision) => void;
}) {
  const carriedTwice = (item.carriedFrom?.length ?? 0) >= 2;
  return (
    <li className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
        <span className="min-w-0 font-medium">{title}</span>
        <Badge variant="outline">{STATUS_LABELS[item.status]}</Badge>
        {carriedTwice && <Badge variant="secondary">Carried twice</Badge>}
      </div>
      <SegmentedControl label={`What to do with ${title}`} options={ITEM_OPTIONS} value={value} onChange={onChange} />
    </li>
  );
}

function ObjectiveRow({
  objective,
  score,
  check,
  currentYear,
  value,
  onChange,
}: {
  objective: Objective;
  score: number;
  check: MoveCheck;
  currentYear: number;
  value: ObjectiveDecision;
  onChange: (value: ObjectiveDecision) => void;
}) {
  const hintId = useId();
  const hint = moveHint(objective, check);
  const closeLabel = `Close at ${score}%`;

  let control: React.ReactNode;
  if (isMet(score)) {
    control = <Badge variant="secondary">Met</Badge>;
  } else if (!check.ok && check.reason === "outside-window") {
    control = <span className="text-sm text-muted-foreground">{closeLabel}</span>;
  } else {
    control = (
      <div className="flex flex-col items-start gap-1 sm:items-end">
        <SegmentedControl
          label={`What to do with ${objective.title}`}
          value={value}
          onChange={onChange}
          options={[
            { value: "close", label: closeLabel },
            {
              value: "move",
              label: `Move to ${quarterLabel(check.to, currentYear)}`,
              disabled: !check.ok,
              describedBy: hint ? hintId : undefined,
            },
          ]}
        />
        {hint && (
          <span id={hintId} className="text-xs text-muted-foreground">
            {hint}
          </span>
        )}
      </div>
    );
  }

  return (
    <li className="flex flex-col gap-2 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0 font-medium">{objective.title}</span>
      {control}
    </li>
  );
}
