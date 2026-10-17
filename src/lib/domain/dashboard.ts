import { addDays, daysInMonth, monthOf, prevMonth, toDayKey, type DayKey } from "./dates";
import type { ActivityEvent, ID, MonthKey, PlanItem, Reminder, Skill } from "./types";

/**
 * Read-only selectors behind the monthly dashboard. "Completed in a month"
 * means the item's `completedAt` falls in that month, regardless of which
 * month it was planned for. History (hours, active days, streaks) comes from
 * the append-only activity log, so it survives edits and deleted items.
 */

// --- Items completed (core metric, see ADR 006) ----------------------------

export function completedInMonth(items: readonly PlanItem[], month: MonthKey): PlanItem[] {
  return items.filter(
    (item) => item.status === "done" && item.completedAt !== undefined && monthOf(item.completedAt) === month,
  );
}

export interface CompletionStats {
  count: number;
  previousCount: number;
  /** count − previousCount. */
  delta: number;
}

export function completionStats(items: readonly PlanItem[], month: MonthKey): CompletionStats {
  const count = completedInMonth(items, month).length;
  const previousCount = completedInMonth(items, prevMonth(month)).length;
  return { count, previousCount, delta: count - previousCount };
}

// --- Hours (optional) ------------------------------------------------------

const timeLogged = (activity: readonly ActivityEvent[], months: ReadonlySet<MonthKey>) =>
  activity.filter((event) => event.kind === "time_logged" && months.has(monthOf(event.day)));

const sumHours = (events: readonly ActivityEvent[]) => events.reduce((sum, event) => sum + (event.hours ?? 0), 0);

/** Hours logged in a month, or `null` when nothing was logged (hours are optional). */
export function hoursLoggedInMonth(activity: readonly ActivityEvent[], month: MonthKey): number | null {
  const logged = timeLogged(activity, new Set([month]));
  return logged.length === 0 ? null : sumHours(logged);
}

// --- Skill investment (radar) ----------------------------------------------

export interface SkillInvestment {
  skillId: ID;
  name: string;
  /** Items tagged with the skill and planned in the period. */
  planned: number;
  /** Items tagged with the skill and completed in the period. */
  completed: number;
  /** Hours logged in the period on items tagged with the skill (at the time). */
  hours: number;
}

/**
 * Per-skill investment over one or more months (pass a quarter's months for a
 * quarterly view). Every visible skill is returned, so a radar keeps stable axes.
 */
export function skillInvestment(
  items: readonly PlanItem[],
  activity: readonly ActivityEvent[],
  skills: readonly Skill[],
  months: MonthKey | readonly MonthKey[],
): SkillInvestment[] {
  const period = new Set(typeof months === "string" ? [months] : months);
  const logged = timeLogged(activity, period);

  return skills
    .filter((skill) => !skill.hidden)
    .map((skill) => {
      const tagged = items.filter((item) => item.skillIds.includes(skill.id));
      return {
        skillId: skill.id,
        name: skill.name,
        planned: tagged.filter((item) => period.has(item.month)).length,
        completed: tagged.filter(
          (item) => item.status === "done" && item.completedAt && period.has(monthOf(item.completedAt)),
        ).length,
        hours: sumHours(logged.filter((event) => event.skillIds.includes(skill.id))),
      };
    });
}

// --- Activity & streaks ----------------------------------------------------

/** Number of activity events per day. */
export function activityCounts(activity: readonly ActivityEvent[]): Map<DayKey, number> {
  const counts = new Map<DayKey, number>();
  for (const { day } of activity) counts.set(day, (counts.get(day) ?? 0) + 1);
  return counts;
}

export interface ActivityDay {
  date: DayKey;
  count: number;
}

export interface MonthActivity {
  /** Every day of the month, including inactive days (count 0). */
  days: ActivityDay[];
  activeDays: number;
  /** Longest run of consecutive active days within the month. */
  longestStreak: number;
}

export function monthActivity(activity: readonly ActivityEvent[], month: MonthKey): MonthActivity {
  const counts = activityCounts(activity);
  const days = daysInMonth(month).map((date) => ({ date, count: counts.get(date) ?? 0 }));

  let longestStreak = 0;
  let run = 0;
  for (const day of days) {
    run = day.count > 0 ? run + 1 : 0;
    longestStreak = Math.max(longestStreak, run);
  }

  return { days, activeDays: days.filter((day) => day.count > 0).length, longestStreak };
}

/**
 * Consecutive active days ending today. If today has no activity yet, the
 * streak ending yesterday is still "alive" and is returned.
 */
export function currentStreak(activity: readonly ActivityEvent[], today: DayKey): number {
  const counts = activityCounts(activity);
  let day = counts.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (counts.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

// --- Summaries & notes feed --------------------------------------------------

export interface Reflection {
  itemId: ID;
  materialId: ID;
  kind: "summary" | "notes";
  text: string;
  updatedAt: string;
}

/** Most recently edited non-empty summaries and notes, newest first. */
export function latestReflections(items: readonly PlanItem[], limit = 5): Reflection[] {
  const entries: Reflection[] = items.flatMap((item) => {
    const base = { itemId: item.id, materialId: item.materialId };
    const result: Reflection[] = [];
    if (item.summary.trim() && item.summaryUpdatedAt) {
      result.push({ ...base, kind: "summary", text: item.summary, updatedAt: item.summaryUpdatedAt });
    }
    if (item.notes.trim() && item.notesUpdatedAt) {
      result.push({ ...base, kind: "notes", text: item.notes, updatedAt: item.notesUpdatedAt });
    }
    return result;
  });

  return entries
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
    .slice(0, limit);
}

// --- Reminders ---------------------------------------------------------------

export interface UpcomingReminder {
  itemId: ID;
  materialId: ID;
  reminder: Reminder;
  overdue: boolean;
}

/**
 * Active reminders on unfinished items, soonest first. Overdue reminders are
 * included (flagged) so nothing slips; dismissed ones are not.
 */
export function upcomingReminders(
  items: readonly PlanItem[],
  today: DayKey,
  { withinDays, limit }: { withinDays?: number; limit?: number } = {},
): UpcomingReminder[] {
  const horizon = withinDays === undefined ? undefined : addDays(today, withinDays);

  const reminders = items
    .filter((item): item is PlanItem & { reminder: Reminder } =>
      Boolean(item.reminder && !item.reminder.dismissed && item.status !== "done"),
    )
    .filter((item) => horizon === undefined || toDayKey(item.reminder.date) <= horizon)
    .map((item) => ({
      itemId: item.id,
      materialId: item.materialId,
      reminder: item.reminder,
      overdue: toDayKey(item.reminder.date) < today,
    }))
    .sort((a, b) => toDayKey(a.reminder.date).localeCompare(toDayKey(b.reminder.date)));

  return limit === undefined ? reminders : reminders.slice(0, limit);
}
