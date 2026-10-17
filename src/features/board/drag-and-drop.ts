import { arrayMove } from "@dnd-kit/sortable";
import { columnItems, type BoardColumns, type MoveTarget } from "@/lib/domain/board";
import { BOARD_COLUMNS, type BoardStatus, type ID, type MonthKey, type PlanItem } from "@/lib/domain/types";

/** Visible card ids per column, in board order. This is what a drag rearranges. */
export type ColumnIds = Record<BoardStatus, ID[]>;

// Prefixed so a column can never be mistaken for a card id.
export const columnDropId = (status: BoardStatus) => `column:${status}`;
export const isColumnDropId = (id: ID) => id.startsWith("column:");

export function toColumnIds(columns: BoardColumns): ColumnIds {
  return Object.fromEntries(BOARD_COLUMNS.map((status) => [status, columns[status].map((item) => item.id)])) as ColumnIds;
}

/** The column an id belongs to: either the column's own drop id or a card in it. */
export function columnOf(columns: ColumnIds, id: ID): BoardStatus | undefined {
  return BOARD_COLUMNS.find((status) => id === columnDropId(status) || columns[status].includes(id));
}

/**
 * Moves the dragged card to the slot of whatever it is over. In another column
 * it goes before the hovered card (after it when `after`), or to the end when
 * over the column itself; in its own column it takes the hovered card's slot.
 * Returns `columns` unchanged when there is nothing to do.
 */
export function moveCard(columns: ColumnIds, activeId: ID, overId: ID, after = false): ColumnIds {
  const from = columnOf(columns, activeId);
  const to = columnOf(columns, overId);
  if (!from || !to || activeId === overId) return columns;

  if (from === to) {
    const column = columns[to];
    const overIndex = column.indexOf(overId);
    // Over the column's empty space: the card keeps its slot.
    if (overIndex === -1) return columns;
    return { ...columns, [to]: arrayMove(column, column.indexOf(activeId), overIndex) };
  }

  const target = columns[to];
  const overIndex = target.indexOf(overId);
  const index = overIndex === -1 ? target.length : overIndex + (after ? 1 : 0);
  return {
    ...columns,
    [from]: columns[from].filter((id) => id !== activeId),
    [to]: [...target.slice(0, index), activeId, ...target.slice(index)],
  };
}

/**
 * Where a dropped card lands, as a `moveItem` target, or undefined if it ends
 * where it started. `columns` only holds visible cards, so the slot is anchored
 * to the visible card above it in the full (unfiltered) column; a card dropped
 * at the top of a column goes to the very top.
 */
export function dropTarget(
  columns: ColumnIds,
  activeId: ID,
  items: readonly PlanItem[],
  month: MonthKey,
): MoveTarget | undefined {
  const status = columnOf(columns, activeId);
  if (!status) return undefined;

  const visible = columns[status];
  const full = columnItems(items, month, status).map((item) => item.id);
  const above = visible[visible.indexOf(activeId) - 1];
  const index = above === undefined ? 0 : full.filter((id) => id !== activeId).indexOf(above) + 1;

  // Already in this column at this index (removing the card doesn't shift its own index).
  if (full.indexOf(activeId) === index) return undefined;
  return { status, index, month };
}
