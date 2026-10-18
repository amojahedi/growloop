import { BUILT_IN_SKILLS, DEMO_DATA, storedSkill } from "@/lib/catalog";
import { appendActivity, event, type NewEvent } from "@/lib/domain/activity";
import { newWorkspace } from "@/lib/domain/app-data";
import {
  addDays,
  addMonths,
  addQuarters,
  dayKey,
  daysBetween,
  daysInMonth,
  monthsBetween,
  parseQuarterKey,
  quarterOf,
  toDayKey,
  yearOf,
  type DayKey,
} from "@/lib/domain/dates";
import type { ActivityEvent, MonthKey, Note, Objective, PlanItem, QuarterKey, Workspace } from "@/lib/domain/types";
import { migrateAppData } from "./migrations";
import { validateWorkspace } from "./schema";

/** First-run data: an empty plan, and the sample workspace for sample mode (sample-data.md, ADR 009). */

export const emptyWorkspace = (): Workspace => newWorkspace(BUILT_IN_SKILLS.map(storedSkill));

// --- Shifting ------------------------------------------------------------------------

/**
 * Moves every date in a workspace written around `writtenFor` so it reads as
 * if written around `today` (sample-data.md: "authored in the current schema,
 * shifted to today"). Three kinds of dates, three rules:
 *
 * - **Months and quarters** (board months, carried-from months, reviews,
 *   objective quarters) move by whole months and quarters, so this month's
 *   board stays this month's and this quarter's objective stays this quarter's.
 * - **Things that already happened** (created, completed, earned, reviewed,
 *   logged) keep their month relative to today and their time of day. Inside
 *   the current month, days 1…writtenFor are spread over days 1…today, so
 *   nothing lands in the future; earlier months keep their day (clamped).
 * - **Days relative to today** (note review days, reminders) keep their
 *   distance from today: due today stays due today, "in 3 days" stays in 3 days.
 *
 * Years before today's that hold only closed objectives are archived, so the
 * sample never opens with a year wrap pending. Pure: the input is untouched.
 */
export function shiftSeed(seed: Workspace, writtenFor: DayKey, today: Date): Workspace {
  const todayKey = dayKey(today);
  const fromMonth = writtenFor.slice(0, 7);
  const toMonth = todayKey.slice(0, 7);
  const monthOffset = monthsBetween(fromMonth, toMonth);
  const quarterOffset = quarterIndex(quarterOf(toMonth)) - quarterIndex(quarterOf(fromMonth));
  const fromDay = Number(writtenFor.slice(8, 10));
  const toDay = Number(todayKey.slice(8, 10));

  const month = (value: MonthKey) => addMonths(value, monthOffset);
  const quarter = (value: QuarterKey) => addQuarters(value, quarterOffset);
  const relative = (value: DayKey) => addDays(todayKey, daysBetween(writtenFor, value));

  /** The new [month, day] for a day that already happened. */
  const pastDay = (year: number, monthIndex: number, date: number): [MonthKey, number] => {
    const authored = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const target = addMonths(toMonth, monthsBetween(fromMonth, authored));
    if (target === toMonth) {
      const spread = fromDay <= 1 ? toDay : 1 + Math.round(((Math.min(date, fromDay) - 1) * (toDay - 1)) / (fromDay - 1));
      return [target, spread];
    }
    return [target, Math.min(date, daysInMonth(target).length)];
  };

  const pastDayKey = (value: DayKey): DayKey => {
    const [y, m, d] = value.split("-").map(Number);
    const [target, date] = pastDay(y, m - 1, d);
    const result = `${target}-${String(date).padStart(2, "0")}`;
    return result > todayKey ? todayKey : result;
  };

  const pastTimestamp = (value: string): string => {
    const source = new Date(value);
    const [target, date] = pastDay(source.getFullYear(), source.getMonth(), source.getDate());
    const [y, m] = target.split("-").map(Number);
    const moved = new Date(source);
    moved.setFullYear(y, m - 1, date);
    return (moved > today ? today : moved).toISOString();
  };
  const maybePast = (value: string | undefined) => (value === undefined ? undefined : pastTimestamp(value));

  const shiftItem = (item: PlanItem): PlanItem => ({
    ...item,
    month: month(item.month),
    createdAt: pastTimestamp(item.createdAt),
    completedAt: maybePast(item.completedAt),
    earnedAt: maybePast(item.earnedAt),
    summaryNudgedAt: maybePast(item.summaryNudgedAt),
    carriedFrom: item.carriedFrom?.map(month),
    reminder: item.reminder && { ...item.reminder, date: relative(item.reminder.date) },
    tasks: item.tasks.map((task) => ({ ...task, completedAt: maybePast(task.completedAt) })),
    timeLogs: item.timeLogs.map((log) => ({ ...log, date: pastDayKey(log.date) })),
  });

  const shiftNote = (note: Note): Note => ({
    ...note,
    createdAt: pastTimestamp(note.createdAt),
    updatedAt: pastTimestamp(note.updatedAt),
    lastReviewedAt: maybePast(note.lastReviewedAt),
    refinedAt: maybePast(note.refinedAt),
    reviewAt: note.reviewAt === undefined ? undefined : relative(note.reviewAt),
  });

  const shiftObjective = (objective: Objective): Objective => ({
    ...objective,
    quarter: quarter(objective.quarter),
    movedFrom: objective.movedFrom === undefined ? undefined : quarter(objective.movedFrom),
    createdAt: pastTimestamp(objective.createdAt),
    closedAt: maybePast(objective.closedAt),
  });

  const objectives = seed.objectives.map(shiftObjective);
  return dropUndefined({
    ...structuredClone(seed),
    profile: {
      ...seed.profile,
      skillLevels: seed.profile.skillLevels.map((level) => ({ ...level, updatedAt: pastTimestamp(level.updatedAt) })),
    },
    objectives,
    planItems: seed.planItems.map(shiftItem),
    notes: seed.notes.map(shiftNote),
    rollovers: seed.rollovers.map((record) => ({
      ...record,
      fromMonth: month(record.fromMonth),
      toMonth: month(record.toMonth),
      completedAt: pastTimestamp(record.completedAt),
    })),
    activity: seed.activity.map((entry) => ({ ...entry, at: pastTimestamp(entry.at), day: pastDayKey(entry.day) })),
    archivedYears: finishedYears(objectives, yearOf(todayKey)),
  });
}

/** Years before `currentYear` whose objectives are all closed: nothing left to wrap up. */
function finishedYears(objectives: readonly Objective[], currentYear: number): number[] {
  const years = [...new Set(objectives.map((objective) => yearOf(objective.quarter)))].filter((year) => year < currentYear);
  return years
    .filter((year) => objectives.every((objective) => yearOf(objective.quarter) !== year || objective.status === "closed"))
    .sort((a, b) => a - b);
}

/** Absolute quarter number, for quarter distances. */
function quarterIndex(quarter: QuarterKey): number {
  const { year, quarter: q } = parseQuarterKey(quarter);
  return year * 4 + q;
}

/** JSON round trip: removes keys set to `undefined` by the shifting above. */
const dropUndefined = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

// --- Activity --------------------------------------------------------------------------

/**
 * Rebuilds the activity log from the dates on cards and notes (the seed
 * doesn't author it), so streaks, active days and the radar match the story.
 */
export function rebuildActivity(workspace: Pick<Workspace, "planItems" | "notes">): ActivityEvent[] {
  const when = (value: string) => ({ at: new Date(value).toISOString(), day: toDayKey(value) });
  const events: NewEvent[] = workspace.planItems.flatMap((item) => {
    const result: NewEvent[] = [];
    if (item.status === "done" && item.completedAt) {
      const { at, day } = when(item.completedAt);
      result.push(event(item, "item_completed", at, day));
    }
    for (const task of item.tasks) {
      if (!task.done || !task.completedAt) continue;
      const { at, day } = when(task.completedAt);
      result.push(event(item, "task_completed", at, day, { refId: task.id }));
    }
    for (const log of item.timeLogs) {
      result.push(event(item, "time_logged", when(item.createdAt).at, log.date, { hours: log.hours, refId: log.id }));
    }
    return result;
  });

  const items = new Map(workspace.planItems.map((item) => [item.id, item]));
  for (const note of workspace.notes) {
    const item = note.planItemId ? items.get(note.planItemId) : undefined;
    if (note.kind === "free" || !item || !note.body.trim()) continue;
    const { at, day } = when(note.updatedAt);
    events.push(event(item, note.kind === "summary" ? "summary_edited" : "notes_edited", at, day));
  }

  return appendActivity([], events.sort((a, b) => a.day.localeCompare(b.day) || a.at.localeCompare(b.at)));
}

// --- The sample ------------------------------------------------------------------------

/**
 * A fresh sample workspace, dated around `today`. Authored seeds pass through
 * the regular migrations (a no-op for the current schema), so any authored
 * version loads. Throws if the result doesn't validate: a dev bug that
 * seed.test.ts guards against (sample mode then isn't entered).
 */
export function sampleWorkspace(today: Date = new Date()): Workspace {
  const { writtenFor, ...authored } = DEMO_DATA as Partial<Pick<typeof DEMO_DATA, "writtenFor">> & { version: number };
  const upgraded = migrateAppData(structuredClone(authored), authored.version) as Workspace;
  const shifted = shiftSeed(upgraded, writtenFor ?? dayKey(today), today);
  const result = validateWorkspace({ ...shifted, activity: rebuildActivity(shifted) });
  if (!result.ok) throw new Error(`Seed data is invalid: ${result.error}`);
  return result.data;
}
