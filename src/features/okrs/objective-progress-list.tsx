"use client";

import { HashIcon } from "lucide-react";
import { MATERIAL_TYPE_ICONS } from "@/components/icons";
import { Progress } from "@/components/ui/progress";
import type { DayKey } from "@/lib/domain/dates";
import { keyResultProgress, objectivePace, objectiveProgress } from "@/lib/domain/okrs";
import type { ID, Material, Objective, PlanItem } from "@/lib/domain/types";
import { keyResultStatus, paceLabel } from "./labels";

/**
 * A compact view of objectives and their key results (the OKR widget, D-3):
 * progress and pace per objective, and per KR its type, title and status
 * ("2 of 3", "In progress · 60%", "Not on your board yet").
 */
export function ObjectiveProgressList({
  objectives,
  items,
  materials,
  today,
}: {
  objectives: readonly Objective[];
  items: readonly PlanItem[];
  materials: ReadonlyMap<ID, Material>;
  today: DayKey;
}) {
  return (
    <ul className="flex flex-col gap-5">
      {objectives.map((objective) => {
        const progress = objectiveProgress(objective, items);
        const pace = paceLabel(objectivePace(objective, progress, today));
        return (
          <li key={objective.id} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="min-w-0 font-display text-[0.95rem] leading-snug font-semibold">{objective.title}</h3>
              <span className="flex shrink-0 flex-col items-end">
                <span className="font-display text-lg leading-none font-semibold tabular-nums">{progress}%</span>
                <span className="text-xs text-muted-foreground">{pace}</span>
              </span>
            </div>
            <Progress value={progress} aria-label={`${objective.title}: ${progress}%`} />
            <ul className="flex flex-col gap-1">
              {objective.keyResults.map((keyResult) => {
                const material = keyResult.materialId ? materials.get(keyResult.materialId) : undefined;
                const Icon = keyResult.type === "count" || !material ? HashIcon : MATERIAL_TYPE_ICONS[material.type];
                const status =
                  keyResult.type !== "count" && !material ? "Material missing" : keyResultStatus(keyResultProgress(keyResult, objective, items));
                return (
                  <li key={keyResult.id} className="flex items-start gap-2 text-sm">
                    <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 leading-snug">{keyResult.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{status}</span>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
