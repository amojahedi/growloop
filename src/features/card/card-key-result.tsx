"use client";

import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatQuarter } from "@/lib/domain/dates";
import { findKeyResult } from "@/lib/domain/okrs";
import type { PlanItem, QuarterKey } from "@/lib/domain/types";
import { useActions, useArchivedYears, useObjectives } from "@/lib/store/hooks";
import { alsoCountsToward, keyResultChoices, type KeyResultChoice } from "./card-mode";

/**
 * The KR row (C-8): "Counts toward {objective} · {KR}" with Change · Unlink,
 * "Link to a key result ▾", or "Set your year" when there are no objectives,
 * plus the muted, automatic "Also counts toward" for count KRs.
 */
export function CardKeyResult({ item, quarter, readOnly }: { item: PlanItem; quarter: QuarterKey; readOnly: boolean }) {
  const objectives = useObjectives();
  const archivedYears = useArchivedYears();
  const { updatePlanItem } = useActions();

  const linked = item.keyResultId ? findKeyResult(objectives, item.keyResultId) : undefined;
  const choices = readOnly ? [] : keyResultChoices(item, objectives, archivedYears, quarter);
  const also = alsoCountsToward(item, objectives, quarter);
  const link = (keyResultId: string | undefined) => updatePlanItem(item.id, { keyResultId });

  let row: React.ReactNode = null;
  if (linked) {
    row = (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-muted-foreground">Counts toward</span>
        <span className="min-w-0 font-medium">
          {linked.objective.title} · {linked.keyResult.title}
        </span>
        {!readOnly && (
          <span className="flex items-center gap-1">
            {choices.length > 0 && <KeyResultMenu choices={choices} label="Change" onPick={link} />}
            <Button variant="link" size="xs" className="px-1" aria-label="Unlink from this key result" onClick={() => link(undefined)}>
              Unlink
            </Button>
          </span>
        )}
      </p>
    );
  } else if (!readOnly && choices.length > 0) {
    row = <KeyResultMenu choices={choices} label="Link to a key result" onPick={link} />;
  } else if (!readOnly && objectives.length === 0) {
    row = (
      <Link href="/okrs/plan" className="self-start text-muted-foreground underline underline-offset-4 hover:text-foreground">
        Set your year to connect this to a goal
      </Link>
    );
  }

  if (!row && also.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 text-sm">
      {row}
      {also.length > 0 && (
        <p className="text-xs text-muted-foreground">Also counts toward {also.map((keyResult) => keyResult.title).join(" · ")}</p>
      )}
    </div>
  );
}

function KeyResultMenu({
  choices,
  label,
  onPick,
}: {
  choices: readonly KeyResultChoice[];
  label: string;
  onPick: (keyResultId: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="link" size="xs" className="self-start px-1">
          {label}
          <ChevronDownIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="start">
        <DropdownMenuLabel>Key results</DropdownMenuLabel>
        {choices.map(({ keyResult, objective }) => (
          <DropdownMenuItem key={keyResult.id} onSelect={() => onPick(keyResult.id)}>
            <span className="flex min-w-0 flex-col">
              <span className="truncate">{keyResult.title}</span>
              <span className="truncate text-xs text-muted-foreground">
                {objective.title} · {formatQuarter(objective.quarter)}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
