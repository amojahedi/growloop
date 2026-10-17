"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { BoardCard, type BoardCardProps } from "./board-card";

/**
 * A board card that can be dragged. Pointers can grab it anywhere (the sensors'
 * activation distance keeps clicks on its buttons working), while the keyboard
 * only picks it up from the grip, so Enter on an arrow button still moves it.
 */
export function SortableBoardCard(props: Omit<BoardCardProps, "dragHandle" | "className">) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
    attributes: { roleDescription: "draggable card" },
  });

  return (
    <li
      ref={setNodeRef}
      data-item-id={props.item.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("cursor-grab", isDragging && "opacity-40")}
      {...listeners}
    >
      <BoardCard {...props} dragHandle={{ ref: setActivatorNodeRef, attributes }} />
    </li>
  );
}
