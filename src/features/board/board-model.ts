import { columnItems, type MoveTarget } from "@/lib/domain/board";
import { compareMonths } from "@/lib/domain/dates";
import { BOARD_COLUMNS, type BoardStatus, type ID, type MonthKey, type Objective, type PlanItem } from "@/lib/domain/types";
import type { ColumnIds } from "./drag-and-drop";

/**
 * Pure rules behind the board screen (docs/product/specs/board.md): the
 * progress line, the month switcher's range, filters and the ⋯ menu's moves.
 */

// --- Progress line ----------------------------------------------------------------

/** "{done} of {planned} done": planned is To do + In progress + Done in the month; Backlog never counts. */
export function monthProgress(items: readonly PlanItem[], month: MonthKey): { done: number; planned: number } {
  const inMonth = items.filter((item) => item.month === month && item.status !== "backlog");
  return { done: inMonth.filter((item) => item.status === "done").length, planned: inMonth.length };
}

// --- Month switcher ---------------------------------------------------------------

/** The earliest month the switcher can go back to: the first month with a plan item, never after the current one. */
export function earliestMonth(items: readonly PlanItem[], currentMonth: MonthKey): MonthKey {
  return items.reduce((earliest, item) => (compareMonths(item.month, earliest) < 0 ? item.month : earliest), currentMonth);
}

/** Past months are read-only (B-5). */
export const isPastMonth = (month: MonthKey, currentMonth: MonthKey) => compareMonths(month, currentMonth) < 0;

/** Backlog is a rolling pool that belongs to the current month, so past months hide it. */
export const visibleColumns = (readOnly: boolean): readonly BoardStatus[] =>
  readOnly ? BOARD_COLUMNS.filter((status) => status !== "backlog") : BOARD_COLUMNS;

// --- Filters ----------------------------------------------------------------------

export interface BoardFilters {
  /** Any of these skills (multi-select, like the Library). Empty = all skills. */
  skillIds: ID[];
  /** One of the viewed quarter's objectives, or "" for all. */
  objectiveId: ID;
}

export const NO_FILTERS: BoardFilters = { skillIds: [], objectiveId: "" };

/**
 * Whether a card works toward an objective: it is linked to one of its key
 * results, or a count KR counts its skill (count KRs count by skill, so
 * linking is optional there).
 */
export function worksToward(item: PlanItem, objective: Objective): boolean {
  return objective.keyResults.some(
    (kr) => kr.id === item.keyResultId || (kr.type === "count" && item.skillIds.includes(kr.skillId)),
  );
}

/** The filter predicate. An objective that isn't in the viewed quarter (`objective` undefined) filters nothing. */
export function matchesFilters(filters: BoardFilters, objective: Objective | undefined) {
  return (item: PlanItem) =>
    (filters.skillIds.length === 0 || filters.skillIds.some((id) => item.skillIds.includes(id))) &&
    (!objective || worksToward(item, objective));
}

// --- ⋯ menu -----------------------------------------------------------------------

export interface MenuMoves {
  /** Columns the card can move to, in board order (its own column omitted). */
  moveTo: BoardStatus[];
  /** Only when the card has a visible neighbour above / below. */
  up?: MoveTarget;
  down?: MoveTarget;
}

/**
 * What the ⋯ menu offers for a card. Moving to another column appends (same
 * rules as drag; leaving Backlog schedules into the viewed month). Up and down
 * swap with the visible neighbour, so they also work while filters hide cards:
 * the slot is found in the full, unfiltered column.
 */
export function menuMoves(
  columns: ColumnIds,
  itemId: ID,
  items: readonly PlanItem[],
  month: MonthKey,
  statuses: readonly BoardStatus[] = BOARD_COLUMNS,
): MenuMoves {
  const status = statuses.find((candidate) => columns[candidate].includes(itemId));
  if (!status) return { moveTo: [] };

  const visible = columns[status];
  const index = visible.indexOf(itemId);
  const full = columnItems(items, month, status)
    .map((item) => item.id)
    .filter((id) => id !== itemId);
  const above = visible[index - 1];
  const below = visible[index + 1];

  return {
    moveTo: statuses.filter((candidate) => candidate !== status),
    up: above === undefined ? undefined : { status, index: Math.max(0, full.indexOf(above)), month },
    down: below === undefined ? undefined : { status, index: full.indexOf(below) + 1, month },
  };
}

/** "Moved Inspired to In progress." */
export const movedToMessage = (title: string, label: string) => `Moved ${title} to ${label}.`;

// --- Certifications -----------------------------------------------------------------

/**
 * The name used in "Did you earn {short title}?": a trailing abbreviation in
 * brackets when there is one ("Certified Scrum Product Owner (CSPO)" → "CSPO"),
 * else the title.
 */
export function shortTitle(title: string): string {
  const abbreviation = /\(([^()]{2,24})\)\s*$/.exec(title)?.[1]?.trim();
  return abbreviation || title.trim();
}
