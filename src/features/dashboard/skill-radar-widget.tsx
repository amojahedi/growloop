"use client";

import { EmptyHint, Section } from "@/components/app/section";
import { SkillRadar, type SkillRadarSeries } from "@/components/skills/skill-radar";
import { formatMonth } from "@/lib/domain/dates";
import { radarSeries, skillImpact } from "@/lib/domain/skill-impact";
import { useAppData, useMonthNavigation, useSkillPreview } from "@/lib/store/hooks";

/**
 * Skill growth in the viewed month (D-2, S-4): completed impact against what
 * the month's plan would add, plus a faint preview of a hovered item's impact.
 */
export function SkillRadarWidget() {
  const data = useAppData();
  const preview = useSkillPreview();
  const { month } = useMonthNavigation();
  const axes = radarSeries(data, month);

  if (axes.length === 0) {
    return (
      <Section title="Skill radar" className="h-full">
        <EmptyHint>Show at least one skill in Settings to see your skill radar.</EmptyHint>
      </Section>
    );
  }

  const series: SkillRadarSeries[] = [
    { key: "projected", label: "Projected", values: axes.map((axis) => axis.projected), variant: "dashed" },
    { key: "completed", label: "Completed", unit: "done", values: axes.map((axis) => axis.completed), variant: "solid" },
  ];
  if (preview) {
    const weights = new Map(skillImpact(preview.source, data.skills).map((w) => [w.skillId, w.weight]));
    series.push({
      key: "preview",
      label: preview.label,
      unit: "from this item",
      values: axes.map((axis) => weights.get(axis.skillId) ?? 0),
      variant: "preview",
    });
  }

  return (
    <Section title="Skill radar" description={`Skill impact in ${formatMonth(month)}`} className="h-full">
      <SkillRadar axes={axes} series={series} title={`Skill impact per skill, ${formatMonth(month)}`} />
    </Section>
  );
}
