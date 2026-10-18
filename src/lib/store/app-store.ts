import { create } from "zustand";
import { persist, type PersistStorage, type StorageValue } from "zustand/middleware";
import { forgetApiKey } from "@/lib/ai/providers/key-storage";
import { findMaterial } from "@/lib/catalog";
import { now as clockNow, DEV_NOW_STORAGE_KEY } from "@/lib/clock";
import { syncActivity, syncNoteActivity } from "@/lib/domain/activity";
import {
  APP_DATA_VERSION,
  isEmptyWorkspace,
  createCustomMaterial,
  createKeyResult,
  createObjective,
  createSkill,
  type NewKeyResult,
  type NewMaterial,
  type NewObjective,
  type NewSkill,
} from "@/lib/domain/app-data";
import { moveItem, nextOrder, type MoveTarget } from "@/lib/domain/board";
import { createPlanItem } from "@/lib/domain/create-plan-item";
import { compareMonths, dayKey, monthOf, quarterOfDay, yearOf, type DayKey } from "@/lib/domain/dates";
import { applyMonthReview, type MonthReviewDecisions } from "@/lib/domain/month-review";
import { createCardNote, createFreeNote, findCardNote, type NewFreeNote } from "@/lib/domain/notes";
import { autoLinkKeyResult, objectiveProgress } from "@/lib/domain/okrs";
import type { DraftSource, PlanDraft, WizardAnswers } from "@/lib/domain/plan-draft";
import * as planItems from "@/lib/domain/plan-items";
import type {
  BoardStatus,
  CardNoteKind,
  ID,
  KeyResult,
  Material,
  MonthKey,
  Note,
  Objective,
  PlanItem,
  Profile,
  Reminder,
  RolloverRecord,
  Skill,
  SkillLevel,
  SkillLevelValue,
  TimeLog,
  WidgetPlacement,
  Workspace,
} from "@/lib/domain/types";
import { deleteBackup, saveBackup } from "./backup";
import { clearDevicePreferences, isSampleModeOn, updateDevicePreferences } from "./device";
import { migrateAppData } from "./migrations";
import { validateWorkspace, type ValidationResult } from "./schema";
import { emptyWorkspace, sampleWorkspace } from "./seed";
import { parseImportedData, serializeWorkspace } from "./serialization";
import { createSafeStorage } from "./storage";
import { clearWizardSession } from "./ui-store";

/**
 * The workspace store: every change to persisted data goes through an action
 * here. Frozen after WP0 (build plan): Phase 1 packages add actions only, in a
 * clearly marked section at the end of `AppActions`, and never change existing ones.
 */

/** The user's own workspace (ADR 009). */
export const STORAGE_KEY = "growloop:data";
/** The sample workspace, used while sample mode is on; `growloop:data` is never written then. */
export const SAMPLE_STORAGE_KEY = "growloop:sample";

/** The storage key the store should read and write right now. */
export const activeStorageKey = (): string => (isSampleModeOn() ? SAMPLE_STORAGE_KEY : STORAGE_KEY);

/**
 * What is read back from storage; untrusted until validated in `merge`.
 * `loadError` says why nothing usable was read (set by the workspace storage).
 */
type PersistedState = { data: unknown; loadError?: "invalid" | "newer" };

// --- Inputs ---------------------------------------------------------------------------

type SkillPatch = Partial<Pick<Skill, "name" | "description" | "icon" | "color">>;
type MaterialPatch = Partial<Omit<Material, "id" | "curated">>;
/** `undefined` clears a field. */
export type ProfilePatch = Partial<Pick<Profile, "name" | "role" | "goal" | "goalText">>;
/** `keyResults` replaces the list: entries with an `id` keep that KR (and its card links), others are new. */
export type ObjectivePatch = Partial<Pick<Objective, "title" | "why" | "quarter">> & { keyResults?: NewKeyResult[] };
type KeyResultPatch = Partial<Omit<KeyResult, "id">>;
/** `keyResultId: undefined` unlinks. Skills change through `setPlanItemSkills`. */
type PlanItemPatch = Partial<Pick<PlanItem, "keyResultId" | "estimatedHours" | "month">>;
/** Card notes only take `body`; title and skills belong to free notes. */
export type NotePatch = Partial<Pick<Note, "title" | "body" | "skillIds">>;

export interface AddPlanItemOptions {
  status?: BoardStatus;
  /** Link to this KR. Without it, a card for a KR's target material links itself (auto-link). */
  keyResultId?: ID;
  /** Set to false to skip auto-linking. */
  autoLink?: boolean;
  skillIds?: ID[];
}

export interface AcceptPlanInput {
  /** A repaired draft (every objective valid and in scope). */
  draft: PlanDraft;
  source: DraftSource;
  answers: WizardAnswers;
}

// --- Undo records -----------------------------------------------------------------------
// Undoable actions return what they removed; the matching restore action puts it back.
// Restores act on ids, so edits made in between (e.g. during an 8 s undo toast) survive.

export interface RemovedPlanItem {
  item: PlanItem;
}

export interface DeletedObjective {
  objective: Objective;
  index: number;
  /** Cards that were linked to its key results, with the KR they pointed at. */
  unlinked: { itemId: ID; keyResultId: ID }[];
}

/** Where a skill was removed from, so undo puts it back in the same position (the first skill is the primary). */
interface SkillTag {
  id: ID;
  index: number;
}

export interface DeletedSkill {
  skill: Skill;
  index: number;
  items: SkillTag[];
  materials: SkillTag[];
  notes: SkillTag[];
  level?: SkillLevel;
}

export type DeleteSkillResult =
  | { ok: true; deleted: DeletedSkill; removedFromItems: number }
  | { ok: false; reason: "not-found" | "built-in" | "used-by-key-result" };

export interface AcceptedPlan {
  objectiveIds: ID[];
  /** Backlog cards created for current-quarter material KRs. */
  createdItemIds: ID[];
  /** Cards already on this month's board that were linked instead. */
  linkedItems: { itemId: ID; previousKeyResultId?: ID }[];
  /** Curated targets saved to the library by this accept. */
  savedMaterialIds: ID[];
  previousProfile: Profile;
}

export interface AppActions {
  // Profile and skill levels (S-5, ST-2)
  updateProfile: (patch: ProfilePatch) => void;
  /** Upserts Now/Goal for a skill. */
  setSkillLevel: (skillId: ID, levels: { current: SkillLevelValue; target: SkillLevelValue }) => void;

  // Skills
  addSkill: (input: NewSkill) => ID;
  updateSkill: (id: ID, patch: SkillPatch) => void;
  setSkillHidden: (id: ID, hidden: boolean) => void;
  /** Deletes a user-created skill and untags it everywhere. Built-ins can only be hidden; skills used by a KR can't go. */
  deleteSkill: (id: ID) => DeleteSkillResult;
  restoreSkill: (deleted: DeletedSkill) => void;

  // Custom materials
  addCustomMaterial: (input: NewMaterial) => ID;
  updateCustomMaterial: (id: ID, patch: MaterialPatch) => void;
  /** Deletes a custom material and its cards. Notes about it stay (ADR 010). */
  deleteCustomMaterial: (id: ID) => void;

  // My Library
  /** Saves a curated material to My Library. Unknown ids and the user's own materials are ignored. */
  saveMaterial: (id: ID) => void;
  unsaveMaterial: (id: ID) => void;

  // Objectives and key results
  addObjective: (input: NewObjective) => ID;
  updateObjective: (id: ID, patch: ObjectivePatch) => void;
  /** Deletes an objective and unlinks its cards (never deletes them). */
  deleteObjective: (id: ID) => DeletedObjective | undefined;
  restoreObjective: (deleted: DeletedObjective) => void;
  addKeyResult: (objectiveId: ID, input: NewKeyResult) => ID;
  updateKeyResult: (objectiveId: ID, keyResultId: ID, patch: KeyResultPatch) => void;
  deleteKeyResult: (objectiveId: ID, keyResultId: ID) => void;
  /**
   * Archives an earlier year outside the review (the OKR page's "Archive 2026"
   * button). Ignored for the current or a later year. Active objectives left in
   * that year are closed at their current score first, so none is stranded.
   */
  archiveYear: (year: number) => void;
  /**
   * Saves a wizard draft: objectives, profile, library targets and
   * current-quarter cards (okrs-and-wizard.md §Accept all). It trusts the
   * draft: callers must first limit it to the wizard's scope, apply the yearly
   * cap and run the shared repair step (both engines' drafts).
   */
  acceptPlan: (input: AcceptPlanInput) => AcceptedPlan;
  /** Removes everything `acceptPlan` created and restores what it changed. */
  undoAcceptPlan: (accepted: AcceptedPlan) => void;

  // Plan items
  /** Adds a material to a month's board. Returns the new item id, or undefined if the material is unknown. */
  addPlanItem: (materialId: ID, month: MonthKey, options?: AddPlanItemOptions) => ID | undefined;
  updatePlanItem: (id: ID, patch: PlanItemPatch) => void;
  /** The card's own skills (first = primary); its summary and notes follow them. */
  setPlanItemSkills: (id: ID, skillIds: ID[]) => void;
  movePlanItem: (id: ID, target: MoveTarget) => void;
  /** Removes a card from the board; its notes and activity stay. */
  removePlanItem: (id: ID) => RemovedPlanItem | undefined;
  restorePlanItem: (removed: RemovedPlanItem) => void;
  /** Certifications: "Did you earn it?" (C-7). */
  setItemEarned: (id: ID, earned: boolean) => void;
  /** Records that the "add a summary" toast was shown for this card (at most once). */
  markSummaryNudged: (id: ID) => void;

  // Card detail
  addTask: (itemId: ID, title: string) => void;
  renameTask: (itemId: ID, taskId: ID, title: string) => void;
  setTaskDone: (itemId: ID, taskId: ID, done: boolean) => void;
  deleteTask: (itemId: ID, taskId: ID) => void;
  setReminder: (itemId: ID, reminder: Reminder | undefined) => void;
  dismissReminder: (itemId: ID) => void;
  logTime: (itemId: ID, log: Omit<TimeLog, "id">) => void;
  deleteTimeLog: (itemId: ID, logId: ID) => void;

  // Notes (ADR 010)
  /** Creates a free note and returns its id. */
  createNote: (input?: NewFreeNote) => ID;
  updateNote: (id: ID, patch: NotePatch) => void;
  /**
   * Writes a card's summary or notes. The record is created on the first text
   * (and the first summary ticks "Summarize in my words"); clearing the text
   * keeps the record but hides it. `refined` marks a Claude suggestion that
   * replaced the summary. Returns the note id.
   */
  setCardNote: (itemId: ID, kind: CardNoteKind, body: string, options?: { refined?: boolean }) => ID | undefined;
  deleteNote: (id: ID) => Note | undefined;
  /** Puts a deleted note back, or a note's earlier version (e.g. undoing "Use this version"). */
  restoreNote: (note: Note) => void;
  /** Sets ("2026-10-25") or clears (`null`) the review day. */
  setNoteReview: (id: ID, reviewAt: string | null) => void;
  /** "Reviewed": clears the review day and remembers when. */
  markNoteReviewed: (id: ID) => void;

  // Month-end review (R-1 to R-4)
  /**
   * Applies the review against the same day the dialog showed (`today` from
   * useToday), so a review opened before midnight applies what it displayed.
   * Omitted decisions get their defaults. Undefined when nothing is pending.
   */
  applyMonthReview: (decisions: MonthReviewDecisions, today: DayKey) => RolloverRecord | undefined;

  // Dashboard
  /** Saves the dashboard layout; `null` goes back to the default layout. */
  setDashboardLayout: (layout: readonly WidgetPlacement[] | null) => void;

  // Data management and sample mode (ADR 009)
  exportData: () => string;
  importData: (json: string) => ValidationResult<Workspace>;
  /** Switches to a fresh sample workspace; own data is left untouched. False if the sample couldn't be built. */
  enterSampleMode: () => boolean;
  /** Deletes the sample and loads the own workspace again. */
  exitSampleMode: () => { ownWorkspaceEmpty: boolean };
  /** Erases the own workspace, device preferences, the backup and the saved Claude key. */
  eraseEverything: () => void;

  // --- Phase 1 additions go below, one marked section per package. ---
}

export interface AppState extends AppActions {
  data: Workspace;
}

const nowIso = () => clockNow().toISOString();
const today = () => dayKey(clockNow());

const omitKey = <T extends object, K extends keyof T>(value: T, key: K): Omit<T, K> => {
  const { [key]: _omitted, ...rest } = value;
  return rest;
};

const insertAt = <T>(list: readonly T[], index: number, value: T): T[] => [
  ...list.slice(0, index),
  value,
  ...list.slice(index),
];

/** Removes an id from a record's skills, remembering where it was. */
function untag<T extends { id: ID; skillIds: ID[] }>(records: readonly T[], skillId: ID, tags: SkillTag[]): T[] {
  return records.map((record) => {
    const index = record.skillIds.indexOf(skillId);
    if (index === -1) return record;
    tags.push({ id: record.id, index });
    return { ...record, skillIds: record.skillIds.filter((id) => id !== skillId) };
  });
}

function retag<T extends { id: ID; skillIds: ID[] }>(records: readonly T[], skillId: ID, tags: readonly SkillTag[]): T[] {
  const byId = new Map(tags.map((tag) => [tag.id, tag.index]));
  return records.map((record) => {
    const index = byId.get(record.id);
    if (index === undefined || record.skillIds.includes(skillId)) return record;
    return { ...record, skillIds: insertAt(record.skillIds, index, skillId) };
  });
}

function upsertLevel(levels: readonly SkillLevel[], level: SkillLevel): SkillLevel[] {
  return levels.some((entry) => entry.skillId === level.skillId)
    ? levels.map((entry) => (entry.skillId === level.skillId ? level : entry))
    : [...levels, level];
}

function unlinkKeyResults(items: PlanItem[], keyResultIds: ReadonlySet<ID>): PlanItem[] {
  return items.map((item) => (item.keyResultId && keyResultIds.has(item.keyResultId) ? omitKey(item, "keyResultId") : item));
}

/** True while `refreshWorkspace` reloads the workspace this tab already shows (a change from another tab). */
let refreshing = false;
/** The own workspace as it was when sample mode was entered (the only copy when storage is blocked). */
let ownWorkspaceCopy: Workspace | null = null;

/** Builds the sample, or reports why it couldn't (a dev bug the seed test guards against). */
function buildSample(): Workspace | undefined {
  try {
    return sampleWorkspace(clockNow());
  } catch (error) {
    console.error("[growloop] Couldn't build the sample workspace.", error);
    return undefined;
  }
}

function removeStoredItem(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    // Storage unavailable: nothing is stored.
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => {
      /**
       * Applies a pure transformation to the persisted data and records the
       * activity it implies (from plan item and note changes). Restores pass
       * `record: false`: putting something back isn't new activity.
       */
      const update = (recipe: (data: Workspace) => Workspace, { record = true }: { record?: boolean } = {}) =>
        set((state) => {
          const before = state.data;
          const after = recipe(before);
          if (after === before || !record) return { data: after };
          const at = clockNow();
          let activity = before.activity;
          if (after.planItems !== before.planItems) activity = syncActivity(activity, before.planItems, after.planItems, at);
          if (after.notes !== before.notes) activity = syncNoteActivity(activity, before.notes, after.notes, at);
          return { data: activity === after.activity ? after : { ...after, activity } };
        });

      const updateItems = (recipe: (items: PlanItem[]) => PlanItem[]) =>
        update((data) => ({ ...data, planItems: recipe(data.planItems) }));

      const updateItem = (id: ID, recipe: (item: PlanItem) => PlanItem) =>
        updateItems((items) => items.map((item) => (item.id === id ? recipe(item) : item)));

      const updateObjectiveById = (id: ID, recipe: (objective: Objective) => Objective) =>
        update((data) => ({ ...data, objectives: data.objectives.map((o) => (o.id === id ? recipe(o) : o)) }));

      const updateNoteById = (id: ID, recipe: (note: Note) => Note) =>
        update((data) => ({ ...data, notes: data.notes.map((note) => (note.id === id ? recipe(note) : note)) }));

      const persistApi = () => useAppStore.persist;

      return {
        // The first load (own or sample workspace) happens in `merge`, after mount.
        data: emptyWorkspace(),

        // --- Profile and skill levels -----------------------------------------------
        updateProfile: (patch) =>
          update((data) => {
            const profile: Profile = { ...data.profile, ...patch };
            for (const key of Object.keys(patch) as (keyof ProfilePatch)[]) {
              if (profile[key] === undefined) delete profile[key];
            }
            return { ...data, profile };
          }),
        setSkillLevel: (skillId, { current, target }) =>
          update((data) => ({
            ...data,
            profile: {
              ...data.profile,
              skillLevels: upsertLevel(data.profile.skillLevels, { skillId, current, target, updatedAt: nowIso() }),
            },
          })),

        // --- Skills -----------------------------------------------------------------
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
        deleteSkill: (id) => {
          const { data } = get();
          const index = data.skills.findIndex((s) => s.id === id);
          const skill = data.skills[index];
          if (!skill) return { ok: false, reason: "not-found" };
          if (skill.builtIn) return { ok: false, reason: "built-in" };
          if (data.objectives.some((o) => o.keyResults.some((kr) => kr.skillId === id))) {
            return { ok: false, reason: "used-by-key-result" };
          }
          const deleted: DeletedSkill = {
            skill,
            index,
            items: [],
            materials: [],
            notes: [],
            level: data.profile.skillLevels.find((level) => level.skillId === id),
          };
          update(
            (current) => ({
              ...current,
              skills: current.skills.filter((s) => s.id !== id),
              customMaterials: untag(current.customMaterials, id, deleted.materials),
              planItems: untag(current.planItems, id, deleted.items),
              notes: untag(current.notes, id, deleted.notes),
              profile: {
                ...current.profile,
                skillLevels: current.profile.skillLevels.filter((level) => level.skillId !== id),
              },
            }),
            { record: false },
          );
          return { ok: true, deleted, removedFromItems: deleted.items.length };
        },
        restoreSkill: (deleted) =>
          update(
            (data) => {
              if (data.skills.some((s) => s.id === deleted.skill.id)) return data;
              const id = deleted.skill.id;
              return {
                ...data,
                skills: insertAt(data.skills, Math.min(deleted.index, data.skills.length), deleted.skill),
                customMaterials: retag(data.customMaterials, id, deleted.materials),
                planItems: retag(data.planItems, id, deleted.items),
                notes: retag(data.notes, id, deleted.notes),
                profile: deleted.level
                  ? { ...data.profile, skillLevels: upsertLevel(data.profile.skillLevels, deleted.level) }
                  : data.profile,
              };
            },
            { record: false },
          ),

        // --- Custom materials -------------------------------------------------------
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

        // --- My Library -------------------------------------------------------------
        saveMaterial: (id) =>
          update((data) => {
            if (data.savedMaterialIds.includes(id) || !findMaterial(id, [])) return data;
            return { ...data, savedMaterialIds: [...data.savedMaterialIds, id] };
          }),
        unsaveMaterial: (id) =>
          update((data) =>
            data.savedMaterialIds.includes(id)
              ? { ...data, savedMaterialIds: data.savedMaterialIds.filter((saved) => saved !== id) }
              : data,
          ),

        // --- Objectives and key results ---------------------------------------------
        addObjective: (input) => {
          const objective = createObjective(input, nowIso());
          update((data) => ({ ...data, objectives: [...data.objectives, objective] }));
          return objective.id;
        },
        updateObjective: (id, { keyResults, ...patch }) =>
          update((data) => {
            const objective = data.objectives.find((o) => o.id === id);
            if (!objective) return data;
            const next: Objective = { ...objective, ...patch };
            if (patch.why !== undefined && !patch.why.trim()) delete next.why;
            // Only the quarter-end move widens the counting window; moving by hand starts it afresh.
            if (patch.quarter && patch.quarter !== objective.quarter) delete next.movedFrom;
            if (!keyResults) {
              return { ...data, objectives: data.objectives.map((o) => (o.id === id ? next : o)) };
            }
            next.keyResults = keyResults.map(createKeyResult);
            const kept = new Set(next.keyResults.map((kr) => kr.id));
            const removed = new Set(objective.keyResults.map((kr) => kr.id).filter((krId) => !kept.has(krId)));
            return {
              ...data,
              objectives: data.objectives.map((o) => (o.id === id ? next : o)),
              planItems: removed.size > 0 ? unlinkKeyResults(data.planItems, removed) : data.planItems,
            };
          }),
        deleteObjective: (id) => {
          const { data } = get();
          const index = data.objectives.findIndex((o) => o.id === id);
          const objective = data.objectives[index];
          if (!objective) return undefined;
          const keyResultIds = new Set(objective.keyResults.map((kr) => kr.id));
          const unlinked = data.planItems.flatMap((item) =>
            item.keyResultId && keyResultIds.has(item.keyResultId) ? [{ itemId: item.id, keyResultId: item.keyResultId }] : [],
          );
          update((current) => ({
            ...current,
            objectives: current.objectives.filter((o) => o.id !== id),
            planItems: unlinkKeyResults(current.planItems, keyResultIds),
          }));
          return { objective, index, unlinked };
        },
        restoreObjective: ({ objective, index, unlinked }) =>
          update(
            (data) => {
              if (data.objectives.some((o) => o.id === objective.id)) return data;
              const relink = new Map(unlinked.map((entry) => [entry.itemId, entry.keyResultId]));
              return {
                ...data,
                objectives: insertAt(data.objectives, Math.min(index, data.objectives.length), objective),
                planItems: data.planItems.map((item) => {
                  const keyResultId = relink.get(item.id);
                  return keyResultId && !item.keyResultId ? { ...item, keyResultId } : item;
                }),
              };
            },
            { record: false },
          ),
        addKeyResult: (objectiveId, input) => {
          const keyResult = createKeyResult(input);
          updateObjectiveById(objectiveId, (o) => ({ ...o, keyResults: [...o.keyResults, keyResult] }));
          return keyResult.id;
        },
        updateKeyResult: (objectiveId, keyResultId, patch) =>
          updateObjectiveById(objectiveId, (o) => ({
            ...o,
            keyResults: o.keyResults.map((kr) =>
              kr.id === keyResultId ? createKeyResult({ ...kr, ...patch, id: kr.id }) : kr,
            ),
          })),
        deleteKeyResult: (objectiveId, keyResultId) =>
          update((data) => ({
            ...data,
            objectives: data.objectives.map((o) =>
              o.id === objectiveId ? { ...o, keyResults: o.keyResults.filter((kr) => kr.id !== keyResultId) } : o,
            ),
            planItems: unlinkKeyResults(data.planItems, new Set([keyResultId])),
          })),
        archiveYear: (year) =>
          update((data) => {
            if (year >= yearOf(today()) || data.archivedYears.includes(year)) return data;
            const at = nowIso();
            return {
              ...data,
              objectives: data.objectives.map((objective) =>
                objective.status === "active" && yearOf(objective.quarter) === year
                  ? { ...objective, status: "closed", finalProgress: objectiveProgress(objective, data.planItems), closedAt: at }
                  : objective,
              ),
              archivedYears: [...data.archivedYears, year].sort((a, b) => a - b),
            };
          }),
        acceptPlan: ({ draft, source, answers }) => {
          const at = nowIso();
          const month = monthOf(today());
          const quarter = quarterOfDay(today());
          const { data } = get();

          const objectives = draft.objectives.map((objective) =>
            createObjective({ ...objective, source, keyResults: objective.keyResults }, at),
          );
          const targets = [
            ...new Set(objectives.flatMap((o) => o.keyResults.flatMap((kr) => (kr.type !== "count" && kr.materialId ? [kr.materialId] : [])))),
          ];
          const savedMaterialIds = targets.filter(
            (id) => !data.savedMaterialIds.includes(id) && findMaterial(id, data.customMaterials)?.curated === true,
          );

          // Current-quarter material KRs get a card now: the one already on this month's board, or a new Backlog card.
          const createdItems: PlanItem[] = [];
          const linkedItems: AcceptedPlan["linkedItems"] = [];
          let items = data.planItems;
          for (const objective of objectives.filter((o) => o.quarter === quarter)) {
            for (const keyResult of objective.keyResults) {
              if (keyResult.type === "count" || !keyResult.materialId) continue;
              const onBoard = items.find(
                (item) =>
                  item.materialId === keyResult.materialId &&
                  // A card already counting toward another key result keeps its link; the new KR gets its own card (WP2).
                  !item.keyResultId &&
                  (item.month === month || (item.status === "backlog" && compareMonths(item.month, month) <= 0)),
              );
              if (onBoard) {
                linkedItems.push({ itemId: onBoard.id, previousKeyResultId: onBoard.keyResultId });
                items = items.map((item) => (item.id === onBoard.id ? { ...item, keyResultId: keyResult.id } : item));
                continue;
              }
              const material = findMaterial(keyResult.materialId, data.customMaterials);
              if (!material) continue;
              const card = createPlanItem(material, month, {
                status: "backlog",
                order: nextOrder(items, month, "backlog"),
                keyResultId: keyResult.id,
                now: at,
              });
              createdItems.push(card);
              items = [...items, card];
            }
          }

          const previousProfile = data.profile;
          const goalText = answers.goal === "other" ? answers.goalText?.trim() : undefined;
          const profile: Profile = {
            ...omitKey(data.profile, "goalText"),
            role: answers.role,
            goal: answers.goal,
            ...(goalText ? { goalText } : {}),
            skillLevels: answers.skills.reduce(
              (levels, answer) => upsertLevel(levels, { ...answer, updatedAt: at }),
              data.profile.skillLevels,
            ),
          };

          update((current) => ({
            ...current,
            profile,
            objectives: [...current.objectives, ...objectives],
            savedMaterialIds: [...current.savedMaterialIds, ...savedMaterialIds],
            planItems: items,
          }));
          return {
            objectiveIds: objectives.map((o) => o.id),
            createdItemIds: createdItems.map((item) => item.id),
            linkedItems,
            savedMaterialIds,
            previousProfile,
          };
        },
        undoAcceptPlan: (accepted) =>
          update(
            (data) => {
              const objectiveIds = new Set(accepted.objectiveIds);
              const createdItemIds = new Set(accepted.createdItemIds);
              const previousLinks = new Map(accepted.linkedItems.map((link) => [link.itemId, link.previousKeyResultId]));
              const removedKeyResults = new Set(
                data.objectives.filter((o) => objectiveIds.has(o.id)).flatMap((o) => o.keyResults.map((kr) => kr.id)),
              );
              const unsave = new Set(accepted.savedMaterialIds);
              return {
                ...data,
                profile: accepted.previousProfile,
                objectives: data.objectives.filter((o) => !objectiveIds.has(o.id)),
                savedMaterialIds: data.savedMaterialIds.filter((id) => !unsave.has(id)),
                planItems: unlinkKeyResults(
                  data.planItems.filter((item) => !createdItemIds.has(item.id)),
                  removedKeyResults,
                ).map((item) => {
                  if (!previousLinks.has(item.id)) return item;
                  const previous = previousLinks.get(item.id);
                  return previous ? { ...item, keyResultId: previous } : omitKey(item, "keyResultId");
                }),
              };
            },
            { record: false },
          ),

        // --- Plan items -------------------------------------------------------------
        addPlanItem: (materialId, month, { autoLink = true, ...options } = {}) => {
          const { data } = get();
          const material = findMaterial(materialId, data.customMaterials);
          if (!material) return undefined;
          const status = options.status ?? "todo";
          const keyResultId =
            options.keyResultId ??
            (autoLink ? autoLinkKeyResult(materialId, data.objectives, data.planItems, data.archivedYears)?.id : undefined);
          const item = createPlanItem(material, month, {
            ...options,
            keyResultId,
            status,
            order: nextOrder(data.planItems, month, status),
            now: nowIso(),
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
        setPlanItemSkills: (id, skillIds) =>
          update((data) => ({
            ...data,
            planItems: data.planItems.map((item) => (item.id === id ? { ...item, skillIds: [...skillIds] } : item)),
            notes: data.notes.map((note) =>
              note.planItemId === id && note.kind !== "free" ? { ...note, skillIds: [...skillIds] } : note,
            ),
          })),
        movePlanItem: (id, target) => updateItems((items) => moveItem(items, id, target, nowIso())),
        removePlanItem: (id) => {
          const item = get().data.planItems.find((candidate) => candidate.id === id);
          if (!item) return undefined;
          updateItems((items) => items.filter((candidate) => candidate.id !== id));
          return { item };
        },
        restorePlanItem: ({ item }) =>
          update(
            (data) => (data.planItems.some((candidate) => candidate.id === item.id) ? data : { ...data, planItems: [...data.planItems, item] }),
            { record: false },
          ),
        setItemEarned: (id, earned) => updateItem(id, (item) => planItems.setEarned(item, earned, nowIso())),
        markSummaryNudged: (id) =>
          updateItem(id, (item) => (item.summaryNudgedAt ? item : { ...item, summaryNudgedAt: nowIso() })),

        // --- Card detail ------------------------------------------------------------
        addTask: (itemId, title) => updateItem(itemId, (item) => planItems.addTask(item, title)),
        renameTask: (itemId, taskId, title) => updateItem(itemId, (item) => planItems.renameTask(item, taskId, title)),
        setTaskDone: (itemId, taskId, done) =>
          updateItem(itemId, (item) => planItems.setTaskDone(item, taskId, done, nowIso())),
        deleteTask: (itemId, taskId) => updateItem(itemId, (item) => planItems.removeTask(item, taskId)),
        setReminder: (itemId, reminder) => updateItem(itemId, (item) => planItems.setReminder(item, reminder)),
        dismissReminder: (itemId) =>
          updateItem(itemId, (item) =>
            item.reminder ? planItems.setReminder(item, { ...item.reminder, dismissed: true }) : item,
          ),
        logTime: (itemId, log) => updateItem(itemId, (item) => planItems.addTimeLog(item, log)),
        deleteTimeLog: (itemId, logId) => updateItem(itemId, (item) => planItems.removeTimeLog(item, logId)),

        // --- Notes ------------------------------------------------------------------
        createNote: (input = {}) => {
          const note = createFreeNote(input, nowIso());
          update((data) => ({ ...data, notes: [...data.notes, note] }));
          return note.id;
        },
        updateNote: (id, patch) =>
          updateNoteById(id, (note) => {
            const allowed = note.kind === "free" ? patch : { body: patch.body };
            const changed = (Object.keys(allowed) as (keyof NotePatch)[]).some(
              (key) => allowed[key] !== undefined && JSON.stringify(allowed[key]) !== JSON.stringify(note[key]),
            );
            if (!changed) return note;
            return { ...note, ...omitUndefined(allowed), updatedAt: nowIso() };
          }),
        setCardNote: (itemId, kind, body, { refined = false } = {}) => {
          const { data } = get();
          const existing = findCardNote(data.notes, itemId, kind);
          if (existing) {
            if (existing.body === body && !refined) return existing.id;
            const at = nowIso();
            updateNoteById(existing.id, (note) => ({ ...note, body, updatedAt: at, ...(refined ? { refinedAt: at } : {}) }));
            return existing.id;
          }
          const item = data.planItems.find((candidate) => candidate.id === itemId);
          // No record until there is text (notebook.md).
          if (!item || !body.trim()) return undefined;
          const at = nowIso();
          const note = { ...createCardNote(item, kind, body, at), ...(refined ? { refinedAt: at } : {}) };
          const task = kind === "summary" ? planItems.summaryTask(item) : undefined;
          update((current) => ({
            ...current,
            notes: [...current.notes, note],
            // The first summary ticks "Summarize in my words" (C-2).
            planItems:
              task && !task.done
                ? current.planItems.map((candidate) =>
                    candidate.id === itemId ? planItems.setTaskDone(candidate, task.id, true, at) : candidate,
                  )
                : current.planItems,
          }));
          return note.id;
        },
        deleteNote: (id) => {
          const note = get().data.notes.find((candidate) => candidate.id === id);
          if (!note) return undefined;
          update((data) => ({ ...data, notes: data.notes.filter((candidate) => candidate.id !== id) }));
          return note;
        },
        restoreNote: (note) =>
          update(
            (data) => ({
              ...data,
              notes: data.notes.some((candidate) => candidate.id === note.id)
                ? data.notes.map((candidate) => (candidate.id === note.id ? note : candidate))
                : [...data.notes, note],
            }),
            { record: false },
          ),
        setNoteReview: (id, reviewAt) =>
          updateNoteById(id, (note) => (reviewAt ? { ...note, reviewAt } : omitKey(note, "reviewAt"))),
        markNoteReviewed: (id) =>
          updateNoteById(id, (note) => ({ ...omitKey(note, "reviewAt"), lastReviewedAt: nowIso() })),

        // --- Month-end review -------------------------------------------------------
        applyMonthReview: (decisions, day) => {
          const result = applyMonthReview(get().data, decisions, day, nowIso());
          if (!result) return undefined;
          update(() => result.data);
          return result.record;
        },

        // --- Dashboard --------------------------------------------------------------
        setDashboardLayout: (layout) =>
          update((data) => ({ ...data, dashboardLayout: layout && layout.map((placement) => ({ ...placement })) })),

        // --- Data management and sample mode ----------------------------------------
        exportData: () => serializeWorkspace(get().data, nowIso()),
        importData: (json) => {
          const result = parseImportedData(json);
          if (result.ok) set({ data: result.data });
          return result;
        },
        enterSampleMode: () => {
          const sample = buildSample();
          if (!sample) return false;
          // Kept in memory: with blocked storage it is the only copy of the own workspace.
          if (!isSampleModeOn()) ownWorkspaceCopy = get().data;
          // The flag first, then the key: the key always follows the flag (even if a write fails),
          // and writing the sample can never touch growloop:data.
          updateDevicePreferences({ sampleMode: true });
          persistApi().setOptions({ name: SAMPLE_STORAGE_KEY });
          set({ data: sample });
          return true;
        },
        exitSampleMode: () => {
          updateDevicePreferences({ sampleMode: undefined });
          removeStoredItem(SAMPLE_STORAGE_KEY);
          persistApi().setOptions({ name: STORAGE_KEY });
          // Synchronous with localStorage: the own workspace is loaded when this returns.
          void persistApi().rehydrate();
          // Storage blocked (or the own workspace was never written): the copy from entering is the real data.
          const copy = ownWorkspaceCopy;
          ownWorkspaceCopy = null;
          if (copy && !hasStoredItem(STORAGE_KEY)) set({ data: copy });
          return { ownWorkspaceEmpty: isEmptyWorkspace(get().data) };
        },
        eraseEverything: () => {
          forgetApiKey();
          clearDevicePreferences();
          clearWizardSession();
          removeStoredItem(SAMPLE_STORAGE_KEY);
          removeStoredItem(DEV_NOW_STORAGE_KEY);
          deleteBackup();
          ownWorkspaceCopy = null;
          persistApi().setOptions({ name: STORAGE_KEY });
          set({ data: emptyWorkspace() });
        },
      };
    },
    {
      name: STORAGE_KEY,
      version: APP_DATA_VERSION,
      storage: createWorkspaceStorage(),
      partialize: (state) => ({ data: state.data }),
      // Rehydrated explicitly after mount (see useStoreRehydration) so server and first client render match.
      skipHydration: true,
      // Loading never writes: merge's result is kept in memory until the user changes something.
      merge: (persisted, current) => {
        // The flag decides the key (rehydrateWorkspace and the sample-mode actions keep them in step).
        const key = activeStorageKey();
        const sample = key === SAMPLE_STORAGE_KEY;
        const fresh = () => ({ ...current, data: (sample && buildSample()) || emptyWorkspace() });
        const state = persisted as PersistedState | undefined;

        // Nothing saved yet: first run (or a sample that was never written, e.g. blocked storage).
        if (state === undefined) return refreshing ? current : fresh();

        const result = state.loadError ? undefined : validateWorkspace(state.data);
        if (result?.ok) return { ...current, data: result.data };

        // A refresh that can't be read keeps what this tab has; the stored value stays untouched.
        if (refreshing) return current;
        // The sample is disposable; the user's own data is kept so it is never silently lost.
        if (!sample) backUpRawSavedData();
        console.warn("[growloop] Saved data couldn't be loaded; starting fresh.", state.loadError ?? result?.error);
        return fresh();
      },
    },
  ),
);

/**
 * The persisted store's storage: the safe localStorage adapter, with migrations
 * applied on read. Migrating here (instead of zustand's `migrate`) means a load
 * never writes: zustand writes back after a migration, which would replace
 * data from a newer build, or data that failed to migrate, with a fresh workspace.
 */
function createWorkspaceStorage(): PersistStorage<PersistedState> {
  const base = createSafeStorage<PersistedState>();
  return {
    ...base,
    getItem(name) {
      // The safe adapter is synchronous.
      const stored = base.getItem(name) as StorageValue<PersistedState> | null;
      if (!stored) return null;
      const version = typeof stored.version === "number" ? stored.version : 0;
      if (version === APP_DATA_VERSION) return stored;
      const failed = (loadError: "invalid" | "newer") => ({ state: { data: undefined, loadError }, version: APP_DATA_VERSION });
      if (version > APP_DATA_VERSION) return failed("newer");
      try {
        return { state: { data: migrateAppData(stored.state?.data, version) }, version: APP_DATA_VERSION };
      } catch (error) {
        console.warn("[growloop] Could not migrate saved data.", error);
        return failed("invalid");
      }
    },
  };
}

/**
 * Reloads the workspace this tab shows after another tab changed it. Unlike a
 * first load, anything unreadable (a newer build, broken data) keeps this
 * tab's data and writes nothing.
 */
export function refreshWorkspace(): void {
  refreshing = true;
  try {
    // Synchronous with localStorage, so `merge` runs inside this call.
    void useAppStore.persist?.rehydrate();
  } finally {
    refreshing = false;
  }
}

function hasStoredItem(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

/** Drops keys whose value is undefined, so a patch never writes `undefined` into stored data. */
function omitUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

/** Keeps a copy of the raw saved value so a failed validation never silently destroys user data. */
function backUpRawSavedData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saveBackup(raw);
  } catch {
    // Storage unavailable: nothing to preserve.
  }
}
