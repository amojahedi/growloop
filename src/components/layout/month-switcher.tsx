"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { DataGate } from "@/components/app/data-gate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMonth } from "@/lib/domain/dates";
import { useMonthNavigation } from "@/lib/store/hooks";

/** Previous / next month controls for the month every page is viewing. */
export function MonthSwitcher() {
  return (
    <DataGate fallback={<Skeleton className="h-8 w-52" />}>
      <MonthSwitcherControls />
    </DataGate>
  );
}

function MonthSwitcherControls() {
  const { month, isCurrentMonth, goToPreviousMonth, goToNextMonth, goToCurrentMonth } = useMonthNavigation();

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Month">
      <Button variant="ghost" size="icon-sm" onClick={goToPreviousMonth} aria-label="Previous month">
        <ChevronLeftIcon />
      </Button>
      <span className="min-w-32 text-center text-sm font-medium" aria-live="polite">
        {formatMonth(month)}
      </span>
      <Button variant="ghost" size="icon-sm" onClick={goToNextMonth} aria-label="Next month">
        <ChevronRightIcon />
      </Button>
      {!isCurrentMonth && (
        <Button variant="outline" size="sm" onClick={goToCurrentMonth}>
          Today
        </Button>
      )}
    </div>
  );
}
