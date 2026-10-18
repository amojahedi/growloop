"use client";

import { ChevronDownIcon } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { quarterOf } from "@/lib/domain/dates";
import { activeObjectives, findKeyResult, objectivesForQuarter } from "@/lib/domain/okrs";
import type { ID, PlanItem } from "@/lib/domain/types";
import { useActions, useMonthNavigation, useObjectives } from "@/lib/store/hooks";

/**
 * Offers an optional key-result link for a freshly added card (RS-4: never
 * forced). Key results whose objective shares a skill with the item come first.
 * Renders nothing when the current quarter has no key results.
 */
export function KeyResultLink({ item, materialTitle }: { item: PlanItem; materialTitle: string }) {
  const { currentMonth } = useMonthNavigation();
  const objectives = useObjectives();
  const { updatePlanItem } = useActions();

  const options = useMemo(() => {
    const matches = (skillId: ID) => item.skillIds.includes(skillId);
    return activeObjectives(objectivesForQuarter(objectives, quarterOf(currentMonth)))
      .flatMap((objective) =>
        objective.keyResults.map((keyResult) => ({ keyResult, objective, relevant: matches(keyResult.skillId) })),
      )
      .sort((a, b) => Number(b.relevant) - Number(a.relevant));
  }, [objectives, currentMonth, item.skillIds]);

  // Auto-linked cards may count toward a KR in a later quarter.
  const linked = item.keyResultId ? findKeyResult(objectives, item.keyResultId) : undefined;
  if (linked) {
    return (
      <span className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
        <span className="truncate">Counts toward “{linked.keyResult.title}”</span>
        <Button
          variant="link"
          size="xs"
          aria-label={`Unlink "${materialTitle}" from its key result`}
          onClick={() => updatePlanItem(item.id, { keyResultId: undefined })}
        >
          Unlink
        </Button>
      </span>
    );
  }
  if (options.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="link" size="xs" aria-label={`Link "${materialTitle}" to a key result`}>
          Link to a key result
          <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        <DropdownMenuLabel>Key results this quarter</DropdownMenuLabel>
        {options.map(({ keyResult, objective }) => (
          <DropdownMenuItem key={keyResult.id} onSelect={() => updatePlanItem(item.id, { keyResultId: keyResult.id })}>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{keyResult.title}</span>
              <span className="truncate text-xs text-muted-foreground">{objective.title}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
