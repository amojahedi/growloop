"use client";

import { EmptyHint } from "@/components/app/section";
import { Progress } from "@/components/ui/progress";
import { keyResultProgress, objectiveProgress, type KeyResultProgress } from "@/lib/domain/okrs";
import type { Objective, PlanItem } from "@/lib/domain/types";
import { formatPercent } from "@/lib/format";

/** "2 of 3" for count KRs, "Not on your board yet" for material KRs without a card, otherwise the percentage. */
function keyResultStatus(progress: KeyResultProgress): string {
  if (progress.type === "count") return `${progress.done} of ${progress.target}`;
  if (!progress.item) return "Not on your board yet";
  return formatPercent(progress.progress);
}

/** Objectives with their key results and progress bars (D-3, O-5). */
export function ObjectiveProgressList({ objectives, items }: { objectives: Objective[]; items: readonly PlanItem[] }) {
  if (objectives.length === 0) return <EmptyHint>No objectives for this quarter yet.</EmptyHint>;

  return (
    <ul className="flex flex-col gap-5">
      {objectives.map((objective) => {
        const progress = objectiveProgress(objective, items);
        return (
          <li key={objective.id}>
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-medium">{objective.title}</p>
              <span className="text-sm text-muted-foreground">{formatPercent(progress)}</span>
            </div>
            <Progress value={progress} className="mt-1" aria-label={`${objective.title} progress`} />
            <ul className="mt-2 flex flex-col gap-1 pl-3">
              {objective.keyResults.map((kr) => (
                <li key={kr.id} className="flex justify-between gap-2 text-sm text-muted-foreground">
                  <span>{kr.title}</span>
                  <span className="shrink-0">{keyResultStatus(keyResultProgress(kr, objective, items))}</span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
