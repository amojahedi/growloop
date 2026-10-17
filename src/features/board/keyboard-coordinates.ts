import { KeyboardCode, type ClientRect, type KeyboardCoordinateGetter } from "@dnd-kit/core";
import { BOARD_COLUMNS, type BoardStatus } from "@/lib/domain/types";
import { columnDropId } from "./drag-and-drop";

const ARROWS: string[] = [KeyboardCode.Up, KeyboardCode.Down, KeyboardCode.Left, KeyboardCode.Right];
const centreY = (rect: ClientRect) => rect.top + rect.height / 2;

/**
 * Where the arrow keys move a dragged card: up and down step through its
 * column, left and right go to the neighbouring column at about the same
 * height. dnd-kit's `sortableKeyboardCoordinates` picks the closest droppable
 * in any column instead, which skips empty columns (they are as tall as the
 * board) and wanders into other columns at the end of a list.
 *
 * The board's collision detection hit-tests the card's centre, so each result
 * centres the card on the slot it should land in.
 */
export const boardKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context }) => {
  if (!ARROWS.includes(event.code)) return undefined;
  event.preventDefault();

  const { active, collisionRect: card, droppableRects, droppableContainers } = context;
  const status = active?.data.current?.sortable?.containerId as BoardStatus | undefined;
  if (!card || !status) return undefined;

  const cardsIn = (column: BoardStatus) =>
    droppableContainers
      .getEnabled()
      .filter((container) => container.data.current?.sortable?.containerId === column)
      .map((container) => droppableRects.get(container.id))
      .filter((rect) => rect !== undefined)
      .sort((a, b) => a.top - b.top);
  const centreOn = (rect: ClientRect, top = rect.top + (rect.height - card.height) / 2) => ({
    x: rect.left + (rect.width - card.width) / 2,
    y: top,
  });
  const y = centreY(card);

  if (event.code === KeyboardCode.Up || event.code === KeyboardCode.Down) {
    const cards = cardsIn(status);
    // A pixel of slack: the card is centred on its slot, so its own slot must not count as "below".
    const target =
      event.code === KeyboardCode.Down ? cards.find((rect) => centreY(rect) > y + 1) : cards.findLast((rect) => centreY(rect) < y - 1);
    return target && centreOn(target);
  }

  const next = BOARD_COLUMNS[BOARD_COLUMNS.indexOf(status) + (event.code === KeyboardCode.Right ? 1 : -1)];
  const column = next && droppableRects.get(columnDropId(next));
  if (!next || !column) return undefined;

  const cards = cardsIn(next);
  const last = cards.at(-1);
  if (!last) {
    // Empty column: land where its first card would be, as far below the heading as cards in this column are.
    const own = droppableRects.get(columnDropId(status));
    const first = cardsIn(status)[0];
    return centreOn(column, column.top + (own && first ? first.top - own.top : 0));
  }
  // Below every card: land under the last one, which appends.
  if (y > last.top + last.height) return centreOn(column, last.top + last.height + 8);
  const nearest = cards.reduce((best, rect) => (Math.abs(centreY(rect) - y) < Math.abs(centreY(best) - y) ? rect : best));
  return centreOn(nearest);
};
