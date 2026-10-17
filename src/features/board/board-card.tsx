"use client";

import type { DraggableAttributes } from "@dnd-kit/core";
import { cn } from "cn";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpIcon,
  GripVerticalIcon,
  Trash2Icon,
  type LucideIcon,
} from "lucide-react";
import { MaterialTypeIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { taskProgress } from "@/lib/domain/plan-items";
import { BOARD_COLUMNS, type Material, type PlanItem, type Skill } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import { STATUS_LABELS } from "./board-labels";

export type MoveAction = "left" | "up" | "down" | "right";

const MOVE_ICONS: Record<MoveAction, LucideIcon> = {
  left: ArrowLeftIcon,
  up: ArrowUpIcon,
  down: ArrowDownIcon,
  right: ArrowRightIcon,
};

export interface BoardCardProps {
  item: PlanItem;
  material: Material | undefined;
  skills: ReadonlyMap<string, Skill>;
  /** Which moves are possible from the card's current position. */
  canMove: Record<MoveAction, boolean>;
  onMove: (action: MoveAction) => void;
  onDelete: () => void;
  /** Wires the grip up as the drag handle (keyboard activation, screen-reader hints). */
  dragHandle?: { ref: (element: HTMLElement | null) => void; attributes: DraggableAttributes };
  className?: string;
}

/**
 * A plan item on the board (B-4). The grip is the keyboard drag handle; the
 * arrow buttons are a simpler alternative to dragging, and `data-move` lets the
 * board restore focus to the same control after the card moves.
 */
export function BoardCard({ item, material, skills, canMove, onMove, onDelete, dragHandle, className }: BoardCardProps) {
  const tasks = taskProgress(item);
  const title = material?.title ?? "Unknown material";
  const column = BOARD_COLUMNS.indexOf(item.status);

  const label = (action: MoveAction) => {
    if (action === "up") return `Move "${title}" up`;
    if (action === "down") return `Move "${title}" down`;
    const neighbour = BOARD_COLUMNS[column + (action === "left" ? -1 : 1)];
    return neighbour ? `Move "${title}" to ${STATUS_LABELS[neighbour]}` : `Move "${title}" ${action}`;
  };

  return (
    <div className={cn("rounded-lg border bg-card p-3 text-sm shadow-xs", className)}>
      <p className="flex items-start gap-2 font-medium">
        {material && <MaterialTypeIcon type={material.type} className="mt-0.5 size-4 shrink-0" />}
        {title}
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {item.skillIds.map((id) => (
          <Badge key={id} variant="secondary">
            {skills.get(id)?.name ?? id}
          </Badge>
        ))}
        {item.carriedFrom?.length ? <Badge variant="outline">Carried over</Badge> : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {tasks.total > 0 && `${tasks.done}/${tasks.total} tasks`}
        {item.reminder && !item.reminder.dismissed && ` · Reminder ${formatShortDate(item.reminder.date)}`}
      </p>
      <div className="mt-2 flex gap-1">
        <Button
          ref={dragHandle?.ref}
          variant="ghost"
          size="icon-xs"
          className="cursor-grab"
          aria-label={`Drag "${title}"`}
          {...dragHandle?.attributes}
        >
          <GripVerticalIcon />
        </Button>
        {(["left", "up", "down", "right"] as const).map((action) => {
          const Icon = MOVE_ICONS[action];
          return (
            <Button
              key={action}
              variant="ghost"
              size="icon-xs"
              data-move={action}
              disabled={!canMove[action]}
              onClick={() => onMove(action)}
              aria-label={label(action)}
            >
              <Icon />
            </Button>
          );
        })}
        <Button variant="ghost" size="icon-xs" className="ml-auto" onClick={onDelete} aria-label={`Remove "${title}"`}>
          <Trash2Icon />
        </Button>
      </div>
    </div>
  );
}
