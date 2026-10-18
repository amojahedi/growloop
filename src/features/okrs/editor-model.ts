import type { NewKeyResult } from "@/lib/domain/app-data";
import { yearOf } from "@/lib/domain/dates";
import { createId } from "@/lib/domain/ids";
import { MAX_OBJECTIVES_PER_YEAR, roomInYear } from "@/lib/domain/okrs";
import { PLAN_DRAFT_LIMITS, type DraftObjective, type PlanDraft } from "@/lib/domain/plan-draft";
import { keyResultAutoTitle } from "@/lib/domain/plan-drafter";
import type { ID, KeyResult, KeyResultType, Material, Objective, QuarterKey, Skill } from "@/lib/domain/types";

/**
 * The shared ObjectiveEditor's value: an objective being edited in the
 * wizard's review or on the OKR page. Keys are stable ids for React and for
 * the fields' DOM ids (so "Fix 2 things" can focus the first problem).
 *
 * The review keeps its draft in the wizard session as these values: they are
 * a superset of `DraftObjective`, so the session's `PlanDraft` type holds them.
 */

export interface KeyResultForm {
  key: string;
  /** A saved key result's id (keeps its card links). */
  id?: ID;
  /** "" until picked. */
  skillId: ID;
  type: KeyResultType;
  materialId?: ID;
  count?: number;
  title: string;
  /** False while the title follows the target ("Finish …"); true once the user typed their own. */
  titleEdited: boolean;
}

export interface ObjectiveForm {
  key: string;
  quarter: QuarterKey;
  title: string;
  why: string;
  keyResults: KeyResultForm[];
}

/** A plan under review, as kept in the wizard session. */
export interface ReviewDraft extends PlanDraft {
  objectives: ObjectiveForm[];
  /** The answers and scope it was drafted from; drafting again with the same ones keeps it. */
  basis?: string;
}

export interface EditorLookup {
  materials: ReadonlyMap<ID, Material>;
  skills: ReadonlyMap<ID, Skill>;
}

export const DEFAULT_COUNT = 3;

const newKey = () => createId();

export function autoTitle(keyResult: Pick<KeyResultForm, "type" | "materialId" | "count" | "skillId">, lookup: EditorLookup): string {
  return keyResultAutoTitle(keyResult, {
    material: (id) => lookup.materials.get(id),
    skillName: (id) => lookup.skills.get(id)?.name,
  });
}

/** Re-derives the title from the target unless the user wrote their own. */
const followTarget = (keyResult: KeyResultForm, lookup: EditorLookup): KeyResultForm =>
  keyResult.titleEdited ? keyResult : { ...keyResult, title: autoTitle(keyResult, lookup) };

/** Whether a material can be the target of a KR of this type on this skill. */
export function fitsKeyResult(material: Material, type: KeyResultType, skillId: ID): boolean {
  if (type === "count" || !material.skillIds.includes(skillId)) return false;
  return type === "certification" ? material.type === "certification" : material.type !== "certification";
}

export type KeyResultChange =
  | { skillId: ID }
  | { type: KeyResultType }
  | { materialId: ID | undefined }
  | { count: number }
  | { title: string }
  /** The title field was left empty: hand the title back to the target. */
  | { resetTitle: true };

/** Applies one edit, keeping the KR consistent: a new skill or type clears a target that no longer fits. */
export function changeKeyResult(keyResult: KeyResultForm, change: KeyResultChange, lookup: EditorLookup): KeyResultForm {
  if ("title" in change) return { ...keyResult, title: change.title, titleEdited: true };
  if ("resetTitle" in change) {
    return keyResult.title.trim() ? keyResult : followTarget({ ...keyResult, titleEdited: false }, lookup);
  }
  let next: KeyResultForm = { ...keyResult, ...change };
  if ("type" in change && change.type !== keyResult.type) {
    next = { ...next, materialId: undefined, count: change.type === "count" ? (keyResult.count ?? DEFAULT_COUNT) : undefined };
  }
  if ("skillId" in change && next.materialId) {
    const material = lookup.materials.get(next.materialId);
    if (!material || !fitsKeyResult(material, next.type, change.skillId)) next = { ...next, materialId: undefined };
  }
  return followTarget(next, lookup);
}

export function blankKeyResult(type: KeyResultType, skillId: ID = ""): KeyResultForm {
  return {
    key: newKey(),
    skillId,
    type,
    ...(type === "count" ? { count: DEFAULT_COUNT } : {}),
    title: "",
    titleEdited: false,
  };
}

/** A new objective: quarter fixed, two empty KR rows (a material and a count, like the quick draft). */
export function blankObjective(quarter: QuarterKey): ObjectiveForm {
  return { key: newKey(), quarter, title: "", why: "", keyResults: [blankKeyResult("material"), blankKeyResult("count")] };
}

/** A drafted objective (either engine), with titles following their targets until edited. */
export function formFromDraft(objective: DraftObjective): ObjectiveForm {
  return {
    key: newKey(),
    quarter: objective.quarter,
    title: objective.title,
    why: objective.why,
    keyResults: objective.keyResults.map((keyResult) => ({
      key: newKey(),
      skillId: keyResult.skillId,
      type: keyResult.type,
      ...(keyResult.materialId ? { materialId: keyResult.materialId } : {}),
      ...(keyResult.count !== undefined ? { count: keyResult.count } : {}),
      title: keyResult.title,
      titleEdited: false,
    })),
  };
}

/** A saved objective, for editing on the OKR page. A title that differs from the generated one counts as the user's own. */
export function formFromObjective(objective: Objective, lookup: EditorLookup): ObjectiveForm {
  return {
    key: objective.id,
    quarter: objective.quarter,
    title: objective.title,
    why: objective.why ?? "",
    keyResults: objective.keyResults.map((keyResult: KeyResult) => ({
      key: keyResult.id,
      id: keyResult.id,
      skillId: keyResult.skillId,
      type: keyResult.type,
      ...(keyResult.materialId ? { materialId: keyResult.materialId } : {}),
      ...(keyResult.count !== undefined ? { count: keyResult.count } : {}),
      title: keyResult.title,
      titleEdited: keyResult.title !== autoTitle(keyResult, lookup),
    })),
  };
}

/**
 * Reads a review draft back from the wizard session (sessionStorage, so
 * untrusted): fills in missing keys and drops anything malformed.
 */
export function reviewDraftFrom(plan: PlanDraft | undefined): ReviewDraft | undefined {
  if (!plan || !Array.isArray(plan.objectives)) return undefined;
  const text = (value: unknown) => (typeof value === "string" ? value : "");
  const objectives = plan.objectives.flatMap((raw): ObjectiveForm[] => {
    const objective = raw as Partial<ObjectiveForm> | null;
    if (!objective || typeof objective.quarter !== "string" || !Array.isArray(objective.keyResults)) return [];
    return [
      {
        key: text(objective.key) || newKey(),
        quarter: objective.quarter,
        title: text(objective.title),
        why: text(objective.why),
        keyResults: objective.keyResults.flatMap((rawKr): KeyResultForm[] => {
          const kr = rawKr as Partial<KeyResultForm> | null;
          if (!kr || (kr.type !== "material" && kr.type !== "count" && kr.type !== "certification")) return [];
          return [
            {
              key: text(kr.key) || newKey(),
              skillId: text(kr.skillId),
              type: kr.type,
              ...(typeof kr.materialId === "string" ? { materialId: kr.materialId } : {}),
              ...(typeof kr.count === "number" ? { count: kr.count } : {}),
              title: text(kr.title),
              titleEdited: kr.titleEdited === true,
            },
          ];
        }),
      },
    ];
  });
  const basis = (plan as ReviewDraft).basis;
  return { rationale: text(plan.rationale), objectives, ...(typeof basis === "string" ? { basis } : {}) };
}

const clean = (text: string, max: number) => text.trim().slice(0, max);

/** The draft `acceptPlan` saves: editor-only fields removed, empty KR titles generated. */
export function draftFromForms(rationale: string, forms: readonly ObjectiveForm[], lookup: EditorLookup): PlanDraft {
  return {
    rationale,
    objectives: forms.map((form) => ({
      quarter: form.quarter,
      title: clean(form.title, PLAN_DRAFT_LIMITS.objectiveTitle),
      why: clean(form.why, PLAN_DRAFT_LIMITS.why),
      keyResults: newKeyResultsFrom(form, lookup).map(({ id: _id, ...keyResult }) => keyResult),
    })),
  };
}

/** The key results to save for an editor value (saved ones keep their ids). */
export function newKeyResultsFrom(form: ObjectiveForm, lookup: EditorLookup): (NewKeyResult & { title: string })[] {
  return form.keyResults.map((keyResult) => ({
    ...(keyResult.id ? { id: keyResult.id } : {}),
    skillId: keyResult.skillId,
    type: keyResult.type,
    ...(keyResult.type === "count" ? { count: keyResult.count ?? DEFAULT_COUNT } : { materialId: keyResult.materialId }),
    title: clean(keyResult.title, PLAN_DRAFT_LIMITS.keyResultTitle) || autoTitle(keyResult, lookup),
  }));
}

// --- Validation ---------------------------------------------------------------------------

export interface Problem {
  /** DOM id of the field to focus. */
  fieldId: string;
  message: string;
}

export const fieldIds = {
  title: (form: Pick<ObjectiveForm, "key">) => `objective-${form.key}-title`,
  why: (form: Pick<ObjectiveForm, "key">) => `objective-${form.key}-why`,
  menu: (form: Pick<ObjectiveForm, "key">) => `objective-${form.key}-menu`,
  addKeyResult: (form: Pick<ObjectiveForm, "key">) => `objective-${form.key}-add-kr`,
  skill: (form: Pick<ObjectiveForm, "key">, kr: Pick<KeyResultForm, "key">) => `objective-${form.key}-kr-${kr.key}-skill`,
  target: (form: Pick<ObjectiveForm, "key">, kr: Pick<KeyResultForm, "key">) => `objective-${form.key}-kr-${kr.key}-target`,
  krTitle: (form: Pick<ObjectiveForm, "key">, kr: Pick<KeyResultForm, "key">) => `objective-${form.key}-kr-${kr.key}-title`,
};

/** Problems inside one objective: a title, and a skill and a target for every key result. */
export function objectiveProblems(form: ObjectiveForm, lookup: EditorLookup): Problem[] {
  const problems: Problem[] = [];
  if (!form.title.trim()) problems.push({ fieldId: fieldIds.title(form), message: "Give it a title." });
  for (const keyResult of form.keyResults) {
    if (!keyResult.skillId) problems.push({ fieldId: fieldIds.skill(form, keyResult), message: "Pick a skill." });
    if (keyResult.type === "count") continue;
    const material = keyResult.materialId ? lookup.materials.get(keyResult.materialId) : undefined;
    const fits = material !== undefined && (keyResult.type === "certification" ? material.type === "certification" : material.type !== "certification");
    if (!fits) {
      problems.push({
        fieldId: fieldIds.target(form, keyResult),
        message: keyResult.type === "certification" ? "Pick a certification." : "Pick a material.",
      });
    }
  }
  return problems;
}

/**
 * "2027 already has 4 objectives.": objectives that would take a year past
 * the cap, latest first. `saved` are the objectives already stored (minus the
 * ones being edited).
 */
export function yearCapProblems(forms: readonly ObjectiveForm[], saved: readonly Objective[]): Problem[] {
  const room = new Map<number, number>();
  const problems: Problem[] = [];
  const ordered = [...forms].sort((a, b) => (a.quarter < b.quarter ? -1 : a.quarter > b.quarter ? 1 : 0));
  for (const form of ordered) {
    const year = yearOf(form.quarter);
    const left = room.get(year) ?? roomInYear(saved, year);
    if (left <= 0) {
      problems.push({ fieldId: fieldIds.menu(form), message: `${year} already has ${MAX_OBJECTIVES_PER_YEAR} objectives.` });
    }
    room.set(year, left - 1);
  }
  return problems;
}

/** Every problem across several objectives, in reading order (column by column, top to bottom). */
export function allProblems(forms: readonly ObjectiveForm[], saved: readonly Objective[], lookup: EditorLookup): Problem[] {
  const cap = yearCapProblems(forms, saved);
  const ordered = [...forms].sort((a, b) => (a.quarter < b.quarter ? -1 : a.quarter > b.quarter ? 1 : 0));
  return ordered.flatMap((form) => [
    ...cap.filter((problem) => problem.fieldId === fieldIds.menu(form)),
    ...objectiveProblems(form, lookup),
  ]);
}

export const fixLabel = (count: number) => `Fix ${count} ${count === 1 ? "thing" : "things"} to accept`;
