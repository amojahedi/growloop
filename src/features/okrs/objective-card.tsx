"use client";

import { cn } from "cn";
import type { ReactNode } from "react";
import type { DayKey } from "@/lib/domain/dates";
import { objectivePace, objectiveProgress } from "@/lib/domain/okrs";
import type { ID, Material, Objective, PlanItem } from "@/lib/domain/types";
import { KeyResultRow } from "./key-result-row";
import { paceLabel, quarterLabel } from "./labels";
import { ProgressRing } from "./progress-ring";

/**
 * An objective on the OKR page: title, why, computed progress and pace, and
 * its key results. Closed and archived objectives are read-only.
 */
export function ObjectiveCard({
  objective,
  items,
  materials,
  today,
  editable,
  menu,
  onPickAnother,
}: {
  objective: Objective;
  items: readonly PlanItem[];
  materials: ReadonlyMap<ID, Material>;
  today: DayKey;
  /** Active and not in an archived year. */
  editable: boolean;
  menu?: ReactNode;
  onPickAnother?: () => void;
}) {
  const progress = objectiveProgress(objective, items);
  const pace = objectivePace(objective, progress, today);
  const label = paceLabel(pace);
  const closed = objective.status === "closed";

  return (
    <article className={cn("rounded-xl border bg-card p-3.5 shadow-xs", closed && "bg-card/70")}>
      <div className="flex items-start gap-1">
        <h3 className="min-w-0 flex-1 font-display text-[0.95rem] leading-snug font-semibold">{objective.title}</h3>
        {menu}
      </div>
      {objective.why && <p className="mt-0.5 text-sm text-muted-foreground">{objective.why}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
        <ProgressRing value={progress} />
        {pace.kind === "closed" && !pace.met ? (
          <span className="text-sm font-semibold">{label}</span>
        ) : (
          <>
            <span className="font-display text-lg leading-none font-semibold tabular-nums">
              {progress}%<span className="sr-only"> complete</span>
            </span>
            <span
              className={cn(
                "text-xs font-semibold",
                pace.kind === "ahead" || pace.kind === "closed" ? "text-foreground" : "text-muted-foreground",
              )}
            >
              · {label}
            </span>
          </>
        )}
      </div>
      {objective.movedFrom && (
        <p className="mt-1 text-xs text-muted-foreground">Moved from {quarterLabel(objective.movedFrom)}</p>
      )}
      <ul className="mt-3 flex flex-col gap-2.5" aria-label="Key results">
        {objective.keyResults.map((keyResult) => (
          <KeyResultRow
            key={keyResult.id}
            keyResult={keyResult}
            objective={objective}
            items={items}
            material={keyResult.materialId ? materials.get(keyResult.materialId) : undefined}
            linkedMaterial={(id) => materials.get(id)}
            editable={editable}
            onPickAnother={onPickAnother}
          />
        ))}
      </ul>
    </article>
  );
}
