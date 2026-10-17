"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { completionStats, currentStreak, hoursLoggedInMonth, monthActivity } from "@/lib/domain/dashboard";
import { formatDelta, formatHours } from "@/lib/format";
import { useActivity, useMonthNavigation, usePlanItems, useToday } from "@/lib/store/hooks";

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="font-display text-3xl">{value}</CardTitle>
      </CardHeader>
      {detail && <CardContent className="text-xs text-muted-foreground">{detail}</CardContent>}
    </Card>
  );
}

/** Headline numbers: items completed (core metric), hours (only when logged), activity. */
export function StatCards() {
  const items = usePlanItems();
  const activity = useActivity();
  const today = useToday();
  const { month, isCurrentMonth } = useMonthNavigation();

  const completed = completionStats(items, month);
  const hours = hoursLoggedInMonth(activity, month);
  const monthStats = monthActivity(activity, month);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat
        label="Items completed"
        value={String(completed.count)}
        detail={`${formatDelta(completed.delta)} vs last month`}
      />
      {hours !== null && <Stat label="Hours learned" value={formatHours(hours)} />}
      <Stat
        label="Active days"
        value={String(monthStats.activeDays)}
        detail={`Longest streak: ${monthStats.longestStreak} days`}
      />
      {isCurrentMonth && <Stat label="Current streak" value={`${currentStreak(activity, today)} days`} />}
    </div>
  );
}
