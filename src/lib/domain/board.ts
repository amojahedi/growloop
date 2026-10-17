import { withStatus } from "./plan-items";
import { BOARD_COLUMNS, type BoardStatus, type ID, type MonthKey, type PlanItem } from "./types";

/**
 * Kanban operations. A board column is the set of items sharing a month and a
 * status; `order` is the item's position within that column.
 */

export type BoardColumns = Record<BoardStatus, PlanItem[]>;

const byOrder = (a: PlanItem, b: PlanItem) => a.order - b.order;

const inColumn = (month: MonthKey, status: BoardStatus) => (item: PlanItem) =>
  item.month === month && item.status === status;

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
  const monthItems = items.filter((item) => item.month === month && filter(item));
  return Object.fromEntries(
    BOARD_COLUMNS.map((status) => [status, monthItems.filter((item) => item.status === status).sort(byOrder)]),
  ) as BoardColumns;
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
}

/**
 * Moves an item to a status and position within its month, re-numbering the
 * affected columns so `order` stays contiguous (0..n-1).
 * Entering "done" stamps `completedAt`; leaving it clears `completedAt`.
 */
export function moveItem(items: readonly PlanItem[], itemId: ID, target: MoveTarget, now: string): PlanItem[] {
  const moving = items.find((item) => item.id === itemId);
  if (!moving) return [...items];

  const { month } = moving;
  const sourceStatus = moving.status;
  const targetColumn = columnItems(items, month, target.status).filter((item) => item.id !== itemId);
  const index = Math.max(0, Math.min(target.index ?? targetColumn.length, targetColumn.length));
  targetColumn.splice(index, 0, withStatus(moving, target.status, now));

  const updates = new Map<ID, PlanItem>();
  const renumber = (column: PlanItem[]) =>
    column.forEach((item, order) => updates.set(item.id, item.order === order ? item : { ...item, order }));

  renumber(targetColumn);
  if (sourceStatus !== target.status) {
    renumber(columnItems(items, month, sourceStatus).filter((item) => item.id !== itemId));
  }

  return items.map((item) => updates.get(item.id) ?? item);
}
