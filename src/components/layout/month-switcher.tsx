"use client";

import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useMemo, useRef } from "react";
import { DataGate } from "@/components/app/data-gate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { compareMonths, formatMonth } from "@/lib/domain/dates";
import type { MonthKey } from "@/lib/domain/types";
import { useMonthNavigation, usePlanItems } from "@/lib/store/hooks";

/**
 * The month the Dashboard and Board look at (board.md §Month switcher). It
 * lives in those two page headers only and goes back only: next stops at the
 * current month, previous at the earliest month with a card. The month is
 * shared between both pages for the session.
 */
export function MonthSwitcher() {
  return (
    <DataGate fallback={<Skeleton className="h-9 w-56 rounded-full" />}>
      <MonthSwitcherControls />
    </DataGate>
  );
}

/** Which ways the switcher can move from `month`. Pure, for tests. */
export function monthSwitcherLimits(
  month: MonthKey,
  currentMonth: MonthKey,
  plannedMonths: readonly MonthKey[],
): { canGoBack: boolean; canGoForward: boolean } {
  const earliest = plannedMonths.reduce<MonthKey | null>(
    (first, candidate) => (first === null || compareMonths(candidate, first) < 0 ? candidate : first),
    null,
  );
  return {
    canGoBack: earliest !== null && compareMonths(month, earliest) > 0,
    canGoForward: compareMonths(month, currentMonth) < 0,
  };
}

function MonthSwitcherControls() {
  const { month, currentMonth, isCurrentMonth, goToPreviousMonth, goToNextMonth, goToCurrentMonth } = useMonthNavigation();
  const items = usePlanItems();
  const months = useMemo(() => items.map((item) => item.month), [items]);
  const { canGoBack, canGoForward } = monthSwitcherLimits(month, currentMonth, months);
  const group = useRef<HTMLDivElement>(null);

  const backToCurrent = () => {
    goToCurrentMonth();
    // The link disappears on the current month; keep keyboard focus in the switcher.
    group.current?.querySelector("button")?.focus();
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!isCurrentMonth && (
        <Button variant="link" size="sm" className="px-1" onClick={backToCurrent}>
          This month
        </Button>
      )}
      <div
        ref={group}
        role="group"
        aria-label="Month"
        className="flex items-center gap-0.5 rounded-full border border-border bg-card p-0.5 shadow-xs"
      >
        <StepButton label="Previous month" disabled={!canGoBack} onClick={goToPreviousMonth}>
          <ChevronLeftIcon />
        </StepButton>
        <span
          className="flex min-w-36 items-center justify-center gap-2 px-2 text-sm font-semibold tabular-nums"
          aria-live="polite"
          aria-atomic="true"
        >
          <CalendarIcon className="hidden size-4 text-muted-foreground sm:block" aria-hidden />
          {formatMonth(month)}
        </span>
        <StepButton label="Next month" disabled={!canGoForward} onClick={goToNextMonth}>
          <ChevronRightIcon />
        </StepButton>
      </div>
    </div>
  );
}

/** `aria-disabled` rather than `disabled`, so focus stays put when a step reaches the end. */
function StepButton({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      className="rounded-full aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent"
      aria-label={label}
      aria-disabled={disabled}
      onClick={() => !disabled && onClick()}
    >
      {children}
    </Button>
  );
}
