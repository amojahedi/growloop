import { createId } from "./ids";
import type { KeyResult, Material, Objective, QuarterKey, Skill, Workspace } from "./types";

/** Factories for user-created records. */

/** Current schema version of stored data (see src/lib/store/migrations.ts). */
export const APP_DATA_VERSION = 2 as const;

/** A fresh workspace: the given starter skills and nothing planned yet. */
export function newWorkspace(skills: readonly Skill[]): Workspace {
  return {
    version: APP_DATA_VERSION,
    skills: skills.map((skill) => ({ ...skill })),
    customMaterials: [],
    objectives: [],
    planItems: [],
    rollovers: [],
    activity: [],
    savedMaterialIds: [],
  };
}

export type NewSkill = Pick<Skill, "name"> & Partial<Pick<Skill, "description" | "icon" | "color">>;

export function createSkill(input: NewSkill): Skill {
  return {
    id: createId(),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    icon: input.icon ?? "sparkles",
    color: input.color ?? "slate",
    builtIn: false,
  };
}

export type NewMaterial = Pick<Material, "title" | "type" | "skillIds"> &
  Partial<Omit<Material, "id" | "title" | "type" | "skillIds" | "curated">>;

export function createCustomMaterial(input: NewMaterial): Material {
  return {
    author: "",
    tagline: "",
    summary: "",
    audience: "",
    keyTakeaways: [],
    level: "beginner",
    cost: "free",
    ...input,
    id: createId(),
    title: input.title.trim(),
    curated: false,
  };
}

export type NewKeyResult = Pick<KeyResult, "title"> & Partial<Pick<KeyResult, "progressMode" | "manualProgress">>;

export function createKeyResult(input: NewKeyResult): KeyResult {
  return {
    id: createId(),
    title: input.title.trim(),
    progressMode: input.progressMode ?? "auto",
    ...(input.manualProgress === undefined ? {} : { manualProgress: input.manualProgress }),
  };
}

export interface NewObjective {
  quarter: QuarterKey;
  title: string;
  description?: string;
  skillIds?: string[];
  keyResults?: NewKeyResult[];
}

export function createObjective(input: NewObjective, now: string): Objective {
  return {
    id: createId(),
    quarter: input.quarter,
    title: input.title.trim(),
    ...(input.description ? { description: input.description.trim() } : {}),
    skillIds: input.skillIds ?? [],
    keyResults: (input.keyResults ?? []).map(createKeyResult),
    createdAt: now,
  };
}
