"use client";

import { Section } from "@/components/app/section";
import { formatQuarter } from "@/lib/domain/dates";
import { objectivesForQuarter } from "@/lib/domain/okrs";
import { useMonthNavigation, useObjectives, usePlanItems } from "@/lib/store/hooks";
import { ObjectiveProgressList } from "../okrs/objective-progress-list";

/** Objectives of the viewed month's quarter (D-3). */
export function OkrProgressWidget() {
  const items = usePlanItems();
  const objectives = useObjectives();
  const { quarter } = useMonthNavigation();

  return (
    <Section title="OKR progress" description={formatQuarter(quarter)} className="h-full">
      <ObjectiveProgressList objectives={objectivesForQuarter(objectives, quarter)} items={items} />
    </Section>
  );
}
