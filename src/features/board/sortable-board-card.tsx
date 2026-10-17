"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BoardCard, type BoardCardProps } from "./board-card";

interface SortableBoardCardProps extends Omit<BoardCardProps, keyof React.ComponentProps<"div">> {
  onDelete: () => void;
}

/**
 * A draggable board card (B-2). The card itself is the focusable drag handle
 * for the keyboard; the remove button is its sibling, not its child, so the
 * handle holds no nested controls and Enter on the button doesn't pick it up.
 * Pointers can grab anywhere: the sensors' activation distance keeps clicks working.
 */
export function SortableBoardCard({ onDelete, ...props }: SortableBoardCardProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
    attributes: { roleDescription: "draggable card" },
  });
  const title = props.material?.title ?? "Unknown material";

  return (
    <li
      ref={setNodeRef}
      data-item-id={props.item.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative cursor-grab", isDragging && "opacity-40")}
      {...listeners}
    >
      <BoardCard
        {...props}
        {...attributes}
        ref={setActivatorNodeRef}
        className="outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button
        variant="ghost"
        size="icon-xs"
        className="absolute right-3 bottom-3"
        onClick={onDelete}
        aria-label={`Remove "${title}"`}
      >
        <Trash2Icon />
      </Button>
    </li>
  );
}
