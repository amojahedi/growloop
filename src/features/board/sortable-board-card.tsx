"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSkillPreviewTrigger } from "@/lib/store/hooks";
import { BoardCard, type BoardCardProps } from "./board-card";

interface SortableBoardCardProps extends Omit<BoardCardProps, keyof React.ComponentProps<"div">> {
  onDelete: () => void;
}

/**
 * A draggable board card (B-2). The card itself is the focusable drag handle
 * for the keyboard; the remove button is its sibling, not its child, so the
 * handle holds no nested controls and Enter on the button doesn't pick it up.
 * Pointers can grab anywhere: the sensors' activation distance keeps clicks working.
 * Hovering or focusing the card previews its skill impact on any radar on screen
 * (S-4); previews are cleared and paused while any card is being dragged.
 */
export function SortableBoardCard({ onDelete, ...props }: SortableBoardCardProps) {
  const { active, attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
    id: props.item.id,
    attributes: { roleDescription: "draggable card" },
  });
  const title = props.material?.title ?? "Unknown material";
  const previewTrigger = useSkillPreviewTrigger(
    { id: props.item.id, label: title, source: props.item },
    { paused: active !== null },
  );

  return (
    <li
      ref={setNodeRef}
      data-item-id={props.item.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("relative cursor-grab", isDragging && "opacity-40")}
      {...listeners}
      {...previewTrigger}
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
