"use client";

import { ArrowRightLeftIcon, EllipsisIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatQuarter } from "@/lib/domain/dates";
import type { QuarterKey } from "@/lib/domain/types";

/**
 * The ⋯ menu on an objective card: Edit (OKR page only) · Move to quarter… ·
 * Remove or Delete. Every action moves or replaces the card, so callers move
 * focus themselves (see `focusSoon`); Radix would return it to a trigger that
 * no longer exists.
 */
export function ObjectiveMenu({
  triggerId,
  objectiveTitle,
  onEdit,
  moveTargets,
  onMove,
  removeLabel,
  onRemove,
}: {
  triggerId: string;
  objectiveTitle: string;
  onEdit?: () => void;
  /** Quarters it can move to; the item is disabled when there are none. */
  moveTargets: readonly QuarterKey[];
  onMove: (quarter: QuarterKey) => void;
  removeLabel: string;
  onRemove: () => void;
}) {
  // Actions that replace or remove the card handle focus themselves.
  const handledFocus = useRef(false);
  const run = (action: () => void) => () => {
    handledFocus.current = true;
    action();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        id={triggerId}
        aria-label={`Actions for "${objectiveTitle || "Untitled objective"}"`}
        className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-expanded:bg-muted"
      >
        <EllipsisIcon className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52"
        onCloseAutoFocus={(event) => {
          if (handledFocus.current) event.preventDefault();
          handledFocus.current = false;
        }}
      >
        {onEdit && (
          <DropdownMenuItem onSelect={run(onEdit)}>
            <PencilIcon aria-hidden />
            Edit
          </DropdownMenuItem>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={moveTargets.length === 0}>
            <ArrowRightLeftIcon aria-hidden />
            Move to quarter…
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {moveTargets.map((quarter) => (
              <DropdownMenuItem key={quarter} onSelect={run(() => onMove(quarter))}>
                {formatQuarter(quarter)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={run(onRemove)}>
          <Trash2Icon aria-hidden />
          {removeLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
