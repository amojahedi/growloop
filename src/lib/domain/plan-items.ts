import { createId } from "./ids";
import type { BoardStatus, ID, PlanItem, Reminder, Task, TimeLog } from "./types";

/** Pure, immutable updates to a single plan item. */

/** Anything a task can be created from: a bare title or a task-like object. */
export type TaskSeed = string | { title: string; kind?: Task["kind"] };

/** Creates an open task. A seed's own `kind` wins over `defaultKind`. */
export function createTask(seed: TaskSeed, defaultKind: Task["kind"]): Task {
  if (typeof seed === "string") return { id: createId(), title: seed.trim(), done: false, kind: defaultKind };
  return { id: createId(), title: seed.title.trim(), done: false, kind: seed.kind ?? defaultKind };
}

/**
 * Returns the item with a new status, keeping `completedAt` in sync:
 * entering "done" stamps it, leaving "done" clears it.
 */
export function withStatus(item: PlanItem, status: BoardStatus, now: string): PlanItem {
  if (item.status === status) return item;
  if (status === "done") return { ...item, status, completedAt: now };
  const { completedAt: _cleared, ...rest } = item;
  return { ...rest, status };
}

// --- Tasks ---------------------------------------------------------------

export function addTask(item: PlanItem, title: string): PlanItem {
  return { ...item, tasks: [...item.tasks, createTask(title, "custom")] };
}

export function renameTask(item: PlanItem, taskId: ID, title: string): PlanItem {
  return {
    ...item,
    tasks: item.tasks.map((task) => (task.id === taskId ? { ...task, title: title.trim() } : task)),
  };
}

export function removeTask(item: PlanItem, taskId: ID): PlanItem {
  return { ...item, tasks: item.tasks.filter((task) => task.id !== taskId) };
}

export function setTaskDone(item: PlanItem, taskId: ID, done: boolean, now: string): PlanItem {
  return {
    ...item,
    tasks: item.tasks.map((task) => {
      if (task.id !== taskId || task.done === done) return task;
      if (done) return { ...task, done, completedAt: now };
      const { completedAt: _cleared, ...rest } = task;
      return { ...rest, done };
    }),
  };
}

export function taskProgress(item: PlanItem): { done: number; total: number } {
  return { done: item.tasks.filter((task) => task.done).length, total: item.tasks.length };
}

// --- Reflection ----------------------------------------------------------

export function setNotes(item: PlanItem, notes: string, now: string): PlanItem {
  return item.notes === notes ? item : { ...item, notes, notesUpdatedAt: now };
}

export function setSummary(item: PlanItem, summary: string, now: string): PlanItem {
  return item.summary === summary ? item : { ...item, summary, summaryUpdatedAt: now };
}

// --- Reminder ------------------------------------------------------------

export function setReminder(item: PlanItem, reminder: Reminder | undefined): PlanItem {
  if (reminder) return { ...item, reminder };
  const { reminder: _removed, ...rest } = item;
  return rest;
}

// --- Time ----------------------------------------------------------------

export function addTimeLog(item: PlanItem, log: Omit<TimeLog, "id">): PlanItem {
  if (!(log.hours > 0)) throw new Error("Logged hours must be a positive number");
  return { ...item, timeLogs: [...item.timeLogs, { id: createId(), ...log }] };
}

export function removeTimeLog(item: PlanItem, logId: ID): PlanItem {
  return { ...item, timeLogs: item.timeLogs.filter((log) => log.id !== logId) };
}

export function loggedHours(item: PlanItem): number {
  return item.timeLogs.reduce((sum, log) => sum + log.hours, 0);
}
