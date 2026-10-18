import { BUILT_IN_SKILLS, DEMO_DATA, storedSkill } from "@/lib/catalog";
import { appendActivity, event, type NewEvent } from "@/lib/domain/activity";
import { newWorkspace } from "@/lib/domain/app-data";
import {
  addDays,
  addMonths,
  addQuarters,
  dayKey,
  daysBetween,
  monthKey,
  monthsBetween,
  parseMonthKey,
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
 *   logged) keep their month relative to today and their place in it: each
 *   earlier month is stretched onto its target month, and the current month
 *   up to the end of `writtenFor` onto the current month up to the end of
 *   today (then capped at now). The mapping is one increasing function of
 *   time, so the order of any two moments survives (created ≤ completed,
 *   created ≤ updated) in every time zone, and nothing lands in the future.
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

  const month = (value: MonthKey) => addMonths(value, monthOffset);
  const quarter = (value: QuarterKey) => addQuarters(value, quarterOffset);
  const relative = (value: DayKey) => addDays(todayKey, daysBetween(writtenFor, value));

  const nowMs = today.getTime();
  const writtenEnd = startOfDay(addDays(writtenFor, 1));
  const todayEnd = startOfDay(addDays(todayKey, 1));

  /** Where a moment that already happened lands: same place in its (shifted) month, never after now. */
  const pastMs = (ms: number): number => {
    const source = monthKey(new Date(ms));
    const target = addMonths(toMonth, monthsBetween(fromMonth, source));
    const [sourceStart, targetStart] = [startOfMonth(source), startOfMonth(target)];
    const [sourceEnd, targetEnd] =
      target === toMonth ? [writtenEnd, todayEnd] : [startOfMonth(addMonths(source, 1)), startOfMonth(addMonths(target, 1))];
    const mapped = targetStart + ((ms - sourceStart) * (targetEnd - targetStart)) / (sourceEnd - sourceStart);
    return Math.min(Math.round(mapped), nowMs);
  };

  const pastTimestamp = (value: string): string => new Date(pastMs(new Date(value).getTime())).toISOString();
  /** A past day goes where its local noon goes. */
  const pastDayKey = (value: DayKey): DayKey => dayKey(new Date(pastMs(startOfDay(value) + 12 * 3_600_000)));
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

/** Local midnight at the start of a day / month, in ms. */
function startOfDay(day: DayKey): number {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date).getTime();
}

function startOfMonth(month: MonthKey): number {
  const { year, month: m } = parseMonthKey(month);
  return new Date(year, m - 1, 1).getTime();
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
