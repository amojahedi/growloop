"use client";

import { cn } from "cn";
import { MaterialTypeIcon } from "@/components/icons";
import { SkillImpact } from "@/components/skills/skill-impact";
import { Badge } from "@/components/ui/badge";
import { taskProgress } from "@/lib/domain/plan-items";
import type { Material, PlanItem } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";

export interface BoardCardProps extends React.ComponentProps<"div"> {
  item: PlanItem;
  material: Material | undefined;
}

/**
 * What a plan item shows on the board (B-4). Extra div props let the sortable
 * wrapper make it the drag handle; the last row leaves room for the remove
 * button, which sits beside the card rather than inside it. Skill impact bars
 * show which skills the item builds and how strongly (S-4).
 */
export function BoardCard({ item, material, className, ...props }: BoardCardProps) {
  const tasks = taskProgress(item);
  const title = material?.title ?? "Unknown material";

  return (
    <div {...props} className={cn("rounded-lg border bg-card p-3 text-sm shadow-xs", className)}>
      <p className="flex items-start gap-2 font-medium">
        {material && <MaterialTypeIcon type={material.type} className="mt-0.5 size-4 shrink-0" />}
        {title}
      </p>
      <SkillImpact material={item} className="mt-2" />
      {item.carriedFrom?.length ? (
        <Badge variant="outline" className="mt-2">
          Carried over
        </Badge>
      ) : null}
      <p className="mt-2 flex min-h-6 items-center pr-7 text-xs text-muted-foreground">
        {tasks.total > 0 && `${tasks.done}/${tasks.total} tasks`}
        {item.reminder && !item.reminder.dismissed && ` · Reminder ${formatShortDate(item.reminder.date)}`}
      </p>
    </div>
  );
}
