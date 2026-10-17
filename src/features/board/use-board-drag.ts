"use client";

import {
  closestCorners,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Active,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Over,
  type PointerSensorOptions,
  type ScreenReaderInstructions,
} from "@dnd-kit/core";
import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { BoardColumns, MoveTarget } from "@/lib/domain/board";
import type { BoardStatus, ID, MonthKey, PlanItem } from "@/lib/domain/types";
import { STATUS_LABELS } from "./board-labels";
import { columnOf, dropTarget, isColumnDropId, moveCard, toColumnIds, type ColumnIds } from "./drag-and-drop";
import { boardKeyboardCoordinates } from "./keyboard-coordinates";

/** Mouse and pen only: touch goes to the TouchSensor, which waits for a press so the page still scrolls. */
class MouseAndPenSensor extends PointerSensor {
  static activators = PointerSensor.activators.map(({ eventName, handler }) => ({
    eventName,
    handler: (event: ReactPointerEvent, options: PointerSensorOptions) =>
      event.nativeEvent.pointerType !== "touch" && handler(event, options),
  }));
}

const SCREEN_READER_INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    "To pick up a card, press space or enter on its drag handle. Use the arrow keys to move it within and " +
    "between columns, press space or enter again to drop it, or press escape to cancel.",
};

const id = (entry: Active | Over) => String(entry.id);

// Compare centres so a card dropped onto the lower half of another lands after it.
function isBelow(active: Active, over: Over) {
  const rect = active.rect.current.translated;
  return rect ? rect.top + rect.height / 2 > over.rect.top + over.rect.height / 2 : false;
}

function positionText(columns: ColumnIds, activeId: ID) {
  const status = columnOf(columns, activeId);
  return status ? `${STATUS_LABELS[status]}, position ${columns[status].indexOf(activeId) + 1}` : "";
}

interface DragState {
  activeId: ID;
  /** The visible columns as rearranged by the drag so far. */
  columns: ColumnIds;
  overStatus?: BoardStatus;
}

interface BoardDragOptions {
  /** The columns as shown, i.e. after filters. */
  columns: BoardColumns;
  items: readonly PlanItem[];
  month: MonthKey;
  titleOf: (itemId: ID) => string;
  onMove: (itemId: ID, target: MoveTarget) => void;
}

/**
 * Drag-and-drop state for the board (B-2). While a card is dragged across
 * columns it is moved in a local copy of the columns, so its slot opens up
 * live; the store only changes once, on drop.
 */
export function useBoardDrag({ columns, items, month, titleOf, onMove }: BoardDragOptions) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const lastAnnounced = useRef("");
  const sensors = useSensors(
    useSensor(MouseAndPenSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: boardKeyboardCoordinates }),
  );

  const visible = toColumnIds(columns);
  const current = drag?.columns ?? visible;

  const collisionDetection: CollisionDetection = (args) => {
    // Hit-test the pointer, or for the keyboard the centre of the moved card. Distance-based
    // algorithms misfire here because columns stretch to the height of the tallest one.
    const { collisionRect: rect } = args;
    const point = args.pointerCoordinates ?? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const collisions = pointerWithin({ ...args, pointerCoordinates: point });
    const card = collisions.find((collision) => !isColumnDropId(String(collision.id)));
    if (card) return [card];
    // Over a column's empty space: use its nearest card, so the drop has a precise slot.
    const status = collisions[0] && columnOf(current, String(collisions[0].id));
    if (!status || current[status].length === 0) return collisions;
    const cards = new Set(current[status]);
    return closestCorners({ ...args, droppableContainers: args.droppableContainers.filter((c) => cards.has(String(c.id))) });
  };

  const describePosition = (active: Active, over: Over) =>
    positionText(moveCard(current, id(active), id(over), isBelow(active, over)), id(active));

  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      lastAnnounced.current = positionText(current, id(active));
      return `Picked up ${titleOf(id(active))}.`;
    },
    onDragOver: ({ active, over }) => {
      if (!over) {
        lastAnnounced.current = "";
        return `${titleOf(id(active))} is no longer over a column.`;
      }
      const position = describePosition(active, over);
      // Hovering another part of the same slot (including the starting one) isn't news.
      if (position === lastAnnounced.current) return undefined;
      lastAnnounced.current = position;
      return `Moved to ${position}.`;
    },
    onDragEnd: ({ active, over }) =>
      over
        ? `Dropped ${titleOf(id(active))} in ${describePosition(active, over)}.`
        : `Dropped ${titleOf(id(active))} outside the board. It is back where it started.`,
    onDragCancel: ({ active }) => `Cancelled. ${titleOf(id(active))} is back where it started.`,
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    const activeId = id(active);
    setDrag({ activeId, columns: visible, overStatus: columnOf(visible, activeId) });
  };

  const onDragOver = ({ active, over }: DragOverEvent) => {
    const after = over ? isBelow(active, over) : false;
    setDrag((state) => {
      if (!state) return state;
      if (!over) return { ...state, overStatus: undefined };
      const overStatus = columnOf(state.columns, id(over));
      // Only cross-column moves happen live; within a column the sortable transforms preview the slot.
      const crossing = overStatus !== columnOf(state.columns, state.activeId);
      return { ...state, overStatus, columns: crossing ? moveCard(state.columns, state.activeId, id(over), after) : state.columns };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (drag && over) {
      const arranged = moveCard(drag.columns, id(active), id(over), isBelow(active, over));
      const target = dropTarget(arranged, id(active), items, month);
      if (target) onMove(id(active), target);
    }
    setDrag(null);
  };

  return {
    /** Columns to render: the live arrangement while dragging, else the visible columns. */
    columns: current,
    activeId: drag?.activeId,
    overStatus: drag?.overStatus,
    contextProps: {
      sensors,
      collisionDetection,
      accessibility: { announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS },
      onDragStart,
      onDragOver,
      onDragEnd,
      onDragCancel: () => setDrag(null),
    },
  };
}
