"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import { rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { useEffect, useId, useRef } from "react";
import { EmptyHint } from "@/components/app/section";
import { useDashboardLayout, useLayoutEditor } from "./layout-editor";
import { getWidget } from "./widget-registry";
import { WidgetFrame } from "./widget-frame";

const SCREEN_READER_INSTRUCTIONS = {
  draggable: "To move a widget, press space or enter, use the arrow keys to move it, then press space or enter again to drop it. Press escape to cancel.",
};

/** The widget grid (D-8): 3 columns on desktop, sortable by drag or keyboard in edit mode. */
export function DashboardGrid() {
  const { layout, editing } = useDashboardLayout();
  const dispatch = useLayoutEditor((state) => state.dispatch);
  const dndId = useId();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // The remove button disappears with its widget; move focus to the next widget's handle instead of losing it.
  const listRef = useRef<HTMLUListElement>(null);
  const focusAfterRemove = useRef<number | null>(null);
  useEffect(() => {
    const index = focusAfterRemove.current;
    if (index === null) return;
    focusAfterRemove.current = null;
    const handles = listRef.current?.querySelectorAll<HTMLElement>("[data-widget-handle]") ?? [];
    handles[Math.min(index, handles.length - 1)]?.focus();
  }, [layout]);

  const titleOf = (id: string | number) => getWidget(String(id))?.title ?? "widget";
  const positionOf = (id: string | number) =>
    `position ${layout.findIndex((placement) => placement.widgetId === id) + 1} of ${layout.length}`;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${titleOf(active.id)}, ${positionOf(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${titleOf(active.id)} is over ${positionOf(over.id)}.` : undefined),
    onDragEnd: ({ active, over }) =>
      over ? `${titleOf(active.id)} dropped at ${positionOf(over.id)}.` : `${titleOf(active.id)} dropped.`,
    onDragCancel: ({ active }) => `Moving ${titleOf(active.id)} was cancelled.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) dispatch({ type: "move", widgetId: String(active.id), overId: String(over.id) });
  };

  const widgets = layout.flatMap((placement) => {
    const widget = getWidget(placement.widgetId);
    return widget ? [{ placement, widget }] : [];
  });
  if (widgets.length === 0) return <EmptyHint>Your dashboard is empty. Use Customize to add widgets.</EmptyHint>;

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      accessibility={{ announcements, screenReaderInstructions: SCREEN_READER_INSTRUCTIONS }}
    >
      <SortableContext items={layout.map((placement) => placement.widgetId)} strategy={rectSortingStrategy} disabled={!editing}>
        <ul ref={listRef} aria-label="Dashboard widgets" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {widgets.map(({ placement, widget }, index) => (
            <WidgetFrame
              key={placement.widgetId}
              placement={placement}
              widget={widget}
              editing={editing}
              onResize={(size) => dispatch({ type: "resize", widgetId: placement.widgetId, size })}
              onRemove={() => {
                focusAfterRemove.current = index;
                dispatch({ type: "remove", widgetId: placement.widgetId });
              }}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
