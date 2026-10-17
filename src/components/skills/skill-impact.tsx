"use client";

import { MAX_SKILL_WEIGHT, skillImpact, type ImpactSource } from "@/lib/domain/skill-impact";
import { formatWeight } from "@/lib/format";
import { useSkills } from "@/lib/store/hooks";
import { skillColorVar } from "@/lib/theme/skill-colors";
import { cn } from "@/lib/utils";

const strength = (weight: number) => (weight >= 1.5 ? "strong" : weight >= 0.75 ? "moderate" : "light");

/**
 * Compact per-skill impact bars for a material or plan item (S-4): which skills
 * it builds and how strongly. Bars are scaled to the largest possible weight,
 * so they compare across items.
 */
export function SkillImpact({ material, className }: { material: ImpactSource; className?: string }) {
  const skills = useSkills({ includeHidden: true });
  const impact = skillImpact(material, skills);
  if (impact.length === 0) return null;
  const names = new Map(skills.map((skill) => [skill.id, skill]));

  return (
    <ul aria-label="Skill impact" className={cn("flex flex-col gap-1 text-xs", className)}>
      {impact.map(({ skillId, weight }) => {
        const skill = names.get(skillId);
        if (!skill) return null;
        return (
          <li key={skillId} className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-2">
            <span className="truncate">
              {skill.name}
              <span className="sr-only">
                : {strength(weight)} impact ({formatWeight(weight)})
              </span>
            </span>
            <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted" title={formatWeight(weight)}>
              <span
                className="block h-full rounded-full"
                style={{ width: `${(weight / MAX_SKILL_WEIGHT) * 100}%`, backgroundColor: skillColorVar(skill.color) }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}
