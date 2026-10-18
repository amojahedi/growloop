import { compareMonths, compareQuarters, parseMonthKey, quarterOf, yearOf } from "@/lib/domain/dates";
import { allKeyResults, countKeyResultsForItem, isLinkable } from "@/lib/domain/okrs";
import type { ID, KeyResult, MonthKey, Objective, PlanItem, QuarterKey } from "@/lib/domain/types";

/** Pure rules behind the card drawer (card-detail.md), unit-tested. */

/** The month a card belongs to on the board: Backlog is a rolling pool that belongs to the current month. */
export function cardMonth(item: Pick<PlanItem, "status" | "month">, currentMonth: MonthKey): MonthKey {
  return item.status === "backlog" ? currentMonth : item.month;
}

/**
 * Past-month and archived cards are read-only, except their summary, notes
 * and review dates (card-detail.md §Read-only mode). Backlog cards never are.
 */
export function isReadOnlyCard(
  item: Pick<PlanItem, "status" | "month">,
  currentMonth: MonthKey,
  archivedYears: readonly number[],
): boolean {
  if (item.status === "backlog") return false;
  return compareMonths(item.month, currentMonth) < 0 || archivedYears.includes(yearOf(item.month));
}

/** "September", or "December 2025" when the year differs from `relativeTo`'s. */
export function monthName(month: MonthKey, relativeTo?: MonthKey, locale = "en-US"): string {
  const { year, month: m } = parseMonthKey(month);
  const withYear = relativeTo !== undefined && yearOf(relativeTo) !== year;
  return new Date(year, m - 1, 1).toLocaleDateString(locale, withYear ? { month: "long", year: "numeric" } : { month: "long" });
}

/** "a", "a and b", "a, b and c". */
export function joinNames(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

/** The footer line for a carried card: "Carried over from August and September". Undefined when never carried. */
export function carriedOverLabel(item: Pick<PlanItem, "carriedFrom" | "month">): string | undefined {
  const months = item.carriedFrom ?? [];
  if (months.length === 0) return undefined;
  return `Carried over from ${joinNames(months.map((month) => monthName(month, item.month)))}`;
}

/** The undo toast after Remove from board (board.md): "Removed from October". */
export function removedMessage(item: Pick<PlanItem, "status" | "month">, currentMonth: MonthKey): string {
  if (item.status === "backlog") return "Removed from Backlog";
  return `Removed from ${monthName(item.month, currentMonth)}`;
}

// --- Skills (C-6) ---------------------------------------------------------------

export const MIN_CARD_SKILLS = 1;
export const MAX_CARD_SKILLS = 3;

/** Checks or unchecks a skill: 1–3 skills, new ones go last, the primary stays first. */
export function toggleCardSkill(skillIds: readonly ID[], skillId: ID): ID[] {
  if (skillIds.includes(skillId)) {
    return skillIds.length <= MIN_CARD_SKILLS ? [...skillIds] : skillIds.filter((id) => id !== skillId);
  }
  return skillIds.length >= MAX_CARD_SKILLS ? [...skillIds] : [...skillIds, skillId];
}

/** Makes a checked skill the primary one (first), keeping the others in order. */
export function setPrimarySkill(skillIds: readonly ID[], skillId: ID): ID[] {
  if (!skillIds.includes(skillId)) return [...skillIds];
  return [skillId, ...skillIds.filter((id) => id !== skillId)];
}

// --- Key result link (C-8) ---------------------------------------------------------

export interface KeyResultChoice {
  keyResult: KeyResult;
  objective: Objective;
  /** The KR's skill is on the card. */
  matches: boolean;
}

/**
 * Key results a card can link to by hand: any KR of an active objective outside
 * archived years (okrs-and-wizard.md §Auto-link). KRs whose skill is on the
 * card come first, then the card's own quarter, then by quarter.
 */
export function keyResultChoices(
  item: Pick<PlanItem, "skillIds" | "keyResultId">,
  objectives: readonly Objective[],
  archivedYears: readonly number[],
  quarter: QuarterKey,
): KeyResultChoice[] {
  return allKeyResults(objectives.filter((objective) => isLinkable(objective, archivedYears)))
    .filter(({ keyResult }) => keyResult.id !== item.keyResultId)
    .map(({ keyResult, objective }) => ({ keyResult, objective, matches: item.skillIds.includes(keyResult.skillId) }))
    .sort(
      (a, b) =>
        Number(b.matches) - Number(a.matches) ||
        Number(b.objective.quarter === quarter) - Number(a.objective.quarter === quarter) ||
        compareQuarters(a.objective.quarter, b.objective.quarter),
    );
}

/** "Also counts toward": the quarter's active count KRs with a skill on the card, except the linked one. */
export function alsoCountsToward(
  item: Pick<PlanItem, "skillIds" | "keyResultId">,
  objectives: readonly Objective[],
  quarter: QuarterKey,
): KeyResult[] {
  return countKeyResultsForItem(item, objectives, quarter)
    .map(({ keyResult }) => keyResult)
    .filter((keyResult) => keyResult.id !== item.keyResultId);
}

/** The quarter used for a card's KR rows. */
export const cardQuarter = (item: Pick<PlanItem, "status" | "month">, currentMonth: MonthKey): QuarterKey =>
  quarterOf(cardMonth(item, currentMonth));
