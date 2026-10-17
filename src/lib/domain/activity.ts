import { dayKey, toDayKey } from "./dates";
import { createId } from "./ids";
import type { ActivityEvent, ActivityKind, ID, PlanItem } from "./types";

/**
 * The append-only activity log. Store actions don't write events by hand:
 * `syncActivity` diffs plan items before and after each change and records
 * what happened, so every action that completes, edits or logs is covered.
 *
 * Events are only ever added, with two exceptions: repeat events of the same
 * kind on the same day are collapsed (editing notes ten times on Tuesday is
 * one active day), and deleting a time log entry removes its event, since that
 * is a correction rather than history.
 */

type NewEvent = Omit<ActivityEvent, "id">;

function event(item: PlanItem, kind: ActivityKind, at: string, day: string, extra: Partial<NewEvent> = {}): NewEvent {
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

  if (after.notes.trim() && after.notes !== (before?.notes ?? "")) {
    events.push(event(after, "notes_edited", at, today));
  }
  if (after.summary.trim() && after.summary !== (before?.summary ?? "")) {
    events.push(event(after, "summary_edited", at, today));
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
 * Reconstructs a log from the timestamps on existing items (used when
 * upgrading v1 data, which had no log).
 */
export function backfillActivity(items: readonly PlanItem[]): ActivityEvent[] {
  const events: NewEvent[] = items.flatMap((item) => {
    const at = (value: string) => ({ at: new Date(value).toISOString(), day: toDayKey(value) });
    const result: NewEvent[] = [];
    if (item.status === "done" && item.completedAt) {
      const { at: when, day } = at(item.completedAt);
      result.push(event(item, "item_completed", when, day));
    }
    for (const task of item.tasks) {
      if (task.done && task.completedAt) {
        const { at: when, day } = at(task.completedAt);
        result.push(event(item, "task_completed", when, day, { refId: task.id }));
      }
    }
    if (item.notes.trim() && item.notesUpdatedAt) {
      const { at: when, day } = at(item.notesUpdatedAt);
      result.push(event(item, "notes_edited", when, day));
    }
    if (item.summary.trim() && item.summaryUpdatedAt) {
      const { at: when, day } = at(item.summaryUpdatedAt);
      result.push(event(item, "summary_edited", when, day));
    }
    for (const log of item.timeLogs) {
      const { at: when } = at(item.createdAt);
      result.push(event(item, "time_logged", when, toDayKey(log.date), { hours: log.hours, refId: log.id }));
    }
    return result;
  });

  return appendActivity([], events.sort((a, b) => a.day.localeCompare(b.day) || a.at.localeCompare(b.at)));
}
