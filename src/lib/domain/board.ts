import { compareMonths } from "./dates";
import { withStatus } from "./plan-items";
import { BOARD_COLUMNS, type BoardStatus, type ID, type MonthKey, type PlanItem } from "./types";

/**
 * Kanban operations. A board column is the set of items with a status in the
 * viewed month; `order` is the item's position within that column.
 *
 * The backlog is a rolling pool: a month's backlog column also shows backlog
 * items left in earlier months, since the month-end review doesn't move them.
 * Moving such an item into another column schedules it in the viewed month.
 */

export type BoardColumns = Record<BoardStatus, PlanItem[]>;

const byOrder = (a: PlanItem, b: PlanItem) => a.order - b.order || compareMonths(a.month, b.month);

const inColumn = (month: MonthKey, status: BoardStatus) => (item: PlanItem) =>
  item.status === status && (status === "backlog" ? compareMonths(item.month, month) <= 0 : item.month === month);

/** Items of one column, sorted by position. */
export function columnItems(items: readonly PlanItem[], month: MonthKey, status: BoardStatus): PlanItem[] {
  return items.filter(inColumn(month, status)).sort(byOrder);
}

/** All four columns for a month, optionally narrowed by a predicate (e.g. a skill filter). */
export function boardColumns(
  items: readonly PlanItem[],
  month: MonthKey,
  filter: (item: PlanItem) => boolean = () => true,
): BoardColumns {
  const visible = items.filter(filter);
  return Object.fromEntries(BOARD_COLUMNS.map((status) => [status, columnItems(visible, month, status)])) as BoardColumns;
}

/** The `order` that appends an item to the end of a column. */
export function nextOrder(items: readonly PlanItem[], month: MonthKey, status: BoardStatus): number {
  const column = items.filter(inColumn(month, status));
  return column.length === 0 ? 0 : Math.max(...column.map((item) => item.order)) + 1;
}

export interface MoveTarget {
  status: BoardStatus;
  /** Position in the target column (excluding the moved item). Clamped; omit to append. */
  index?: number;
  /** The board's month. Defaults to the item's month; items leaving the backlog are scheduled into it. */
  month?: MonthKey;
}

/**
 * Moves an item to a status and position, re-numbering the affected columns so
 * `order` stays contiguous (0..n-1).
 * Entering "done" stamps `completedAt`; leaving it clears `completedAt`.
 */
export function moveItem(items: readonly PlanItem[], itemId: ID, target: MoveTarget, now: string): PlanItem[] {
  const moving = items.find((item) => item.id === itemId);
  if (!moving) return [...items];

  const boardMonth = target.month ?? moving.month;
  // Backlog items keep the month they were parked in; anything else joins the board's month.
  const month = target.status === "backlog" ? moving.month : boardMonth;
  const sourceStatus = moving.status;

  const targetColumn = columnItems(items, boardMonth, target.status).filter((item) => item.id !== itemId);
  const index = Math.max(0, Math.min(target.index ?? targetColumn.length, targetColumn.length));
  targetColumn.splice(index, 0, { ...withStatus(moving, target.status, now), month });

  const updates = new Map<ID, PlanItem>();
  const renumber = (column: PlanItem[]) =>
    column.forEach((item, order) => updates.set(item.id, item.order === order ? item : { ...item, order }));

  renumber(targetColumn);
  if (sourceStatus !== target.status) {
    renumber(columnItems(items, boardMonth, sourceStatus).filter((item) => item.id !== itemId));
  }

  return items.map((item) => {
    const updated = updates.get(item.id);
    if (!updated) return item;
    // Keep untouched items referentially equal.
    return item.id !== itemId && updated.order === item.order ? item : updated;
  });
}
