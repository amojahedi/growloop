"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { formatQuarter, nextQuarter, yearOf } from "@/lib/domain/dates";
import { defaultDecisions, reviewRecap, type ObjectiveDecision, type PendingReview } from "@/lib/domain/month-review";
import { checkMoveToNextQuarter, isMet, objectiveProgress } from "@/lib/domain/okrs";
import type { Objective, RolloverDecision } from "@/lib/domain/types";
import { useActions, useMaterialMap, useNotes, useObjectives, usePendingReview, usePlanItems, useSkills, useToday } from "@/lib/store/hooks";
import { STATUS_LABELS } from "../board/board-labels";
import { monthsLabel } from "./labels";

export interface MonthReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ITEM_DECISIONS: { value: RolloverDecision; label: string }[] = [
  { value: "carry_over", label: "Carry over" },
  { value: "backlog", label: "Backlog" },
  { value: "drop", label: "Drop" },
];

/**
 * The month-end review dialog (board.md §The review dialog). WP0 stub: plain
 * controls with the spec's defaults, so the review keeps working until WP3
 * replaces it with the designed dialog. Must be inside `<DataGate>`.
 */
export function MonthReviewDialog({ open, onOpenChange }: MonthReviewDialogProps) {
  const pending = usePendingReview();
  return (
    <Dialog open={open && pending !== null} onOpenChange={onOpenChange}>
      {/* Rendered only while open, so every opening starts from the defaults. */}
      {pending && <ReviewContent pending={pending} onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function ReviewContent({ pending, onDone }: { pending: PendingReview; onDone: () => void }) {
  const { applyMonthReview } = useActions();
  const items = usePlanItems();
  const notes = useNotes();
  const skills = useSkills();
  const objectives = useObjectives();
  const materials = useMaterialMap();
  const today = useToday();
  const [decisions, setDecisions] = useState(() => defaultDecisions(pending));

  const months = monthsLabel(pending.months);
  const recap = reviewRecap(items, notes, skills, pending.months);
  const topSkill = skills.find((skill) => skill.id === recap.topSkillId);

  const done = () => {
    applyMonthReview(decisions);
    toast({ message: `${months} ${pending.months.length > 1 ? "are" : "is"} wrapped up.` });
    onDone();
  };

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>Wrap up {months}</DialogTitle>
        <DialogDescription>
          {recap.finished === 0
            ? "A quiet month. That happens."
            : [`${recap.finished} finished`, `${recap.summarized} summarized`, topSkill && `${topSkill.name} grew most`]
                .filter(Boolean)
                .join(" · ")}
        </DialogDescription>
      </DialogHeader>

      {pending.unfinished.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="font-medium">Unfinished</h3>
          <ul className="flex flex-col gap-2">
            {pending.unfinished.map((item) => {
              const title = materials.get(item.materialId)?.title ?? "Removed material";
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span className="min-w-0 flex-1">
                    {title} <span className="text-muted-foreground">· {STATUS_LABELS[item.status]}</span>
                    {(item.carriedFrom?.length ?? 0) >= 2 && <span className="text-muted-foreground"> · Carried twice</span>}
                  </span>
                  <select
                    aria-label={`What to do with "${title}"`}
                    className="rounded-md border bg-background px-2 py-1"
                    value={decisions.items[item.id]}
                    onChange={(event) =>
                      setDecisions((current) => ({
                        ...current,
                        items: { ...current.items, [item.id]: event.target.value as RolloverDecision },
                      }))
                    }
                  >
                    {ITEM_DECISIONS.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">Dropped items leave the board. Their notes stay in your Notebook.</p>
        </section>
      )}

      {pending.quarters.map((block) => (
        <section key={block.quarter} className="flex flex-col gap-2">
          <h3 className="font-medium">Close {formatQuarter(block.quarter).split(" ")[0]}</h3>
          <ul className="flex flex-col gap-2">
            {block.objectives.map((objective) => (
              <ObjectiveRow
                key={objective.id}
                objective={objective}
                score={objectiveProgress(objective, items)}
                move={checkMoveToNextQuarter(objective, objectives, today)}
                value={decisions.objectives[objective.id]}
                onChange={(value) =>
                  setDecisions((current) => ({ ...current, objectives: { ...current.objectives, [objective.id]: value } }))
                }
              />
            ))}
          </ul>
        </section>
      ))}

      {pending.years.map((year) => (
        <label key={year} className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={decisions.archive[year] ?? true}
            onChange={(event) =>
              setDecisions((current) => ({ ...current, archive: { ...current.archive, [year]: event.target.checked } }))
            }
          />
          Archive {year}
        </label>
      ))}

      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Later
        </Button>
        <Button onClick={done}>Done</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ObjectiveRow({
  objective,
  score,
  move,
  value,
  onChange,
}: {
  objective: Objective;
  score: number;
  move: ReturnType<typeof checkMoveToNextQuarter>;
  value: ObjectiveDecision;
  onChange: (value: ObjectiveDecision) => void;
}) {
  const name = useId();
  const to = nextQuarter(objective.quarter);
  const hint =
    move.ok === false && move.reason === "already-moved"
      ? "Already moved once"
      : move.ok === false && move.reason === "year-full"
        ? `${yearOf(to)} already has 4 objectives`
        : undefined;

  return (
    <li className="flex flex-col gap-1">
      <span>{objective.title}</span>
      {isMet(score) ? (
        <span className="text-muted-foreground">Met</span>
      ) : (
        <div role="radiogroup" aria-label={`What to do with "${objective.title}"`} className="flex flex-wrap gap-3">
          <label className="flex items-center gap-1.5">
            <input type="radio" name={name} checked={value === "close"} onChange={() => onChange("close")} />
            Close at {score}%
          </label>
          {!(move.ok === false && move.reason === "outside-window") && (
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name={name}
                checked={value === "move"}
                disabled={!move.ok}
                onChange={() => onChange("move")}
              />
              Move to {formatQuarter(to).split(" ")[0]}
              {hint && <span className="text-xs text-muted-foreground">({hint})</span>}
            </label>
          )}
        </div>
      )}
    </li>
  );
}
