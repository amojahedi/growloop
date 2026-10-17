"use client";

import { useState } from "react";
import { Section } from "@/components/app/section";
import type { MaterialType } from "@/lib/domain/types";
import { useMaterials, useSkills } from "@/lib/store/hooks";
import { AIRecommendations } from "./ai-recommendations";
import { MaterialList } from "./material-list";

const TYPES: MaterialType[] = ["course", "book", "article", "podcast", "custom"];

/** Curated library plus custom materials, with search and filters (L-1, L-2). */
export function LibraryView() {
  const materials = useMaterials();
  const skills = useSkills();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<MaterialType | "">("");
  const [skillId, setSkillId] = useState("");

  const needle = query.trim().toLowerCase();
  const filtered = materials.filter(
    (material) =>
      (!type || material.type === type) &&
      (!skillId || material.skillIds.includes(skillId)) &&
      (!needle || `${material.title} ${material.author}`.toLowerCase().includes(needle)),
  );
  const selectedSkill = skills.find((skill) => skill.id === skillId);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2 text-sm">
        <input
          type="search"
          placeholder="Search title or author"
          aria-label="Search materials"
          className="rounded-md border bg-background px-2 py-1"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Filter by type"
          className="rounded-md border bg-background px-2 py-1"
          value={type}
          onChange={(event) => setType(event.target.value as MaterialType | "")}
        >
          <option value="">All types</option>
          {TYPES.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by skill"
          className="rounded-md border bg-background px-2 py-1"
          value={skillId}
          onChange={(event) => setSkillId(event.target.value)}
        >
          <option value="">All skills</option>
          {skills.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name}
            </option>
          ))}
        </select>
      </div>

      {selectedSkill && (
        <AIRecommendations
          context={{ kind: "skill", name: selectedSkill.name, description: selectedSkill.description }}
          existingTitles={materials.map((material) => material.title)}
          skillIds={[selectedSkill.id]}
        />
      )}

      <Section title={`${filtered.length} materials`}>
        <MaterialList materials={filtered} />
      </Section>
    </div>
  );
}
