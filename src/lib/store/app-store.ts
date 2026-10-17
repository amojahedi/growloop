import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BUILT_IN_SKILLS, DEMO_DATA, findMaterial } from "@/lib/catalog";
import {
  APP_DATA_VERSION,
  createCustomMaterial,
  createKeyResult,
  createObjective,
  createSkill,
  emptyAppData,
  type NewKeyResult,
  type NewMaterial,
  type NewObjective,
  type NewSkill,
} from "@/lib/domain/app-data";
import { moveItem, nextOrder, type MoveTarget } from "@/lib/domain/board";
import { createPlanItem } from "@/lib/domain/create-plan-item";
import * as planItems from "@/lib/domain/plan-items";
import { applyRollover } from "@/lib/domain/rollover";
import type {
  AppData,
  BoardStatus,
  ID,
  KeyResult,
  Material,
  MonthKey,
  Objective,
  PlanItem,
  Reminder,
  RolloverDecision,
  RolloverRecord,
  Skill,
  TimeLog,
} from "@/lib/domain/types";
import { isDemoMode } from "@/lib/env";
import { saveBackup } from "./backup";
import { migrateAppData } from "./migrations";
import { validateAppData, type ValidationResult } from "./schema";
import { parseImportedData, serializeAppData } from "./serialization";
import { createSafeStorage } from "./storage";

export const STORAGE_KEY = "growloop:data";

/** What is read back from storage; untrusted until validated in `merge`. */
type PersistedState = { data: unknown };

type SkillPatch = Partial<Pick<Skill, "name" | "description" | "icon" | "color">>;
type MaterialPatch = Partial<Omit<Material, "id" | "curated">>;
type ObjectivePatch = Partial<Pick<Objective, "title" | "description" | "skillIds" | "quarter">>;
type KeyResultPatch = Partial<Pick<KeyResult, "title" | "progressMode" | "manualProgress">>;
type PlanItemPatch = Partial<Pick<PlanItem, "skillIds" | "keyResultId" | "estimatedHours" | "month">>;

export interface AddPlanItemOptions {
  status?: BoardStatus;
  keyResultId?: ID;
  skillIds?: ID[];
}

export interface AppActions {
  // Skills
  addSkill: (input: NewSkill) => ID;
  updateSkill: (id: ID, patch: SkillPatch) => void;
  setSkillHidden: (id: ID, hidden: boolean) => void;
  /** Deletes a user-created skill and untags it everywhere. Built-in skills can only be hidden. */
  deleteSkill: (id: ID) => void;

  // Custom materials
  addCustomMaterial: (input: NewMaterial) => ID;
  updateCustomMaterial: (id: ID, patch: MaterialPatch) => void;
  /** Deletes a custom material and the plan items that use it. */
  deleteCustomMaterial: (id: ID) => void;

  // Objectives & key results
  addObjective: (input: NewObjective) => ID;
  updateObjective: (id: ID, patch: ObjectivePatch) => void;
  /** Deletes an objective and unlinks plan items from its key results. */
  deleteObjective: (id: ID) => void;
  addKeyResult: (objectiveId: ID, input: NewKeyResult) => ID;
  updateKeyResult: (objectiveId: ID, keyResultId: ID, patch: KeyResultPatch) => void;
  deleteKeyResult: (objectiveId: ID, keyResultId: ID) => void;

  // Plan items
  /** Adds a material to a month's board. Returns the new item id, or undefined if the material is unknown. */
  addPlanItem: (materialId: ID, month: MonthKey, options?: AddPlanItemOptions) => ID | undefined;
  updatePlanItem: (id: ID, patch: PlanItemPatch) => void;
  movePlanItem: (id: ID, target: MoveTarget) => void;
  deletePlanItem: (id: ID) => void;

  // Card detail
  addTask: (itemId: ID, title: string) => void;
  renameTask: (itemId: ID, taskId: ID, title: string) => void;
  setTaskDone: (itemId: ID, taskId: ID, done: boolean) => void;
  deleteTask: (itemId: ID, taskId: ID) => void;
  setNotes: (itemId: ID, notes: string) => void;
  setSummary: (itemId: ID, summary: string) => void;
  setReminder: (itemId: ID, reminder: Reminder | undefined) => void;
  dismissReminder: (itemId: ID) => void;
  logTime: (itemId: ID, log: Omit<TimeLog, "id">) => void;
  deleteTimeLog: (itemId: ID, logId: ID) => void;

  // Month rollover
  applyRollover: (toMonth: MonthKey, decisions: Readonly<Record<ID, RolloverDecision>>) => RolloverRecord;

  // Data management
  exportData: () => string;
  importData: (json: string) => ValidationResult<AppData>;
  /** Replaces everything with the sample workspace. */
  resetToDemo: () => void;
  /** Replaces everything with built-in skills and an empty plan. */
  resetToEmpty: () => void;
}

export interface AppState extends AppActions {
  data: AppData;
}

const now = () => new Date().toISOString();

const clone = <T>(value: T): T => structuredClone(value);

export const demoAppData = (): AppData => clone(DEMO_DATA);
export const emptyWorkspace = (): AppData => emptyAppData(BUILT_IN_SKILLS);

/** First-run data: the sample workspace on the hosted demo, otherwise an empty plan. */
export const initialAppData = (): AppData => (isDemoMode ? demoAppData() : emptyWorkspace());

const omitKey = <T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> => {
  const { [key]: _omitted, ...rest } = value;
  return rest;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      /** Applies a pure transformation to the persisted data. */
      const update = (recipe: (data: AppData) => AppData) => set((state) => ({ data: recipe(state.data) }));

      const updateItems = (recipe: (items: PlanItem[]) => PlanItem[]) =>
        update((data) => ({ ...data, planItems: recipe(data.planItems) }));

      const updateItem = (id: ID, recipe: (item: PlanItem) => PlanItem) =>
        updateItems((items) => items.map((item) => (item.id === id ? recipe(item) : item)));

      const updateObjectives = (recipe: (objectives: Objective[]) => Objective[]) =>
        update((data) => ({ ...data, objectives: recipe(data.objectives) }));

      const updateObjectiveById = (id: ID, recipe: (objective: Objective) => Objective) =>
        updateObjectives((objectives) => objectives.map((o) => (o.id === id ? recipe(o) : o)));

      const unlinkKeyResults = (items: PlanItem[], keyResultIds: ReadonlySet<ID>) =>
        items.map((item) =>
          item.keyResultId && keyResultIds.has(item.keyResultId) ? omitKey(item, "keyResultId") : item,
        );

      return {
        data: initialAppData(),

        // --- Skills -----------------------------------------------------------
        addSkill: (input) => {
          const skill = createSkill(input);
          update((data) => ({ ...data, skills: [...data.skills, skill] }));
          return skill.id;
        },
        updateSkill: (id, patch) =>
          update((data) => ({
            ...data,
            skills: data.skills.map((skill) => (skill.id === id ? { ...skill, ...patch } : skill)),
          })),
        setSkillHidden: (id, hidden) =>
          update((data) => ({
            ...data,
            skills: data.skills.map((skill) => (skill.id === id ? { ...skill, hidden } : skill)),
          })),
        deleteSkill: (id) =>
          update((data) => {
            const skill = data.skills.find((s) => s.id === id);
            if (!skill || skill.builtIn) return data;
            const untag = <T extends { skillIds: ID[] }>(record: T): T =>
              record.skillIds.includes(id) ? { ...record, skillIds: record.skillIds.filter((s) => s !== id) } : record;
            return {
              ...data,
              skills: data.skills.filter((s) => s.id !== id),
              customMaterials: data.customMaterials.map(untag),
              objectives: data.objectives.map(untag),
              planItems: data.planItems.map(untag),
            };
          }),

        // --- Custom materials -------------------------------------------------
        addCustomMaterial: (input) => {
          const material = createCustomMaterial(input);
          update((data) => ({ ...data, customMaterials: [...data.customMaterials, material] }));
          return material.id;
        },
        updateCustomMaterial: (id, patch) =>
          update((data) => ({
            ...data,
            customMaterials: data.customMaterials.map((m) => (m.id === id ? { ...m, ...patch } : m)),
          })),
        deleteCustomMaterial: (id) =>
          update((data) => ({
            ...data,
            customMaterials: data.customMaterials.filter((m) => m.id !== id),
            planItems: data.planItems.filter((item) => item.materialId !== id),
          })),

        // --- Objectives & key results -------------------------------------------
        addObjective: (input) => {
          const objective = createObjective(input, now());
          updateObjectives((objectives) => [...objectives, objective]);
          return objective.id;
        },
        updateObjective: (id, patch) => updateObjectiveById(id, (objective) => ({ ...objective, ...patch })),
        deleteObjective: (id) =>
          update((data) => {
            const objective = data.objectives.find((o) => o.id === id);
            if (!objective) return data;
            const keyResultIds = new Set(objective.keyResults.map((kr) => kr.id));
            return {
              ...data,
              objectives: data.objectives.filter((o) => o.id !== id),
              planItems: unlinkKeyResults(data.planItems, keyResultIds),
            };
          }),
        addKeyResult: (objectiveId, input) => {
          const keyResult = createKeyResult(input);
          updateObjectiveById(objectiveId, (o) => ({ ...o, keyResults: [...o.keyResults, keyResult] }));
          return keyResult.id;
        },
        updateKeyResult: (objectiveId, keyResultId, patch) =>
          updateObjectiveById(objectiveId, (o) => ({
            ...o,
            keyResults: o.keyResults.map((kr) => (kr.id === keyResultId ? { ...kr, ...patch } : kr)),
          })),
        deleteKeyResult: (objectiveId, keyResultId) =>
          update((data) => ({
            ...data,
            objectives: data.objectives.map((o) =>
              o.id === objectiveId ? { ...o, keyResults: o.keyResults.filter((kr) => kr.id !== keyResultId) } : o,
            ),
            planItems: unlinkKeyResults(data.planItems, new Set([keyResultId])),
          })),

        // --- Plan items ---------------------------------------------------------
        addPlanItem: (materialId, month, options = {}) => {
          const { data } = get();
          const material = findMaterial(materialId, data.customMaterials);
          if (!material) return undefined;
          const status = options.status ?? "todo";
          const item = createPlanItem(material, month, {
            ...options,
            status,
            order: nextOrder(data.planItems, month, status),
            now: now(),
          });
          updateItems((items) => [...items, item]);
          return item.id;
        },
        updatePlanItem: (id, patch) =>
          updateItems((items) =>
            items.map((item) => {
              if (item.id !== id) return item;
              const next = { ...item, ...patch };
              if (patch.month && patch.month !== item.month) {
                next.order = nextOrder(items, patch.month, item.status);
              }
              return "keyResultId" in patch && !patch.keyResultId ? omitKey(next, "keyResultId") : next;
            }),
          ),
        movePlanItem: (id, target) => updateItems((items) => moveItem(items, id, target, now())),
        deletePlanItem: (id) => updateItems((items) => items.filter((item) => item.id !== id)),

        // --- Card detail ----------------------------------------------------------
        addTask: (itemId, title) => updateItem(itemId, (item) => planItems.addTask(item, title)),
        renameTask: (itemId, taskId, title) =>
          updateItem(itemId, (item) => planItems.renameTask(item, taskId, title)),
        setTaskDone: (itemId, taskId, done) =>
          updateItem(itemId, (item) => planItems.setTaskDone(item, taskId, done, now())),
        deleteTask: (itemId, taskId) => updateItem(itemId, (item) => planItems.removeTask(item, taskId)),
        setNotes: (itemId, notes) => updateItem(itemId, (item) => planItems.setNotes(item, notes, now())),
        setSummary: (itemId, summary) => updateItem(itemId, (item) => planItems.setSummary(item, summary, now())),
        setReminder: (itemId, reminder) => updateItem(itemId, (item) => planItems.setReminder(item, reminder)),
        dismissReminder: (itemId) =>
          updateItem(itemId, (item) =>
            item.reminder ? planItems.setReminder(item, { ...item.reminder, dismissed: true }) : item,
          ),
        logTime: (itemId, log) => updateItem(itemId, (item) => planItems.addTimeLog(item, log)),
        deleteTimeLog: (itemId, logId) => updateItem(itemId, (item) => planItems.removeTimeLog(item, logId)),

        // --- Month rollover ---------------------------------------------------------
        applyRollover: (toMonth, decisions) => {
          const result = applyRollover(get().data, toMonth, decisions, now());
          set({ data: result.data });
          return result.record;
        },

        // --- Data management ----------------------------------------------------------
        exportData: () => serializeAppData(get().data),
        importData: (json) => {
          const result = parseImportedData(json);
          if (result.ok) set({ data: result.data });
          return result;
        },
        resetToDemo: () => set({ data: demoAppData() }),
        resetToEmpty: () => set({ data: emptyWorkspace() }),
      };
    },
    {
      name: STORAGE_KEY,
      version: APP_DATA_VERSION,
      storage: createSafeStorage<PersistedState>(),
      partialize: (state) => ({ data: state.data }),
      // Rehydrated explicitly after mount (see StoreHydrator) so server and first client render match.
      skipHydration: true,
      migrate: (persisted, version) => {
        try {
          return { data: migrateAppData((persisted as { data?: unknown } | null)?.data, version) };
        } catch (error) {
          console.warn("[growloop] Could not migrate saved data.", error);
          return { data: undefined };
        }
      },
      merge: (persisted, current) => {
        // Nothing saved yet: keep the first-run data.
        if (persisted === undefined) return current;

        const result = validateAppData((persisted as { data?: unknown } | null)?.data);
        if (result.ok) return { ...current, data: result.data };

        backUpRawSavedData();
        console.warn("[growloop] Saved data is invalid and was backed up; starting fresh.", result.error);
        return current;
      },
    },
  ),
);

/** Keeps a copy of the raw saved value so a failed validation never silently destroys user data. */
function backUpRawSavedData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saveBackup(raw);
  } catch {
    // Storage unavailable: nothing to preserve.
  }
}
