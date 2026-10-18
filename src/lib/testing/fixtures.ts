import type { AppData, LegacyKeyResult, LegacyObjective, LegacyPlanItem, WorkspaceV2, WorkspaceV3 } from "@/lib/domain/legacy-types";
import type { ActivityEvent, KeyResult, Material, Note, Objective, PlanItem, Skill, Workspace } from "@/lib/domain/types";

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
    timeLogs: [],
    createdAt: "2026-10-01T09:00:00.000Z",
    ...overrides,
  };
}

export function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: nextId("note"),
    kind: "free",
    body: "A note",
    skillIds: [],
    createdAt: "2026-10-01T09:00:00.000Z",
    updatedAt: "2026-10-01T09:00:00.000Z",
    ...overrides,
  };
}

export function makeKeyResult(overrides: Partial<KeyResult> = {}): KeyResult {
  return { id: nextId("kr"), title: "Key result", skillId: "roadmapping", type: "count", count: 3, ...overrides };
}

export function makeObjective(overrides: Partial<Objective> = {}): Objective {
  return {
    id: nextId("objective"),
    quarter: "2026-Q4",
    title: "Objective",
    status: "active",
    source: "manual",
    keyResults: [],
    createdAt: "2026-10-01T09:00:00.000Z",
    ...overrides,
  };
}

export function makeData(overrides: Partial<Workspace> = {}): Workspace {
  return {
    version: 4,
    profile: { skillLevels: [] },
    skills: [],
    customMaterials: [],
    savedMaterialIds: [],
    objectives: [],
    planItems: [],
    notes: [],
    rollovers: [],
    activity: [],
    archivedYears: [],
    dashboardLayout: null,
    ...overrides,
  };
}

// --- Older schemas ------------------------------------------------------------------

export function makeLegacyItem(overrides: Partial<LegacyPlanItem> = {}): LegacyPlanItem {
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

export function makeLegacyKeyResult(overrides: Partial<LegacyKeyResult> = {}): LegacyKeyResult {
  return { id: nextId("kr"), title: "Key result", progressMode: "auto", ...overrides };
}

export function makeLegacyObjective(overrides: Partial<LegacyObjective> = {}): LegacyObjective {
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

/** Schema v3 data (before notes and typed key results), e.g. a save from an older build. */
export function makeDataV3(overrides: Partial<WorkspaceV3> = {}): WorkspaceV3 {
  return {
    version: 3,
    skills: [],
    customMaterials: [],
    objectives: [],
    planItems: [],
    rollovers: [],
    activity: [],
    savedMaterialIds: [],
    dashboardLayout: null,
    ...overrides,
  };
}

/** Schema v2 data (before the dashboard layout). */
export function makeDataV2(overrides: Partial<WorkspaceV2> = {}): WorkspaceV2 {
  const { dashboardLayout: _layout, ...rest } = makeDataV3();
  return { ...rest, version: 2, ...overrides };
}

/** Schema v1 data (before the activity log), e.g. authored seed data or an old export. */
export function makeDataV1(overrides: Partial<AppData> = {}): AppData {
  const { activity: _activity, savedMaterialIds: _saved, dashboardLayout: _layout, ...rest } = makeDataV3();
  return { ...rest, version: 1, ...overrides };
}

export function makeEvent(overrides: Partial<ActivityEvent> = {}): ActivityEvent {
  return {
    id: nextId("event"),
    kind: "task_completed",
    day: "2026-10-01",
    at: "2026-10-01T12:00:00.000Z",
    itemId: "item-x",
    materialId: "material-x",
    skillIds: [],
    ...overrides,
  };
}

/** Midday local time on the given day, as an ISO timestamp (safe from time zone edge cases). */
export function at(day: string, hour = 12): string {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date, hour).toISOString();
}
