import type { Material, Task } from "@/lib/domain/types";

/** Title of the MVP's core reflection task (PRD §5.6 C-2). */
export const SUMMARIZE_TASK_TITLE = "Summarize in my words";

/**
 * Suggested tasks created when a material is added to a plan (PRD §5.3 L-4).
 * One "milestone" task per milestone (if any), followed by the "suggested"
 * "Summarize in my words" task.
 * Pure and deterministic: same material in, same tasks out. Callers assign ids.
 */
export function suggestedTasksFor(material: Material): Omit<Task, "id">[] {
  const milestoneTasks: Omit<Task, "id">[] = (material.milestones ?? []).map((milestone) => ({
    title: milestone,
    done: false,
    kind: "milestone",
  }));

  return [...milestoneTasks, { title: SUMMARIZE_TASK_TITLE, done: false, kind: "suggested" }];
}
