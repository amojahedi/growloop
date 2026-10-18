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
  /** Shown in place of cards when the column is empty. */
  empty?: React.ReactNode;
  children: React.ReactNode;
}

const STATUS_DOTS: Record<BoardStatus, string> = {
  backlog: "bg-muted-foreground/50",
  todo: "bg-chart-5",
  in_progress: "bg-chart-3",
  done: "bg-chart-2",
};

/**
 * One board column. The whole column is a drop target, so empty columns accept
 * cards too. It takes focus (programmatically only) when the card that had
 * focus leaves it and no neighbour is left.
 */
export function BoardColumn({ status, itemIds, highlighted, empty, children }: BoardColumnProps) {
  const { setNodeRef } = useDroppable({ id: columnDropId(status) });

  return (
    <section
      ref={setNodeRef}
      tabIndex={-1}
      data-column={status}
      aria-labelledby={`column-${status}`}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-xl bg-muted p-2.5 ring-2 ring-transparent transition-[box-shadow,background-color] outline-none md:min-h-80",
        highlighted && "bg-accent ring-ring/50",
      )}
    >
      <h2 id={`column-${status}`} className="flex items-center gap-2 px-1.5 pt-1 text-sm font-semibold">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STATUS_DOTS[status])} />
        {STATUS_LABELS[status]}
        <span className="text-xs font-semibold text-muted-foreground tabular-nums">{itemIds.length}</span>
      </h2>
      <SortableContext id={status} items={itemIds} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-2.5">{children}</ul>
      </SortableContext>
      {itemIds.length === 0 && empty && <div className="px-1.5 pb-2 text-sm text-muted-foreground">{empty}</div>}
    </section>
  );
}
