"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { compareMonths, formatMonth } from "@/lib/domain/dates";
import { useMonthNavigation, usePlanItems } from "@/lib/store/hooks";
import { earliestMonth } from "./board-model";

/**
 * "‹ October 2026 ›" in the Board header (board.md §Header): opens on the
 * current month and goes back only, as far as the first month with a plan
 * item. The month is shared with the Dashboard for the session (UI store).
 * Must be inside `<DataGate>`.
 */
export function BoardMonthSwitcher() {
  const { month, currentMonth, goToPreviousMonth, goToNextMonth, goToCurrentMonth } = useMonthNavigation();
  const earliest = earliestMonth(usePlanItems(), currentMonth);
  const atStart = compareMonths(month, earliest) <= 0;
  const atEnd = compareMonths(month, currentMonth) >= 0;
  const group = useRef<HTMLDivElement>(null);

  const backToCurrent = () => {
    goToCurrentMonth();
    // The link disappears on the current month; keep keyboard focus in the switcher.
    group.current?.querySelector("button")?.focus();
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1">
      {month !== currentMonth && (
        <Button variant="link" size="sm" className="px-1" onClick={backToCurrent}>
          This month
        </Button>
      )}
      <div ref={group} className="flex items-center gap-1 rounded-lg border bg-card p-0.5 shadow-xs" role="group" aria-label="Month">
        <StepButton label="Previous month" disabled={atStart} onClick={goToPreviousMonth}>
          <ChevronLeftIcon aria-hidden />
        </StepButton>
        <span className="min-w-32 text-center text-sm font-semibold tabular-nums" aria-live="polite" aria-atomic="true">
          {formatMonth(month)}
        </span>
        <StepButton label="Next month" disabled={atEnd} onClick={goToNextMonth}>
          <ChevronRightIcon aria-hidden />
        </StepButton>
      </div>
    </div>
  );
}

/** `aria-disabled` rather than `disabled`, so focus stays put when the last step disables the button. */
function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      aria-disabled={disabled}
      className="aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:hover:bg-transparent"
      onClick={() => !disabled && onClick()}
    >
      {children}
    </Button>
  );
}
