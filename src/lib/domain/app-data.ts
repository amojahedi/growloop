import { createId } from "./ids";
import type {
  KeyResult,
  KeyResultType,
  Material,
  Objective,
  ObjectiveSource,
  QuarterKey,
  Skill,
  Workspace,
} from "./types";

/** Factories for user-created records. */

/** Current schema version of stored data (see src/lib/store/migrations.ts). */
export const APP_DATA_VERSION = 4 as const;

/** A fresh workspace: the given starter skills and nothing planned yet. */
export function newWorkspace(skills: readonly Skill[]): Workspace {
  return {
    version: APP_DATA_VERSION,
    profile: { skillLevels: [] },
    skills: skills.map((skill) => ({ ...skill })),
    customMaterials: [],
    savedMaterialIds: [],
    objectives: [],
    planItems: [],
    notes: [],
    rollovers: [],
    activity: [],
    archivedYears: [],
    dashboardLayout: null,
  };
}

/**
 * Whether the user has created anything yet (first-launch screen, sample exit):
 * no objectives, cards, notes, saved or own materials. Skills don't count.
 */
export function isEmptyWorkspace(workspace: Workspace): boolean {
  return (
    workspace.objectives.length === 0 &&
    workspace.planItems.length === 0 &&
    workspace.notes.length === 0 &&
    workspace.savedMaterialIds.length === 0 &&
    workspace.customMaterials.length === 0
  );
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

/** A key result as entered in an editor or a draft. An `id` keeps an existing KR (and its card links). */
export interface NewKeyResult {
  id?: string;
  title: string;
  skillId: string;
  type: KeyResultType;
  materialId?: string;
  count?: number;
}

/** Keeps only the target that fits the type: a material for material/certification KRs, a count for count KRs. */
export function createKeyResult(input: NewKeyResult): KeyResult {
  const target =
    input.type === "count"
      ? input.count === undefined
        ? {}
        : { count: input.count }
      : input.materialId === undefined
        ? {}
        : { materialId: input.materialId };
  return { id: input.id ?? createId(), title: input.title.trim(), skillId: input.skillId, type: input.type, ...target };
}

export interface NewObjective {
  quarter: QuarterKey;
  title: string;
  why?: string;
  source?: ObjectiveSource;
  keyResults?: NewKeyResult[];
}

export function createObjective(input: NewObjective, now: string): Objective {
  const why = input.why?.trim();
  return {
    id: createId(),
    quarter: input.quarter,
    title: input.title.trim(),
    ...(why ? { why } : {}),
    status: "active",
    source: input.source ?? "manual",
    keyResults: (input.keyResults ?? []).map(createKeyResult),
    createdAt: now,
  };
}
