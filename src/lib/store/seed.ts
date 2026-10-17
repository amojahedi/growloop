import { addMonths as addCalendarMonths } from "date-fns";
import { BUILT_IN_SKILLS, DEMO_DATA } from "@/lib/catalog";
import { newWorkspace } from "@/lib/domain/app-data";
import { addMonths, addQuarters, compareMonths, dayKey, monthKey, monthsBetween, quarterOf } from "@/lib/domain/dates";
import type { AppData, MonthKey, PlanItem, Workspace } from "@/lib/domain/types";
import { migrateAppData } from "./migrations";
import { validateWorkspace } from "./schema";

/** First-run data: an empty plan, or the sample workspace on the hosted demo. */

export const emptyWorkspace = (): Workspace => newWorkspace(BUILT_IN_SKILLS);

/** Upgrades authored seed data (schema v1) to the current schema via the regular migrations. */
export function upgradeSeed(seed: AppData): Workspace {
  const result = validateWorkspace(migrateAppData(structuredClone(seed), seed.version));
  if (!result.ok) throw new Error(`Seed data is invalid: ${result.error}`);
  return result.data;
}

/** The month a seed is written around: its latest planned month. */
export function seedBaseMonth(seed: AppData): MonthKey {
  const months = [...seed.planItems.map((item) => item.month), ...seed.rollovers.map((record) => record.toMonth)];
  return months.sort(compareMonths).at(-1) ?? monthKey(new Date());
}

/**
 * Moves every date in a seed by whole calendar months, so authored sample data
 * always looks current. Objectives stay in the same quarter relative to the
 * base month (e.g. "this quarter's" objectives remain this quarter's).
 */
export function shiftSeed(seed: AppData, toMonth: MonthKey): AppData {
  const base = seedBaseMonth(seed);
  const offset = monthsBetween(base, toMonth);
  if (offset === 0) return structuredClone(seed);

  const month = (value: MonthKey) => addMonths(value, offset);
  const date = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      return dayKey(addCalendarMonths(new Date(y, m - 1, d), offset));
    }
    return addCalendarMonths(new Date(value), offset).toISOString();
  };
  const maybeDate = (value: string | undefined) => (value === undefined ? undefined : date(value));
  const quarterShift = (quarter: string) =>
    addQuarters(quarterOf(toMonth), quarterIndex(quarter) - quarterIndex(quarterOf(base)));

  const shiftItem = (item: PlanItem): PlanItem => ({
    ...item,
    month: month(item.month),
    createdAt: date(item.createdAt),
    completedAt: maybeDate(item.completedAt),
    notesUpdatedAt: maybeDate(item.notesUpdatedAt),
    summaryUpdatedAt: maybeDate(item.summaryUpdatedAt),
    carriedFrom: item.carriedFrom?.map(month),
    reminder: item.reminder && { ...item.reminder, date: date(item.reminder.date) },
    tasks: item.tasks.map((task) => ({ ...task, completedAt: maybeDate(task.completedAt) })),
    timeLogs: item.timeLogs.map((log) => ({ ...log, date: date(log.date) })),
  });

  return dropUndefined({
    ...structuredClone(seed),
    planItems: seed.planItems.map(shiftItem),
    objectives: seed.objectives.map((objective) => ({
      ...objective,
      quarter: quarterShift(objective.quarter),
      createdAt: date(objective.createdAt),
    })),
    rollovers: seed.rollovers.map((record) => ({
      ...record,
      fromMonth: month(record.fromMonth),
      toMonth: month(record.toMonth),
      completedAt: date(record.completedAt),
    })),
  });
}

/** Absolute quarter number, for computing quarter distances. */
function quarterIndex(quarter: string): number {
  const [year, q] = quarter.split("-Q").map(Number);
  return year * 4 + q;
}

/** JSON round trip: removes keys set to `undefined` by the shifting above. */
const dropUndefined = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** The sample workspace, dated around the current month. */
export const demoWorkspace = (today: Date = new Date()): Workspace => upgradeSeed(shiftSeed(DEMO_DATA, monthKey(today)));
