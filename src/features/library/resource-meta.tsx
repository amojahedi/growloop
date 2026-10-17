"use client";

import { Badge } from "@/components/ui/badge";
import { MaterialTypeIcon } from "@/components/icons";
import type { ID, Material, Skill } from "@/lib/domain/types";
import { formatHours } from "@/lib/format";
import { skillColorVar } from "@/lib/theme/skill-colors";
import { useLibraryIds, useMonthNavigation, usePlanItems } from "@/lib/store/hooks";
import { COST_LABELS, LEVEL_LABELS, TYPE_LABELS } from "./labels";

/** Small pieces shared by the resource card and the brief. */

/** "Marty Cagan · 9h · Beginner · Paid" */
export function metaLine(material: Material): string {
  return [
    material.author,
    material.estimatedHours ? formatHours(material.estimatedHours) : null,
    LEVEL_LABELS[material.level],
    COST_LABELS[material.cost],
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Type label with its icon, plus In library / On board / Added by you badges. */
export function ResourceBadges({ material }: { material: Material }) {
  const { currentMonth } = useMonthNavigation();
  const inLibrary = useLibraryIds().has(material.id);
  const onBoard = usePlanItems().some((item) => item.materialId === material.id && item.month === currentMonth);

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
      <span className="mr-1 inline-flex items-center gap-1">
        <MaterialTypeIcon type={material.type} className="size-3.5" />
        {TYPE_LABELS[material.type]}
      </span>
      {!material.curated && <Badge variant="outline">Added by you</Badge>}
      {material.curated && inLibrary && <Badge variant="secondary">In library</Badge>}
      {onBoard && <Badge variant="secondary">On board</Badge>}
    </div>
  );
}

/** The material's skills, each with its color dot. */
export function SkillDots({ skillIds, skills }: { skillIds: readonly ID[]; skills: ReadonlyMap<ID, Skill> }) {
  const tagged = skillIds.map((id) => skills.get(id)).filter((skill): skill is Skill => skill !== undefined);
  if (tagged.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground" aria-label="Skills">
      {tagged.map((skill) => (
        <li key={skill.id} className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: skillColorVar(skill.color) }} />
          {skill.name}
        </li>
      ))}
    </ul>
  );
}
