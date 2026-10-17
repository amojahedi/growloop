"use client";

import { ArrowDownIcon, ArrowLeftIcon, ArrowRightIcon, ArrowUpIcon, Trash2Icon } from "lucide-react";
import { MaterialTypeIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { taskProgress } from "@/lib/domain/plan-items";
import { BOARD_COLUMNS, type Material, type PlanItem, type Skill } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import { useActions } from "@/lib/store/hooks";
import { STATUS_LABELS } from "./board-labels";

interface BoardCardProps {
  item: PlanItem;
  /** Reorder within the column; undefined when the card is already first / last. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  material: Material | undefined;
  skills: ReadonlyMap<string, Skill>;
}

/** A plan item on the board (B-4), with button controls as the keyboard alternative to drag and drop. */
export function BoardCard({ item, onMoveUp, onMoveDown, material, skills }: BoardCardProps) {
  const { movePlanItem, deletePlanItem } = useActions();
  const tasks = taskProgress(item);
  const columnIndex = BOARD_COLUMNS.indexOf(item.status);
  const previousStatus = BOARD_COLUMNS[columnIndex - 1];
  const nextStatus = BOARD_COLUMNS[columnIndex + 1];
  const title = material?.title ?? "Unknown material";

  return (
    <li className="rounded-lg border bg-card p-3 text-sm shadow-xs">
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
          variant="ghost"
          size="icon-xs"
          disabled={!previousStatus}
          onClick={() => movePlanItem(item.id, { status: previousStatus })}
          aria-label={previousStatus ? `Move "${title}" to ${STATUS_LABELS[previousStatus]}` : undefined}
        >
          <ArrowLeftIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!onMoveUp}
          onClick={onMoveUp}
          aria-label={`Move "${title}" up`}
        >
          <ArrowUpIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!onMoveDown}
          onClick={onMoveDown}
          aria-label={`Move "${title}" down`}
        >
          <ArrowDownIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          disabled={!nextStatus}
          onClick={() => movePlanItem(item.id, { status: nextStatus })}
          aria-label={nextStatus ? `Move "${title}" to ${STATUS_LABELS[nextStatus]}` : undefined}
        >
          <ArrowRightIcon />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-auto"
          onClick={() => window.confirm(`Remove "${title}" from your plan?`) && deletePlanItem(item.id)}
          aria-label={`Remove "${title}"`}
        >
          <Trash2Icon />
        </Button>
      </div>
    </li>
  );
}
