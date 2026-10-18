import type { MonthKey, QuarterKey } from "./types";

/**
 * Calendar helpers for month and quarter keys.
 *
 * Month keys ("2026-10") and day keys ("2026-10-17") are interpreted in the
 * user's local time zone: a task finished at 23:30 on 31 October counts for
 * October, wherever the user is.
 */

/** "YYYY-MM-DD" */
export type DayKey = string;

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;
const QUARTER_KEY = /^(\d{4})-Q([1-4])$/;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const pad = (value: number) => String(value).padStart(2, "0");

export function parseMonthKey(month: MonthKey): { year: number; month: number } {
  const match = MONTH_KEY.exec(month);
  if (!match) throw new Error(`Invalid month key: "${month}"`);
  return { year: Number(match[1]), month: Number(match[2]) };
}

export function parseQuarterKey(quarter: QuarterKey): { year: number; quarter: number } {
  const match = QUARTER_KEY.exec(quarter);
  if (!match) throw new Error(`Invalid quarter key: "${quarter}"`);
  return { year: Number(match[1]), quarter: Number(match[2]) };
}

/** Month key for a date (local time). */
export function monthKey(date: Date): MonthKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Day key for a date (local time). */
export function dayKey(date: Date): DayKey {
  return `${monthKey(date)}-${pad(date.getDate())}`;
}

/**
 * Day key for a stored date value. Accepts plain dates ("2026-10-17"), which are
 * kept as-is, and full ISO timestamps, which are converted to the local day.
 */
export function toDayKey(value: string): DayKey {
  if (DAY_KEY.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid date: "${value}"`);
  return dayKey(date);
}

/** Month key for a stored date value (plain date or ISO timestamp). */
export function monthOf(value: string): MonthKey {
  return toDayKey(value).slice(0, 7);
}

export function addMonths(month: MonthKey, delta: number): MonthKey {
  const { year, month: m } = parseMonthKey(month);
  const index = year * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${pad((index % 12) + 1)}`;
}

export const prevMonth = (month: MonthKey): MonthKey => addMonths(month, -1);

/** Whole months from `from` to `to` (negative when `to` is earlier). */
export function monthsBetween(from: MonthKey, to: MonthKey): number {
  const a = parseMonthKey(from);
  const b = parseMonthKey(to);
  return (b.year - a.year) * 12 + (b.month - a.month);
}

/** Negative when `a` is before `b`. Month keys sort lexicographically. */
export function compareMonths(a: MonthKey, b: MonthKey): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The calendar year of a day, month or quarter key. */
export function yearOf(key: string): number {
  return Number(key.slice(0, 4));
}

export function quarterKey(year: number, quarter: number): QuarterKey {
  return `${year}-Q${quarter}`;
}

export function quarterOf(month: MonthKey): QuarterKey {
  const { year, month: m } = parseMonthKey(month);
  return `${year}-Q${Math.ceil(m / 3)}`;
}

export function monthsInQuarter(quarter: QuarterKey): [MonthKey, MonthKey, MonthKey] {
  const { year, quarter: q } = parseQuarterKey(quarter);
  const first = (q - 1) * 3 + 1;
  return [`${year}-${pad(first)}`, `${year}-${pad(first + 1)}`, `${year}-${pad(first + 2)}`];
}

export function addQuarters(quarter: QuarterKey, delta: number): QuarterKey {
  const [first] = monthsInQuarter(quarter);
  return quarterOf(addMonths(first, delta * 3));
}

export const nextQuarter = (quarter: QuarterKey): QuarterKey => addQuarters(quarter, 1);

/** Negative when `a` is before `b`. Quarter keys sort lexicographically. */
export const compareQuarters = compareMonths;

/** Quarters from `from` to `to`, both included (empty when `to` is earlier). */
export function quarterRange(from: QuarterKey, to: QuarterKey): QuarterKey[] {
  const quarters: QuarterKey[] = [];
  for (let quarter = from; compareQuarters(quarter, to) <= 0; quarter = nextQuarter(quarter)) quarters.push(quarter);
  return quarters;
}

/** The quarter a day falls in. */
export const quarterOfDay = (day: DayKey): QuarterKey => quarterOf(day.slice(0, 7));

/** First and last day of a quarter. */
export function quarterDays(quarter: QuarterKey): { start: DayKey; end: DayKey } {
  const [first, , last] = monthsInQuarter(quarter);
  return { start: `${first}-01`, end: daysInMonth(last).at(-1)! };
}

/** Whole days from `from` to `to` (negative when `to` is earlier). Immune to DST changes. */
export function daysBetween(from: DayKey, to: DayKey): number {
  const utc = (day: DayKey) => {
    const [year, month, date] = day.split("-").map(Number);
    return Date.UTC(year, month - 1, date);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/** Days left in today's quarter, today included. */
export function daysLeftInQuarter(today: DayKey): number {
  return daysBetween(today, quarterDays(quarterOfDay(today)).end) + 1;
}

/** Weeks left in today's quarter, today included (fractional, e.g. 5.6). */
export const weeksLeftInQuarter = (today: DayKey): number => daysLeftInQuarter(today) / 7;

/**
 * Share of a quarter that has passed by the end of `today` (0–1): 0 before it
 * starts, 1 after it ends.
 */
export function quarterElapsedShare(quarter: QuarterKey, today: DayKey): number {
  const { start, end } = quarterDays(quarter);
  const total = daysBetween(start, end) + 1;
  const elapsed = daysBetween(start, today) + 1;
  return Math.min(1, Math.max(0, elapsed / total));
}

/** All day keys of a month, in order. */
export function daysInMonth(month: MonthKey): DayKey[] {
  const { year, month: m } = parseMonthKey(month);
  const count = new Date(year, m, 0).getDate();
  return Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`);
}

/** Day key `delta` days away from `day`. */
export function addDays(day: DayKey, delta: number): DayKey {
  const [year, month, date] = day.split("-").map(Number);
  return dayKey(new Date(year, month - 1, date + delta));
}

/** Human label, e.g. "October 2026". */
export function formatMonth(month: MonthKey, locale = "en-US"): string {
  const { year, month: m } = parseMonthKey(month);
  return new Date(year, m - 1, 1).toLocaleDateString(locale, { month: "long", year: "numeric" });
}

/** Human label, e.g. "Q4 2026". */
export function formatQuarter(quarter: QuarterKey): string {
  const { year, quarter: q } = parseQuarterKey(quarter);
  return `Q${q} ${year}`;
}
