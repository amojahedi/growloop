"use client";

import Link from "next/link";
import { SkillIcon } from "@/components/icons";
import { PageHeader } from "@/components/app/page-header";
import { EmptyHint, Section } from "@/components/app/section";
import { Badge } from "@/components/ui/badge";
import { materialsForSkill } from "@/lib/catalog";
import { formatMonth } from "@/lib/domain/dates";
import type { ID } from "@/lib/domain/types";
import { skillColorVar } from "@/lib/theme/skill-colors";
import { useAppData, useMaterialMap, useMaterials, usePlanItems, useSkill } from "@/lib/store/hooks";
import { AIRecommendations } from "../library/ai-recommendations";
import { MaterialList } from "../library/material-list";
import { STATUS_LABELS } from "../board/board-labels";

/** Skill detail: description, related materials, items in plan, progress (S-3). */
export function SkillDetailView({ skillId }: { skillId: ID }) {
  const skill = useSkill(skillId);
  const { customMaterials } = useAppData();
  const items = usePlanItems().filter((item) => item.skillIds.includes(skillId));
  const materialMap = useMaterialMap();
  const allTitles = useMaterials().map((material) => material.title);

  if (!skill) {
    return (
      <EmptyHint>
        This skill doesn&apos;t exist. <Link href="/skills" className="underline">Back to skills</Link>
      </EmptyHint>
    );
  }

  const done = items.filter((item) => item.status === "done").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={skill.name} description={skill.description} />
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <SkillIcon name={skill.icon} className="size-4" style={{ color: skillColorVar(skill.color) }} />
        {done} of {items.length} planned items done
      </p>

      <Section title="In your plan">
        {items.length === 0 ? (
          <EmptyHint>Nothing planned for this skill yet.</EmptyHint>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {items.map((item) => (
              <li key={item.id} className="flex justify-between gap-2">
                <span>{materialMap.get(item.materialId)?.title ?? "Unknown material"}</span>
                <span className="flex shrink-0 gap-1">
                  <Badge variant="outline">{formatMonth(item.month)}</Badge>
                  <Badge variant="secondary">{STATUS_LABELS[item.status]}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <AIRecommendations
        context={{ kind: "skill", name: skill.name, description: skill.description }}
        existingTitles={allTitles}
        skillIds={[skill.id]}
      />

      <Section title="Materials">
        <MaterialList materials={materialsForSkill(skill.id, customMaterials)} />
      </Section>
    </div>
  );
}
