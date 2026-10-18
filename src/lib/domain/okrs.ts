import {
  compareQuarters,
  nextQuarter,
  quarterDays,
  quarterElapsedShare,
  quarterKey,
  quarterOfDay,
  quarterRange,
  toDayKey,
  weeksLeftInQuarter,
  yearOf,
  type DayKey,
} from "./dates";
import { taskProgress } from "./plan-items";
import type { ID, KeyResult, Objective, PlanItem, QuarterKey } from "./types";

/**
 * OKR rules (docs/product/specs/okrs-and-wizard.md, ADR 007 and 011):
 * computed key-result progress, objective progress and pace, the plannable
 * window, the yearly cap, the wizard's quarter scope and the one allowed move.
 * Progress is expressed as whole percentages, 0–100.
 */

export const MAX_OBJECTIVES_PER_YEAR = 4;
export const MIN_KEY_RESULTS = 2;
export const MAX_KEY_RESULTS = 3;
export const MIN_COUNT = 1;
export const MAX_COUNT = 10;
/** Material and certification KRs never read 100% before their card is Done (and, for certifications, earned). */
export const UNFINISHED_PROGRESS_CAP = 99;
/** Points either side of the expected progress that still count as "On pace". */
export const PACE_TOLERANCE = 10;
/** The wizard skips the current quarter when fewer weeks than this remain. */
export const MIN_WEEKS_TO_PLAN_CURRENT_QUARTER = 6;

const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

// --- Key results ------------------------------------------------------------------

export type KeyResultProgress =
  | {
      type: "material" | "certification";
      progress: number;
      met: boolean;
      /** The linked card counted for progress, if any ("Not on your board yet" otherwise). */
      item?: PlanItem;
      /** Certifications: the card is Done but not marked earned yet ("Mark as earned"). */
      awaitingEarned: boolean;
    }
  | { type: "count"; progress: number; met: boolean; done: number; target: number };

/**
 * The days in which finished items count toward an objective's count KRs: its
 * quarter, or for a moved objective, from the original quarter's start to the
 * new quarter's end.
 */
export function objectiveWindow(objective: Pick<Objective, "quarter" | "movedFrom">): { start: DayKey; end: DayKey } {
  const first = objective.movedFrom && compareQuarters(objective.movedFrom, objective.quarter) < 0 ? objective.movedFrom : objective.quarter;
  return { start: quarterDays(first).start, end: quarterDays(objective.quarter).end };
}

/** Cards linked to a key result, best first: Done, then furthest along. */
export function linkedItems(keyResultId: ID, items: readonly PlanItem[]): PlanItem[] {
  const share = (item: PlanItem) => {
    const { done, total } = taskProgress(item);
    return total === 0 ? 0 : done / total;
  };
  return items
    .filter((item) => item.keyResultId === keyResultId)
    .sort((a, b) => Number(b.status === "done") - Number(a.status === "done") || share(b) - share(a));
}

/** A card's progress toward a material or certification KR. */
function itemProgress(item: PlanItem | undefined, isCertification: boolean): { progress: number; met: boolean } {
  if (!item) return { progress: 0, met: false };
  const finished = item.status === "done" && (!isCertification || item.earnedAt !== undefined);
  if (finished) return { progress: 100, met: true };
  const { done, total } = taskProgress(item);
  // A certification card that is Done but not earned stays below 100 too: 100% always means "met".
  const raw = item.status === "done" ? 100 : total === 0 ? 0 : (done / total) * 100;
  return { progress: Math.min(UNFINISHED_PROGRESS_CAP, clampPercent(raw)), met: false };
}

/** Done items tagged with the KR's skill (in any position), completed inside the objective's window. */
export function countedItems(keyResult: KeyResult, objective: Objective, items: readonly PlanItem[]): PlanItem[] {
  const { start, end } = objectiveWindow(objective);
  return items.filter((item) => {
    if (item.status !== "done" || !item.completedAt || !item.skillIds.includes(keyResult.skillId)) return false;
    const day = toDayKey(item.completedAt);
    return day >= start && day <= end;
  });
}

export function keyResultProgress(keyResult: KeyResult, objective: Objective, items: readonly PlanItem[]): KeyResultProgress {
  if (keyResult.type === "count") {
    const target = Math.max(MIN_COUNT, keyResult.count ?? MIN_COUNT);
    const done = countedItems(keyResult, objective, items).length;
    return { type: "count", progress: clampPercent((done / target) * 100), met: done >= target, done, target };
  }

  const item = linkedItems(keyResult.id, items)[0];
  const isCertification = keyResult.type === "certification";
  const { progress, met } = itemProgress(item, isCertification);
  return {
    type: keyResult.type,
    progress,
    met,
    item,
    awaitingEarned: isCertification && item?.status === "done" && item.earnedAt === undefined,
  };
}

// --- Objectives -------------------------------------------------------------------

/** Skills an objective works on, from its key results (first use first). */
export function objectiveSkillIds(objective: Pick<Objective, "keyResults">): ID[] {
  return [...new Set(objective.keyResults.map((kr) => kr.skillId))];
}

/** Mean of the key results, rounded; a closed objective keeps the score it closed with. */
export function objectiveProgress(objective: Objective, items: readonly PlanItem[]): number {
  if (objective.status === "closed" && objective.finalProgress !== undefined) return objective.finalProgress;
  const { keyResults } = objective;
  if (keyResults.length === 0) return 0;
  const total = keyResults.reduce((sum, kr) => sum + keyResultProgress(kr, objective, items).progress, 0);
  return Math.round(total / keyResults.length);
}

/** 100% means every key result is met (unfinished material and certification KRs are capped below it). */
export const isMet = (progress: number) => progress >= 100;

export function objectivesForQuarter(objectives: readonly Objective[], quarter: QuarterKey): Objective[] {
  return objectives.filter((objective) => objective.quarter === quarter);
}

export const activeObjectives = (objectives: readonly Objective[]) => objectives.filter((o) => o.status === "active");

export type Pace =
  | { kind: "ahead" | "on" | "behind"; expected: number }
  /** A future quarter: "Starts Jan 1". */
  | { kind: "upcoming"; startsOn: DayKey }
  /** Closed: "Closed at 64%" or "Met". */
  | { kind: "closed"; finalProgress: number; met: boolean }
  /** Still active in a quarter that has ended: waiting for the month-end review. */
  | { kind: "ended" };

/** Pace compares progress with the share of the quarter that has passed (current quarter only). */
export function objectivePace(objective: Objective, progress: number, today: DayKey): Pace {
  if (objective.status === "closed") {
    const finalProgress = objective.finalProgress ?? progress;
    return { kind: "closed", finalProgress, met: isMet(finalProgress) };
  }
  const current = quarterOfDay(today);
  const order = compareQuarters(objective.quarter, current);
  if (order > 0) return { kind: "upcoming", startsOn: quarterDays(objective.quarter).start };
  if (order < 0) return { kind: "ended" };

  const expected = Math.round(quarterElapsedShare(objective.quarter, today) * 100);
  const kind = progress >= expected + PACE_TOLERANCE ? "ahead" : progress < expected - PACE_TOLERANCE ? "behind" : "on";
  return { kind, expected };
}

// --- Plannable window and caps (O-1) -------------------------------------------------

/** From the current quarter through Q4 of next year. */
export function plannableQuarters(today: DayKey): QuarterKey[] {
  return quarterRange(quarterOfDay(today), quarterKey(yearOf(today) + 1, 4));
}

export function isPlannable(quarter: QuarterKey, today: DayKey): boolean {
  return plannableQuarters(today).includes(quarter);
}

/** Objectives (active and closed) placed in a calendar year. */
export function objectivesInYear(objectives: readonly Objective[], year: number): number {
  return objectives.filter((objective) => yearOf(objective.quarter) === year).length;
}

/** How many more objectives a year can take (never negative). */
export function roomInYear(objectives: readonly Objective[], year: number): number {
  return Math.max(0, MAX_OBJECTIVES_PER_YEAR - objectivesInYear(objectives, year));
}

/**
 * Quarters the wizard drafts for: every plannable quarter without an active
 * objective, skipping the current quarter when fewer than 6 weeks remain. The
 * yearly cap is applied as quarters are taken, earliest first, so a full draft
 * never exceeds it.
 */
export function wizardScope(objectives: readonly Objective[], today: DayKey): QuarterKey[] {
  const current = quarterOfDay(today);
  const occupied = new Set(activeObjectives(objectives).map((objective) => objective.quarter));
  const room = new Map<number, number>();
  const scope: QuarterKey[] = [];

  for (const quarter of plannableQuarters(today)) {
    if (occupied.has(quarter)) continue;
    if (quarter === current && weeksLeftInQuarter(today) < MIN_WEEKS_TO_PLAN_CURRENT_QUARTER) continue;
    const year = yearOf(quarter);
    const left = room.get(year) ?? roomInYear(objectives, year);
    if (left === 0) continue;
    room.set(year, left - 1);
    scope.push(quarter);
  }
  return scope;
}

// --- Quarter close and the one move (O-9) -------------------------------------------

/** Active objectives whose quarter has ended (the quarter close in the month-end review). */
export function endedActiveObjectives(objectives: readonly Objective[], today: DayKey): Objective[] {
  const current = quarterOfDay(today);
  return activeObjectives(objectives).filter((objective) => compareQuarters(objective.quarter, current) < 0);
}

export type MoveCheck =
  | { ok: true; to: QuarterKey }
  | { ok: false; reason: "already-moved" | "year-full"; to: QuarterKey }
  | { ok: false; reason: "outside-window" };

/**
 * Whether an ended objective can make its one move to the next quarter. The
 * move is hidden when that quarter is outside the plannable window (it was
 * missed entirely), and disabled when the objective moved before or the
 * target year is full.
 */
export function checkMoveToNextQuarter(objective: Objective, objectives: readonly Objective[], today: DayKey): MoveCheck {
  const to = nextQuarter(objective.quarter);
  if (!isPlannable(to, today)) return { ok: false, reason: "outside-window" };
  if (objective.movedFrom) return { ok: false, reason: "already-moved", to };
  const year = yearOf(to);
  // Moving within the same year doesn't take a new slot.
  if (yearOf(objective.quarter) !== year && roomInYear(objectives, year) === 0) return { ok: false, reason: "year-full", to };
  return { ok: true, to };
}

// --- Links between cards and key results ----------------------------------------------

/** Every key result with its objective. */
export function allKeyResults(objectives: readonly Objective[]): { keyResult: KeyResult; objective: Objective }[] {
  return objectives.flatMap((objective) => objective.keyResults.map((keyResult) => ({ keyResult, objective })));
}

export function findKeyResult(objectives: readonly Objective[], keyResultId: ID) {
  return allKeyResults(objectives).find((entry) => entry.keyResult.id === keyResultId);
}

/** Whether new cards may link to an objective's key results: active and not in an archived year. */
export function isLinkable(objective: Objective, archivedYears: readonly number[]): boolean {
  return objective.status === "active" && !archivedYears.includes(yearOf(objective.quarter));
}

/**
 * The key result a new card for `materialId` links itself to (auto-link): an
 * active material or certification KR targeting that material that no card is
 * linked to yet, earliest quarter first.
 */
export function autoLinkKeyResult(
  materialId: ID,
  objectives: readonly Objective[],
  items: readonly PlanItem[],
  archivedYears: readonly number[] = [],
): KeyResult | undefined {
  const linked = new Set(items.flatMap((item) => (item.keyResultId ? [item.keyResultId] : [])));
  return allKeyResults(objectives)
    .filter(
      ({ keyResult, objective }) =>
        keyResult.type !== "count" &&
        keyResult.materialId === materialId &&
        !linked.has(keyResult.id) &&
        isLinkable(objective, archivedYears),
    )
    .sort((a, b) => compareQuarters(a.objective.quarter, b.objective.quarter))[0]?.keyResult;
}

/**
 * Count KRs a card automatically counts toward ("Also counts toward"): active
 * count KRs in the quarter whose skill is on the card.
 */
export function countKeyResultsForItem(
  item: Pick<PlanItem, "skillIds">,
  objectives: readonly Objective[],
  quarter: QuarterKey,
): { keyResult: KeyResult; objective: Objective }[] {
  return allKeyResults(activeObjectives(objectivesForQuarter(objectives, quarter))).filter(
    ({ keyResult }) => keyResult.type === "count" && item.skillIds.includes(keyResult.skillId),
  );
}
