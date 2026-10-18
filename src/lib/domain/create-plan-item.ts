import { suggestedTasksFor } from "@/lib/catalog";
import { createId } from "./ids";
import { createTask, type TaskSeed } from "./plan-items";
import type { BoardStatus, ID, Material, MonthKey, PlanItem } from "./types";

export interface CreatePlanItemOptions {
  status?: BoardStatus;
  /** Position in the target column; use `nextOrder()` to append. */
  order?: number;
  keyResultId?: ID;
  /** Defaults to the material's skills. */
  skillIds?: ID[];
  /** ISO timestamp; defaults to now. */
  now?: string;
  /** Override the suggested-task source (defaults to the curated catalog). */
  suggestTasks?: (material: Material) => readonly TaskSeed[];
}

/** Places a material in a month as a new plan item with suggested tasks. */
export function createPlanItem(
  material: Material,
  month: MonthKey,
  options: CreatePlanItemOptions = {},
): PlanItem {
  const suggest = options.suggestTasks ?? suggestedTasksFor;
  const status = options.status ?? "todo";
  const now = options.now ?? new Date().toISOString();

  return {
    id: createId(),
    materialId: material.id,
    month,
    status,
    order: options.order ?? 0,
    skillIds: options.skillIds ?? [...material.skillIds],
    ...(options.keyResultId ? { keyResultId: options.keyResultId } : {}),
    tasks: suggest(material).map((seed) => createTask(seed, "suggested")),
    estimatedHours: material.estimatedHours,
    timeLogs: [],
    createdAt: now,
    ...(status === "done" ? { completedAt: now } : {}),
  };
}
