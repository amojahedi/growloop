"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "cn";
import type { BoardStatus, ID } from "@/lib/domain/types";
import { STATUS_LABELS } from "./board-labels";
import { columnDropId } from "./drag-and-drop";

interface BoardColumnProps {
  status: BoardStatus;
  /** Ids of the cards rendered as children, in order. */
  itemIds: ID[];
  /** A dragged card is over this column. */
  highlighted: boolean;
  children: React.ReactNode;
}

/** One board column. The whole column is a drop target, so empty columns accept cards too. */
export function BoardColumn({ status, itemIds, highlighted, children }: BoardColumnProps) {
  const { setNodeRef } = useDroppable({ id: columnDropId(status) });

  return (
    <section
      ref={setNodeRef}
      aria-labelledby={`column-${status}`}
      className={cn(
        "rounded-xl bg-muted p-3 ring-2 ring-transparent transition-[box-shadow,background-color]",
        highlighted && "bg-accent ring-ring/50",
      )}
    >
      <h2 id={`column-${status}`} className="mb-3 text-sm font-medium">
        {STATUS_LABELS[status]} <span className="text-muted-foreground">{itemIds.length}</span>
      </h2>
      <SortableContext id={status} items={itemIds} strategy={verticalListSortingStrategy}>
        <ul className="flex min-h-16 flex-col gap-2">{children}</ul>
      </SortableContext>
    </section>
  );
}
