"use client";

import { useMemo } from "react";
import { useMaterialMap, useMaterials, useSkills } from "@/lib/store/hooks";
import type { EditorLookup } from "./editor-model";

/** What the ObjectiveEditor and the OKR cards look things up in: materials (catalog + own) and skills (incl. hidden). */
export function useEditorData() {
  const materials = useMaterials();
  const materialMap = useMaterialMap();
  const allSkills = useSkills({ includeHidden: true });
  const visibleSkills = useSkills();
  const lookup = useMemo<EditorLookup>(
    () => ({ materials: materialMap, skills: new Map(allSkills.map((skill) => [skill.id, skill])) }),
    [materialMap, allSkills],
  );
  return { materials, visibleSkills, lookup };
}
