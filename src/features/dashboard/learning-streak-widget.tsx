"use client";

import { Section } from "@/components/app/section";
import { currentStreak, monthActivity, type ActivityDay } from "@/lib/domain/dashboard";
import { formatMonth } from "@/lib/domain/dates";
import { formatShortDate } from "@/lib/format";
import { useActivity, useMonthNavigation, useToday } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;

/** Streaks and a calendar of active days in the viewed month (D-4). */
export function LearningStreakWidget() {
  const activity = useActivity();
  const today = useToday();
  const { month, isCurrentMonth } = useMonthNavigation();
  const stats = monthActivity(activity, month);

  return (
    <Section title="Learning streak" description={formatMonth(month)} className="h-full">
      <dl className="flex flex-wrap gap-x-6 gap-y-2">
        {isCurrentMonth && <Stat label="Current streak" value={days(currentStreak(activity, today))} />}
        <Stat label="Active days" value={String(stats.activeDays)} />
        <Stat label="Longest streak" value={days(stats.longestStreak)} />
      </dl>
      <MonthCalendar days={stats.days} label={`Active on ${days(stats.activeDays)} in ${formatMonth(month)}`} />
    </Section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-display text-xl font-semibold">{value}</dd>
    </div>
  );
}

/** Monday-first grid of the month; the label carries the summary for screen readers. */
function MonthCalendar({ days: monthDays, label }: { days: ActivityDay[]; label: string }) {
  const [year, month, date] = monthDays[0].date.split("-").map(Number);
  const offset = (new Date(year, month - 1, date).getDay() + 6) % 7;

  return (
    <div role="img" aria-label={label} className="mt-4 grid max-w-64 grid-cols-7 gap-1">
      {Array.from({ length: offset }, (_, index) => (
        <span key={`pad-${index}`} />
      ))}
      {monthDays.map((day) => (
        <span
          key={day.date}
          title={`${formatShortDate(day.date)}: ${day.count} ${day.count === 1 ? "activity" : "activities"}`}
          className={cn(
            "aspect-square rounded-sm",
            day.count === 0 ? "bg-muted" : day.count < 3 ? "bg-primary/45" : "bg-primary",
          )}
        />
      ))}
    </div>
  );
}
