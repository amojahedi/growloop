"use client";

import { Section } from "@/components/app/section";
import { formatQuarter } from "@/lib/domain/dates";
import { objectivesForQuarter } from "@/lib/domain/okrs";
import { useMonthNavigation, useObjectives, usePlanItems } from "@/lib/store/hooks";
import { ObjectiveProgressList } from "../okrs/objective-progress-list";
import { RolloverReview } from "../rollover/rollover-review";
import { ReflectionsFeed } from "./reflections-feed";
import { RemindersPanel } from "./reminders-panel";
import { SkillInvestment } from "./skill-investment";
import { StatCards } from "./stat-cards";

export function DashboardView() {
  const items = usePlanItems();
  const objectives = useObjectives();
  const { quarter } = useMonthNavigation();

  return (
    <div className="flex flex-col gap-6">
      <RolloverReview />
      <StatCards />
      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="OKR progress" description={formatQuarter(quarter)}>
          <ObjectiveProgressList objectives={objectivesForQuarter(objectives, quarter)} items={items} />
        </Section>
        <SkillInvestment />
        <ReflectionsFeed />
        <RemindersPanel />
      </div>
    </div>
  );
}
