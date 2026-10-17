"use client";

import { EmptyHint, Section } from "@/components/app/section";
import { skillInvestment } from "@/lib/domain/dashboard";
import { formatHours } from "@/lib/format";
import { useActivity, useMonthNavigation, usePlanItems, useSkills } from "@/lib/store/hooks";

/** Per-skill investment for the month. Data source for the skill radar (D-3). */
export function SkillInvestment() {
  const items = usePlanItems();
  const activity = useActivity();
  const skills = useSkills();
  const { month } = useMonthNavigation();
  const rows = skillInvestment(items, activity, skills, month).filter((row) => row.planned + row.completed + row.hours > 0);

  return (
    <Section title="Skill investment" description="Items planned and completed per skill this month">
      {rows.length === 0 ? (
        <EmptyHint>Nothing planned this month yet.</EmptyHint>
      ) : (
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="py-1 font-normal">Skill</th>
              <th className="py-1 text-right font-normal">Planned</th>
              <th className="py-1 text-right font-normal">Done</th>
              <th className="py-1 text-right font-normal">Hours</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.skillId} className="border-t">
                <td className="py-1">{row.name}</td>
                <td className="py-1 text-right">{row.planned}</td>
                <td className="py-1 text-right">{row.completed}</td>
                <td className="py-1 text-right">{row.hours ? formatHours(row.hours) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  );
}
