import type { AppData, KeyResult, Material, Objective, PlanItem, Skill } from "@/lib/domain/types";

/** Small builders for tests. Every builder takes overrides; ids are sequential and readable. */

let sequence = 0;
const nextId = (prefix: string) => `${prefix}-${++sequence}`;

export function makeSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: nextId("skill"),
    name: "Roadmapping",
    description: "",
    icon: "map",
    color: "violet",
    builtIn: true,
    ...overrides,
  };
}

export function makeMaterial(overrides: Partial<Material> = {}): Material {
  return {
    id: nextId("material"),
    type: "book",
    title: "A Product Book",
    author: "An Author",
    skillIds: [],
    tagline: "",
    summary: "",
    audience: "",
    keyTakeaways: [],
    estimatedHours: 6,
    level: "intermediate",
    cost: "paid",
    curated: true,
    ...overrides,
  };
}

export function makeItem(overrides: Partial<PlanItem> = {}): PlanItem {
  return {
    id: nextId("item"),
    materialId: "material-x",
    month: "2026-10",
    status: "todo",
    order: 0,
    skillIds: [],
    tasks: [],
    notes: "",
    summary: "",
    timeLogs: [],
    createdAt: "2026-10-01T09:00:00.000Z",
    ...overrides,
  };
}

export function makeKeyResult(overrides: Partial<KeyResult> = {}): KeyResult {
  return { id: nextId("kr"), title: "Key result", progressMode: "auto", ...overrides };
}

export function makeObjective(overrides: Partial<Objective> = {}): Objective {
  return {
    id: nextId("objective"),
    quarter: "2026-Q4",
    title: "Objective",
    skillIds: [],
    keyResults: [],
    createdAt: "2026-10-01T09:00:00.000Z",
    ...overrides,
  };
}

export function makeData(overrides: Partial<AppData> = {}): AppData {
  return {
    version: 1,
    skills: [],
    customMaterials: [],
    objectives: [],
    planItems: [],
    rollovers: [],
    ...overrides,
  };
}

/** Midday local time on the given day, as an ISO timestamp (safe from time zone edge cases). */
export function at(day: string, hour = 12): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, hour).toISOString();
}
