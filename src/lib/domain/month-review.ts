import { nextOrder } from "./board";
import { addMonths, compareMonths, compareQuarters, monthOf, prevMonth, yearOf, type DayKey } from "./dates";
import { summarizedItemIds } from "./notes";
import { checkMoveToNextQuarter, endedActiveObjectives, isMet, objectiveProgress, type MoveCheck } from "./okrs";
import { withStatus } from "./plan-items";
import type {
  ID,
  MonthKey,
  Note,
  Objective,
  PlanItem,
  QuarterKey,
  RolloverDecision,
  RolloverRecord,
  Skill,
  Workspace,
} from "./types";

/**
 * The month-end review (docs/product/specs/board.md#month-end-review, R-1 to
 * R-4): one non-blocking dialog that wraps up unfinished items, closes ended
 * quarters and archives finished years. Whether a review is pending is always
 * derived from the data, so there is no "review done" flag to get out of sync.
 */

export type ObjectiveDecision = "close" | "move";

export interface QuarterClose {
  quarter: QuarterKey;
  objectives: Objective[];
}

export interface PendingReview {
  /** The current month: carried-over items land here. */
  toMonth: MonthKey;
  /** Months being wrapped up, oldest first (e.g. ["2026-08", "2026-09"] → "Wrap up August and September"). */
  months: MonthKey[];
  /** Rule 1: To do / In progress items planned before the current month, oldest first. */
  unfinished: PlanItem[];
  /** Rule 2: active objectives in ended quarters, one block per quarter, oldest first. */
  quarters: QuarterClose[];
  /** Rule 3: earlier years to offer for archiving. */
  years: number[];
}

/** Decisions from the dialog. Anything left out gets its default, so `{}` applies every default. */
export interface MonthReviewDecisions {
  items?: Readonly<Record<ID, RolloverDecision>>;
  objectives?: Readonly<Record<ID, ObjectiveDecision>>;
  /** Year → archive it. */
  archive?: Readonly<Record<number, boolean>>;
}

type ReviewData = Pick<Workspace, "planItems" | "objectives" | "archivedYears" | "rollovers">;

/** Planned-but-unfinished work that the review asks about. Backlog is a rolling pool and never reviewed. */
export function needsReview(item: PlanItem): boolean {
  return item.status === "todo" || item.status === "in_progress";
}

function unfinishedItems(items: readonly PlanItem[], currentMonth: MonthKey): PlanItem[] {
  return items
    .filter((item) => needsReview(item) && compareMonths(item.month, currentMonth) < 0)
    .sort((a, b) => compareMonths(a.month, b.month) || a.order - b.order);
}

function quarterCloses(data: ReviewData, today: DayKey): QuarterClose[] {
  const ended = endedActiveObjectives(data.objectives, today).filter(
    (objective) => !data.archivedYears.includes(yearOf(objective.quarter)),
  );
  const quarters = [...new Set(ended.map((objective) => objective.quarter))].sort(compareQuarters);
  return quarters.map((quarter) => ({ quarter, objectives: ended.filter((objective) => objective.quarter === quarter) }));
}

/**
 * Rule 3: an earlier year that has objectives, isn't archived and wasn't
 * offered before. Every quarter of an earlier year has ended, so the quarter
 * close in the same review resolves its remaining active objectives.
 */
function yearsToWrap(data: ReviewData, today: DayKey): number[] {
  const currentYear = yearOf(today);
  const offered = new Set(data.rollovers.flatMap((record) => record.yearsOffered ?? []));
  const years = new Set(data.objectives.map((objective) => yearOf(objective.quarter)));
  return [...years]
    .filter((year) => year < currentYear && !data.archivedYears.includes(year) && !offered.has(year))
    .sort((a, b) => a - b);
}

/** What the review needs to decide, or `null` when nothing is pending. */
export function pendingReview(data: ReviewData, today: DayKey): PendingReview | null {
  const toMonth = monthOf(today);
  const unfinished = unfinishedItems(data.planItems, toMonth);
  const quarters = quarterCloses(data, today);
  const years = yearsToWrap(data, today);
  if (unfinished.length === 0 && quarters.length === 0 && years.length === 0) return null;

  const last = prevMonth(toMonth);
  let first = unfinished[0]?.month ?? last;
  if (compareMonths(first, last) > 0) first = last;
  const months: MonthKey[] = [];
  for (let month = first; compareMonths(month, last) <= 0; month = addMonths(month, 1)) months.push(month);

  return { toMonth, months, unfinished, quarters, years };
}

// --- Defaults -----------------------------------------------------------------------

/** In progress → carry over; To do → backlog; anything carried twice → backlog. */
export function defaultItemDecision(item: PlanItem): RolloverDecision {
  if ((item.carriedFrom?.length ?? 0) >= 2) return "backlog";
  return item.status === "in_progress" ? "carry_over" : "backlog";
}

export interface ResolvedDecisions {
  items: Record<ID, RolloverDecision>;
  objectives: Record<ID, ObjectiveDecision>;
  archive: Record<number, boolean>;
}

/** The dialog's starting state: every item, objective and year with its default. */
export function defaultDecisions(pending: PendingReview): ResolvedDecisions {
  return {
    items: Object.fromEntries(pending.unfinished.map((item) => [item.id, defaultItemDecision(item)])),
    objectives: Object.fromEntries(pending.quarters.flatMap((block) => block.objectives.map((o) => [o.id, "close" as const]))),
    archive: Object.fromEntries(pending.years.map((year) => [year, true])),
  };
}

// --- The one move ------------------------------------------------------------------

/**
 * Whether each ended objective can make its one move, decided in review order
 * as if the earlier choices were already applied: a move into another year
 * takes a slot, so two objectives can't both claim the last one. The dialog
 * shows these and `applyMonthReview` uses the same result, so they agree.
 * Met objectives never move.
 */
export function moveChecks(
  pending: PendingReview,
  data: Pick<Workspace, "objectives" | "planItems">,
  today: DayKey,
  decisions: Readonly<Record<ID, ObjectiveDecision>>,
): Map<ID, MoveCheck> {
  const checks = new Map<ID, MoveCheck>();
  let working = [...data.objectives];
  for (const objective of pending.quarters.flatMap((block) => block.objectives)) {
    const check = checkMoveToNextQuarter(objective, working, today);
    checks.set(objective.id, check);
    const moves = check.ok && decisions[objective.id] === "move" && !isMet(objectiveProgress(objective, data.planItems));
    if (moves) working = working.map((o) => (o.id === objective.id ? { ...o, quarter: check.to, movedFrom: o.quarter } : o));
  }
  return checks;
}

// --- Recap --------------------------------------------------------------------------

export interface ReviewRecap {
  finished: number;
  summarized: number;
  /** The skill with the most finished items, ties broken by skill order. */
  topSkillId?: ID;
}

/** "7 finished · 5 summarized · Roadmapping grew most" for the months being wrapped up. */
export function reviewRecap(
  items: readonly PlanItem[],
  notes: readonly Note[],
  skills: readonly Skill[],
  months: readonly MonthKey[],
): ReviewRecap {
  const period = new Set(months);
  const finished = items.filter((item) => item.status === "done" && item.completedAt && period.has(monthOf(item.completedAt)));
  const summarized = summarizedItemIds(notes);
  let topSkillId: ID | undefined;
  let best = 0;
  for (const skill of skills) {
    const count = finished.filter((item) => item.skillIds.includes(skill.id)).length;
    if (count > best) [topSkillId, best] = [skill.id, count];
  }
  return { finished: finished.length, summarized: finished.filter((item) => summarized.has(item.id)).length, topSkillId };
}

// --- Applying -----------------------------------------------------------------------

export interface MonthReviewResult {
  data: Workspace;
  record: RolloverRecord;
}

function applyItemDecisions(
  items: readonly PlanItem[],
  unfinished: readonly PlanItem[],
  decisions: Record<ID, RolloverDecision>,
  toMonth: MonthKey,
  now: string,
): { planItems: PlanItem[]; counts: Record<RolloverDecision, number> } {
  const counts: Record<RolloverDecision, number> = { carry_over: 0, backlog: 0, drop: 0 };
  let planItems = [...items];

  // Oldest first, so carried items keep their relative order in the new columns.
  for (const item of unfinished) {
    const decision = decisions[item.id];
    counts[decision] += 1;
    if (decision === "drop") {
      // The card goes; its notes and activity stay (notes keep their materialId).
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
  return { planItems, counts };
}

/**
 * Applies the review in one go. Scores are taken before items change, so a
 * dropped card can't lower the score its objective closes with. A move that
 * isn't allowed (moved before, year full, outside the window) closes instead.
 */
export function applyMonthReview(
  data: Workspace,
  input: MonthReviewDecisions,
  today: DayKey,
  now: string,
): MonthReviewResult | null {
  const pending = pendingReview(data, today);
  if (!pending) return null;
  const defaults = defaultDecisions(pending);
  const decisions: ResolvedDecisions = {
    items: withDefaults(defaults.items, input.items),
    objectives: withDefaults(defaults.objectives, input.objectives),
    archive: withDefaults(defaults.archive, input.archive),
  };

  const closed: ID[] = [];
  const moved: ID[] = [];
  const checks = moveChecks(pending, data, today, decisions.objectives);
  let objectives = data.objectives;
  for (const objective of pending.quarters.flatMap((block) => block.objectives)) {
    const score = objectiveProgress(objective, data.planItems);
    const move = checks.get(objective.id);
    const next: Objective =
      move?.ok === true && decisions.objectives[objective.id] === "move" && !isMet(score)
        ? { ...objective, quarter: move.to, movedFrom: objective.quarter }
        : { ...objective, status: "closed", finalProgress: score, closedAt: now };
    (next.status === "closed" ? closed : moved).push(objective.id);
    objectives = objectives.map((candidate) => (candidate.id === objective.id ? next : candidate));
  }

  const { planItems, counts } = applyItemDecisions(data.planItems, pending.unfinished, decisions.items, pending.toMonth, now);

  const yearsWithObjectives = new Set(objectives.map((objective) => yearOf(objective.quarter)));
  const archived = pending.years.filter((year) => decisions.archive[year] && yearsWithObjectives.has(year));

  const record: RolloverRecord = {
    fromMonth: pending.months.at(-1)!,
    toMonth: pending.toMonth,
    completedAt: now,
    counts,
    closedObjectiveIds: closed,
    movedObjectiveIds: moved,
    yearsOffered: pending.years,
  };

  return {
    data: {
      ...data,
      planItems,
      objectives,
      archivedYears: [...data.archivedYears, ...archived].sort((a, b) => a - b),
      rollovers: [...data.rollovers, record],
    },
    record,
  };
}

/** Defaults overridden by the given decisions, ignoring decisions for things the review doesn't cover. */
function withDefaults<K extends PropertyKey, V>(defaults: Record<K, V>, input: Readonly<Record<K, V>> | undefined): Record<K, V> {
  const result = { ...defaults };
  for (const key of Object.keys(input ?? {}) as K[]) {
    if (key in defaults && input![key] !== undefined) result[key] = input![key];
  }
  return result;
}
