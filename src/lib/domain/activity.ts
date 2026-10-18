import { dayKey, toDayKey } from "./dates";
import { createId } from "./ids";
import type { ActivityEvent, ActivityKind, ID, Note, PlanItem } from "./types";

/**
 * The append-only activity log. Store actions don't write events by hand:
 * `syncActivity` diffs plan items and `syncNoteActivity` diffs notes before and
 * after each change and records what happened, so every action that
 * completes, writes or logs is covered.
 *
 * Events are only ever added, with two exceptions: repeat events of the same
 * kind on the same day are collapsed (editing notes ten times on Tuesday is
 * one active day), and deleting a time log entry removes its event, since that
 * is a correction rather than history.
 */

export type NewEvent = Omit<ActivityEvent, "id">;

type EventSource = Pick<PlanItem, "id" | "materialId" | "skillIds">;

export function event(item: EventSource, kind: ActivityKind, at: string, day: string, extra: Partial<NewEvent> = {}): NewEvent {
  return { kind, at, day, itemId: item.id, materialId: item.materialId, skillIds: [...item.skillIds], ...extra };
}

/** Activity implied by one item changing from `before` (undefined when new) to `after`. */
export function activityFromChange(before: PlanItem | undefined, after: PlanItem, now: Date): NewEvent[] {
  const at = now.toISOString();
  const today = dayKey(now);
  const events: NewEvent[] = [];

  if (after.status === "done" && before?.status !== "done") {
    events.push(event(after, "item_completed", at, today));
  }

  const wasDone = new Set(before?.tasks.filter((task) => task.done).map((task) => task.id));
  for (const task of after.tasks) {
    if (task.done && !wasDone.has(task.id)) {
      events.push(event(after, "task_completed", at, today, { refId: task.id }));
    }
  }

  const knownLogs = new Set(before?.timeLogs.map((log) => log.id));
  for (const log of after.timeLogs) {
    if (!knownLogs.has(log.id)) {
      // Counts on the day the user says they studied, not the day they logged it.
      events.push(event(after, "time_logged", at, toDayKey(log.date), { hours: log.hours, refId: log.id }));
    }
  }

  return events;
}

const dedupeKey = (event: NewEvent) =>
  event.kind === "time_logged" ? undefined : [event.kind, event.itemId, event.refId ?? "", event.day].join("|");

/** Appends events, collapsing repeats of the same kind for the same item (and task) on the same day. */
export function appendActivity(log: readonly ActivityEvent[], events: readonly NewEvent[]): ActivityEvent[] {
  if (events.length === 0) return [...log];
  const seen = new Set(log.map(dedupeKey).filter(Boolean));
  const added: ActivityEvent[] = [];
  for (const candidate of events) {
    const key = dedupeKey(candidate);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    added.push({ id: createId(), ...candidate });
  }
  return [...log, ...added];
}

/**
 * Updates the log for a change to the plan items. Items that disappear
 * (deleted, or dropped at rollover) keep their history.
 */
export function syncActivity(
  log: readonly ActivityEvent[],
  before: readonly PlanItem[],
  after: readonly PlanItem[],
  now: Date,
): ActivityEvent[] {
  const previous = new Map(before.map((item) => [item.id, item]));
  const events: NewEvent[] = [];
  const removedLogIds = new Set<ID>();

  for (const item of after) {
    const old = previous.get(item.id);
    if (old === item) continue;
    events.push(...activityFromChange(old, item, now));

    const remaining = new Set(item.timeLogs.map((entry) => entry.id));
    old?.timeLogs.forEach((entry) => !remaining.has(entry.id) && removedLogIds.add(entry.id));
  }

  const kept =
    removedLogIds.size === 0
      ? log
      : log.filter((entry) => !(entry.kind === "time_logged" && entry.refId && removedLogIds.has(entry.refId)));
  return appendActivity(kept, events);
}

/**
 * Activity implied by a note changing (ADR 010): writing a card's summary or
 * notes is learning activity. Free notes have no card, so they don't count.
 */
export function activityFromNoteChange(before: Note | undefined, after: Note, now: Date): NewEvent[] {
  if (after.kind === "free" || !after.planItemId || !after.materialId) return [];
  if (!after.body.trim() || after.body === (before?.body ?? "")) return [];
  const source = { id: after.planItemId, materialId: after.materialId, skillIds: after.skillIds };
  return [event(source, after.kind === "summary" ? "summary_edited" : "notes_edited", now.toISOString(), dayKey(now))];
}

/** Updates the log for a change to the notes. Clearing or deleting a note keeps its history. */
export function syncNoteActivity(
  log: readonly ActivityEvent[],
  before: readonly Note[],
  after: readonly Note[],
  now: Date,
): ActivityEvent[] {
  const previous = new Map(before.map((note) => [note.id, note]));
  const events = after.flatMap((note) => {
    const old = previous.get(note.id);
    return old === note ? [] : activityFromNoteChange(old, note, now);
  });
  return appendActivity(log, events);
}
