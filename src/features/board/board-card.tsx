"use client";

import { cn } from "cn";
import { AwardIcon, BellIcon, SquareCheckIcon, RepeatIcon, TargetIcon } from "lucide-react";
import { MaterialTypeIcon } from "@/components/icons";
import { SkillImpact } from "@/components/skills/skill-impact";
import { Badge } from "@/components/ui/badge";
import { taskProgress } from "@/lib/domain/plan-items";
import type { Material, PlanItem } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";

export interface BoardCardProps extends React.ComponentProps<"div"> {
  item: PlanItem;
  material: Material | undefined;
  /** Leaves room in the footer for a button laid over it (e.g. "Mark as earned"). */
  footerInset?: boolean;
}

/**
 * What a plan item shows on the board (B-4): type icon, title, skill impact
 * (S-4), task count, reminder, and the "Carried over", "KR" and "Earned" tags.
 * Extra div props let the sortable wrapper make it the drag handle. The top
 * right corner is left free for the ⋯ menu, which sits beside the card rather
 * than inside it, so the handle holds no nested controls.
 */
export function BoardCard({ item, material, footerInset = false, className, ...props }: BoardCardProps) {
  const tasks = taskProgress(item);
  const title = material?.title ?? "Unknown material";
  const reminder = item.reminder && !item.reminder.dismissed ? item.reminder : undefined;
  const carried = (item.carriedFrom?.length ?? 0) > 0;
  const earned = material?.type === "certification" && item.earnedAt !== undefined;
  const hasTags = carried || item.keyResultId !== undefined || earned;
  const hasFooter = footerInset || tasks.total > 0 || reminder !== undefined;

  return (
    <div
      data-card-handle=""
      {...props}
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3.5 text-sm shadow-xs transition-[border-color,box-shadow]",
        className,
      )}
    >
      <p className="flex items-start gap-2 pr-6 leading-snug font-semibold">
        {material && <MaterialTypeIcon type={material.type} className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
        {title}
      </p>
      <SkillImpact material={item} />
      {hasTags && (
        <p className="flex flex-wrap items-center gap-1">
          {carried && (
            <Badge variant="secondary">
              <RepeatIcon aria-hidden />
              Carried over
            </Badge>
          )}
          {item.keyResultId && (
            <Badge variant="outline" className="border-dashed border-input text-muted-foreground">
              <TargetIcon aria-hidden />
              <span aria-hidden>KR</span>
              <span className="sr-only">Counts toward a key result</span>
            </Badge>
          )}
          {earned && (
            <Badge variant="secondary">
              <AwardIcon aria-hidden />
              Earned
            </Badge>
          )}
        </p>
      )}
      {hasFooter && (
        <p
          className={cn(
            "flex min-h-7 flex-wrap items-center gap-x-3 gap-y-1 border-t pt-2 text-xs text-muted-foreground tabular-nums",
            footerInset && "pr-28",
          )}
        >
          {tasks.total > 0 && (
            <span className="inline-flex items-center gap-1">
              <SquareCheckIcon aria-hidden className="size-3.5" />
              {tasks.done}/{tasks.total} tasks
            </span>
          )}
          {reminder && (
            <span className="inline-flex items-center gap-1">
              <BellIcon aria-hidden className="size-3.5" />
              Reminder {formatShortDate(reminder.date)}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
