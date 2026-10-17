"use client";

import { EmptyHint, Section } from "@/components/app/section";
import { Button } from "@/components/ui/button";
import { upcomingReminders } from "@/lib/domain/dashboard";
import { formatShortDate } from "@/lib/format";
import { useActions, useMaterialMap, usePlanItems, useToday } from "@/lib/store/hooks";

/** Upcoming and overdue reminders (D-6). */
export function RemindersPanel() {
  const items = usePlanItems();
  const materials = useMaterialMap();
  const today = useToday();
  const { dismissReminder } = useActions();
  const reminders = upcomingReminders(items, today, { limit: 5 });

  return (
    <Section title="Upcoming reminders" className="h-full">
      {reminders.length === 0 ? (
        <EmptyHint>No reminders. Add one from a card on the board.</EmptyHint>
      ) : (
        <ul className="flex flex-col gap-2">
          {reminders.map(({ itemId, materialId, reminder, overdue }) => (
            <li key={itemId} className="flex items-start justify-between gap-2 text-sm">
              <div>
                <p className="font-medium">
                  {formatShortDate(reminder.date)}
                  {overdue && <span className="ml-2 text-destructive">Overdue</span>}
                </p>
                <p className="text-muted-foreground">
                  {reminder.note || materials.get(materialId)?.title}
                </p>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={() => dismissReminder(itemId)}
                aria-label={`Dismiss reminder for "${materials.get(materialId)?.title ?? "item"}"`}
              >
                Dismiss
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
