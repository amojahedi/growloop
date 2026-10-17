"use client";

import { SkillImpact } from "@/components/skills/skill-impact";
import type { ID, Material } from "@/lib/domain/types";
import { ResourceActions } from "./resource-actions";
import { metaLine, ResourceBadges } from "./resource-meta";

/** One resource in the grid, with its skill impact (S-4). The title opens the brief (RS-3). */
export function ResourceCard({
  material,
  onOpenBrief,
}: {
  material: Material;
  onOpenBrief: (id: ID) => void;
}) {
  return (
    <article className="flex h-full flex-col gap-2 rounded-xl bg-card p-4 text-card-foreground ring-1 ring-foreground/10">
      <ResourceBadges material={material} />
      <h3 className="font-medium leading-snug">
        <button
          type="button"
          className="text-left outline-none hover:underline focus-visible:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          onClick={() => onOpenBrief(material.id)}
        >
          {material.title}
        </button>
      </h3>
      <p className="text-xs text-muted-foreground">{metaLine(material)}</p>
      {material.tagline && <p className="line-clamp-2 text-sm">{material.tagline}</p>}
      <SkillImpact material={material} />
      <div className="mt-auto pt-2">
        <ResourceActions material={material} />
      </div>
    </article>
  );
}
