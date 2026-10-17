import type { KeyResult, Objective, PlanItem, QuarterKey } from "./types";

/** OKR progress, expressed as 0–100. */

export interface KeyResultProgress {
  /** 0–100. */
  progress: number;
  /** Plan items linked to this KR. */
  linked: number;
  /** Linked items that are done. */
  done: number;
}

const clampPercent = (value: number) => Math.min(100, Math.max(0, value));

export function keyResultProgress(keyResult: KeyResult, items: readonly PlanItem[]): KeyResultProgress {
  const linkedItems = items.filter((item) => item.keyResultId === keyResult.id);
  const done = linkedItems.filter((item) => item.status === "done").length;
  const linked = linkedItems.length;

  const progress =
    keyResult.progressMode === "manual"
      ? clampPercent(keyResult.manualProgress ?? 0)
      : linked === 0
        ? 0
        : (done / linked) * 100;

  return { progress, linked, done };
}

/** Mean progress of the objective's key results (0 when it has none). */
export function objectiveProgress(objective: Objective, items: readonly PlanItem[]): number {
  const { keyResults } = objective;
  if (keyResults.length === 0) return 0;
  const total = keyResults.reduce((sum, kr) => sum + keyResultProgress(kr, items).progress, 0);
  return total / keyResults.length;
}

export function objectivesForQuarter(objectives: readonly Objective[], quarter: QuarterKey): Objective[] {
  return objectives.filter((objective) => objective.quarter === quarter);
}

/** Finds a key result and its parent objective by KR id. */
export function findKeyResult(
  objectives: readonly Objective[],
  keyResultId: string,
): { objective: Objective; keyResult: KeyResult } | undefined {
  for (const objective of objectives) {
    const keyResult = objective.keyResults.find((kr) => kr.id === keyResultId);
    if (keyResult) return { objective, keyResult };
  }
  return undefined;
}
