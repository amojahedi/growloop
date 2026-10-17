"use client";

import { MaterialTypeIcon } from "@/components/icons";
import { EmptyHint } from "@/components/app/section";
import type { Material } from "@/lib/domain/types";
import { AddToMonthButton } from "./add-to-month-button";

export function MaterialList({ materials }: { materials: readonly Material[] }) {
  if (materials.length === 0) return <EmptyHint>No materials match.</EmptyHint>;

  return (
    <ul className="divide-y">
      {materials.map((material) => (
        <li key={material.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-medium">
              <MaterialTypeIcon type={material.type} className="size-4 shrink-0" />
              {material.url ? (
                <a href={material.url} target="_blank" rel="noreferrer" className="hover:underline">
                  {material.title}
                </a>
              ) : (
                material.title
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {[material.author, material.estimatedHours ? `${material.estimatedHours}h` : null, material.cost]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {material.tagline && <p className="mt-1 text-sm">{material.tagline}</p>}
          </div>
          <AddToMonthButton materialId={material.id} materialTitle={material.title} />
        </li>
      ))}
    </ul>
  );
}
