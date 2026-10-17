"use client";

import { Section } from "@/components/app/section";
import { completionStats } from "@/lib/domain/dashboard";
import { formatMonth } from "@/lib/domain/dates";
import { formatDelta } from "@/lib/format";
import { useMonthNavigation, usePlanItems } from "@/lib/store/hooks";

/** The core metric (D-1, ADR 006): items completed this month, with the change since last month. */
export function ItemsCompletedWidget() {
  const items = usePlanItems();
  const { month } = useMonthNavigation();
  const { count, previousCount, delta } = completionStats(items, month);

  return (
    <Section title="Items completed" description={formatMonth(month)} className="h-full">
      <p className="font-display text-4xl font-semibold tracking-tight">{count}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {formatDelta(delta)} vs last month ({previousCount})
      </p>
    </Section>
  );
}
