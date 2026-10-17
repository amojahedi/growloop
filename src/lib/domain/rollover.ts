import { nextOrder } from "./board";
import { compareMonths, prevMonth } from "./dates";
import { withStatus } from "./plan-items";
import type { AppData, ID, MonthKey, PlanItem, RolloverDecision, RolloverRecord } from "./types";

/**
 * Month-end review (ADR 002): planned work left unfinished in earlier months
 * (To do / In progress) is never moved silently. The user decides per item to
 * carry it over, park it in the backlog, or drop it. Backlog items aren't
 * planned work, so they are not re-asked every month; the board's backlog
 * column keeps showing them (see board.ts).
 */

export interface PendingRollover {
  /** Month the review moves items into. */
  toMonth: MonthKey;
  /** Earlier months that still hold unfinished items, oldest first. */
  fromMonths: MonthKey[];
  /** Items to review from those months, oldest month first, then by position. */
  items: PlanItem[];
}

/** Planned-but-unfinished work that the month-end review asks about. */
export function needsReview(item: PlanItem): boolean {
  return item.status === "todo" || item.status === "in_progress";
}

/** Items to review that were planned before `currentMonth`, or `null` when there is nothing to review. */
export function pendingRollover(items: readonly PlanItem[], currentMonth: MonthKey): PendingRollover | null {
  const stale = items
    .filter((item) => needsReview(item) && compareMonths(item.month, currentMonth) < 0)
    .sort((a, b) => compareMonths(a.month, b.month) || a.order - b.order);

  if (stale.length === 0) return null;
  return {
    toMonth: currentMonth,
    fromMonths: [...new Set(stale.map((item) => item.month))],
    items: stale,
  };
}

/** The same decision for every item, e.g. "carry all over". */
export function bulkDecisions(items: readonly PlanItem[], decision: RolloverDecision): Record<ID, RolloverDecision> {
  return Object.fromEntries(items.map((item) => [item.id, decision]));
}

export interface ApplyRolloverResult {
  data: AppData;
  record: RolloverRecord;
}

/**
 * Applies review decisions. Items without a decision (or that don't need
 * review) are left untouched, so a review can be completed in several passes.
 * - carry_over: moves to `toMonth`, keeping its status; the old month is appended to `carriedFrom`.
 * - backlog: moves to `toMonth` with status "backlog"; also recorded in `carriedFrom`.
 * - drop: deletes the item.
 */
export function applyRollover(
  data: AppData,
  toMonth: MonthKey,
  decisions: Readonly<Record<ID, RolloverDecision>>,
  now: string,
): ApplyRolloverResult {
  const counts: Record<RolloverDecision, number> = { carry_over: 0, backlog: 0, drop: 0 };
  const sourceMonths: MonthKey[] = [];
  let planItems: PlanItem[] = [...data.planItems];

  // Oldest first, so carried items keep their relative order in the new columns.
  const candidates = [...data.planItems].sort((a, b) => compareMonths(a.month, b.month) || a.order - b.order);

  for (const item of candidates) {
    const decision = decisions[item.id];
    if (!decision || !needsReview(item) || compareMonths(item.month, toMonth) >= 0) continue;

    counts[decision] += 1;
    sourceMonths.push(item.month);

    if (decision === "drop") {
      planItems = planItems.filter((candidate) => candidate.id !== item.id);
      continue;
    }

    const status = decision === "backlog" ? "backlog" : item.status;
    const moved: PlanItem = {
      ...withStatus(item, status, now),
      month: toMonth,
      order: nextOrder(planItems, toMonth, status),
      carriedFrom: [...(item.carriedFrom ?? []), item.month],
    };
    planItems = planItems.map((candidate) => (candidate.id === item.id ? moved : candidate));
  }

  const record: RolloverRecord = {
    fromMonth: sourceMonths.sort(compareMonths).at(-1) ?? prevMonth(toMonth),
    toMonth,
    completedAt: now,
    counts,
  };

  return { data: { ...data, planItems, rollovers: [...data.rollovers, record] }, record };
}
