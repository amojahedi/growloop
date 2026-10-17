"use client";

import { PlusIcon, SearchXIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { ID } from "@/lib/domain/types";
import { useLibraryIds, useMaterials, useSkills } from "@/lib/store/hooks";
import { ActiveFilterChips } from "./active-filter-chips";
import { AddOwnDialog } from "./add-own-dialog";
import { AIRecommendations } from "./ai-recommendations";
import { FilterBar } from "./filter-bar";
import { buildFilterGroups } from "./filter-groups";
import { ResourceBrief } from "./resource-brief";
import { ResourceCard } from "./resource-card";
import { applyFilters, clearFilters, hasActiveFilters } from "./resource-filters";
import { useResourceFilters } from "./use-resource-filters";

/**
 * Resources and My Library in one place (RS-1–RS-4, ML-1–ML-3): the curated
 * catalog plus the user's own items, with URL-synced search, filters and sort.
 * Result totals are deliberately not shown.
 */
export function LibraryView() {
  const materials = useMaterials();
  const skills = useSkills();
  const libraryIds = useLibraryIds();
  const knownSkillIds = useMemo(() => new Set(skills.map((skill) => skill.id)), [skills]);
  const skillMap = useMemo(() => new Map(skills.map((skill) => [skill.id, skill])), [skills]);
  const groups = useMemo(() => buildFilterGroups(skills), [skills]);
  const { filters, updateFilters } = useResourceFilters(knownSkillIds);

  const results = useMemo(() => applyFilters(materials, filters, { libraryIds }), [materials, filters, libraryIds]);
  const [briefId, setBriefId] = useState<ID>();
  const [addOwnOpen, setAddOwnOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const brief = materials.find((material) => material.id === briefId);
  const focusedSkill = filters.skills.length === 1 ? skillMap.get(filters.skills[0]) : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <FilterBar filters={filters} groups={groups} onUpdate={updateFilters} />
        <ActiveFilterChips filters={filters} groups={groups} onUpdate={updateFilters} />
      </div>

      {focusedSkill && (
        <AIRecommendations
          context={{ kind: "skill", name: focusedSkill.name, description: focusedSkill.description }}
          existingTitles={materials.map((material) => material.title)}
          skillIds={[focusedSkill.id]}
        />
      )}

      <section aria-labelledby="resources-heading" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="resources-heading" className="font-heading text-base font-medium">
            Resources
          </h2>
          <Button variant="outline" size="sm" onClick={() => setAddOwnOpen(true)}>
            <PlusIcon aria-hidden />
            Add your own
          </Button>
        </div>
        <p className="sr-only" role="status">
          {announcement}
        </p>

        {results.length === 0 ? (
          <EmptyState
            filtered={hasActiveFilters(filters)}
            onClear={() => updateFilters(clearFilters)}
            onAddOwn={() => setAddOwnOpen(true)}
          />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((material) => (
              <li key={material.id}>
                <ResourceCard material={material} onOpenBrief={setBriefId} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <ResourceBrief material={brief} onClose={() => setBriefId(undefined)} />
      <AddOwnDialog open={addOwnOpen} onOpenChange={setAddOwnOpen} onOpenExisting={setBriefId} onSaved={setAnnouncement} />
    </div>
  );
}

function EmptyState({ filtered, onClear, onAddOwn }: { filtered: boolean; onClear: () => void; onAddOwn: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center">
      <SearchXIcon aria-hidden className="size-6 text-muted-foreground" />
      <div>
        <p className="font-medium">Nothing matches</p>
        <p className="text-sm text-muted-foreground">
          {filtered
            ? "Try fewer filters or a shorter search, or add the thing you have in mind yourself."
            : "There's nothing here yet. Add something you want to learn from."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {filtered && <Button onClick={onClear}>Clear filters</Button>}
        <Button variant="outline" onClick={onAddOwn}>
          Add your own
        </Button>
      </div>
    </div>
  );
}
