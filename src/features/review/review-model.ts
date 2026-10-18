import { formatQuarter, monthOf, nextQuarter, yearOf } from "@/lib/domain/dates";
import type { ObjectiveDecision, PendingReview } from "@/lib/domain/month-review";
import { isMet, objectiveProgress, type MoveCheck } from "@/lib/domain/okrs";
import type { ID, MonthKey, Objective, PlanItem, QuarterKey } from "@/lib/domain/types";
import { monthsLabel } from "./labels";

/** Copy and derived figures for the month-end review (board.md §The review dialog). */

/** "September" / "August and September" + "is" / "are". */
export function wrappedUp(months: readonly MonthKey[]): string {
  return `${monthsLabel(months)} ${months.length > 1 ? "are" : "is"} wrapped up.`;
}

export function banner(months: readonly MonthKey[]): string {
  return `${monthsLabel(months)} ${months.length > 1 ? "are" : "is"} done. Wrap it up in a minute.`;
}

/** "Q3", or "Q3 2025" when the quarter isn't in the current year. */
export function quarterLabel(quarter: QuarterKey, currentYear: number): string {
  const [name, year] = formatQuarter(quarter).split(" ");
  return Number(year) === currentYear ? name : `${name} ${year}`;
}

/** What actually happens to an ended objective, given the user's choice and the one-move check. */
export function effectiveDecision(score: number, choice: ObjectiveDecision | undefined, check: MoveCheck | undefined): ObjectiveDecision {
  return choice === "move" && check?.ok === true && !isMet(score) ? "move" : "close";
}

/** Why "Move to …" is unavailable: shown as a hint next to the disabled option. */
export function moveHint(objective: Pick<Objective, "quarter">, check: MoveCheck): string | undefined {
  if (check.ok || check.reason === "outside-window") return undefined;
  if (check.reason === "already-moved") return "Already moved once";
  return `${yearOf(nextQuarter(objective.quarter))} already has 4 objectives`;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * "2026 is done: 41 things finished, 4 objectives closed." Counts items
 * finished during the year and its objectives that are closed once this
 * review is applied (moved ones leave the year or stay active).
 */
export function yearSummary(
  year: number,
  items: readonly PlanItem[],
  objectives: readonly Objective[],
  pending: PendingReview,
  decisions: Readonly<Record<ID, ObjectiveDecision>>,
  checks: ReadonlyMap<ID, MoveCheck>,
): string {
  const finished = items.filter((item) => item.status === "done" && item.completedAt && yearOf(monthOf(item.completedAt)) === year);
  const reviewed = new Map(pending.quarters.flatMap((block) => block.objectives.map((objective) => [objective.id, objective])));
  const closed = objectives.filter((objective) => {
    if (yearOf(objective.quarter) !== year) return false;
    if (!reviewed.has(objective.id)) return objective.status === "closed";
    const score = objectiveProgress(objective, items);
    return effectiveDecision(score, decisions[objective.id], checks.get(objective.id)) === "close";
  });
  return `${year} is done: ${plural(finished.length, "thing", "things")} finished, ${plural(closed.length, "objective", "objectives")} closed.`;
}
