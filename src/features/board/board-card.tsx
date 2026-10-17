"use client";

import { cn } from "cn";
import { MaterialTypeIcon } from "@/components/icons";
import { Badge } from "@/components/ui/badge";
import { taskProgress } from "@/lib/domain/plan-items";
import type { Material, PlanItem, Skill } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";

export interface BoardCardProps extends React.ComponentProps<"div"> {
  item: PlanItem;
  material: Material | undefined;
  skills: ReadonlyMap<string, Skill>;
}

/**
 * What a plan item shows on the board (B-4). Extra div props let the sortable
 * wrapper make it the drag handle; the last row leaves room for the remove
 * button, which sits beside the card rather than inside it.
 */
export function BoardCard({ item, material, skills, className, ...props }: BoardCardProps) {
  const tasks = taskProgress(item);
  const title = material?.title ?? "Unknown material";

  return (
    <div {...props} className={cn("rounded-lg border bg-card p-3 text-sm shadow-xs", className)}>
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
      <p className="mt-2 flex min-h-6 items-center pr-7 text-xs text-muted-foreground">
        {tasks.total > 0 && `${tasks.done}/${tasks.total} tasks`}
        {item.reminder && !item.reminder.dismissed && ` · Reminder ${formatShortDate(item.reminder.date)}`}
      </p>
    </div>
  );
}
