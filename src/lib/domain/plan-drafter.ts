import { objectivePhrasesFor } from "@/lib/catalog";
import { quarterOfDay, weeksLeftInQuarter, type DayKey } from "./dates";
import { activeObjectives, MAX_COUNT, MIN_COUNT } from "./okrs";
import {
  doneMaterialIds,
  PLAN_DRAFT_LIMITS,
  type DraftKeyResult,
  type DraftObjective,
  type PlanDraft,
  type WizardAnswers,
  type WizardSkillAnswer,
} from "./plan-draft";
import type { GoalId, ID, Material, MaterialLevel, Objective, PlanItem, QuarterKey, Skill } from "./types";
import { MATERIAL_LEVELS } from "./types";

/**
 * The quick draft (okrs-and-wizard.md §Quick draft): the rules engine that
 * drafts a plan from the wizard's answers when Claude isn't available. Pure
 * and deterministic: the same answers and data always give the same plan.
 * Its templates also regenerate titles in the shared repair step and in the
 * review's editor, so every engine's plan reads the same way.
 */

// --- Templates (shared with plan-repair.ts and the review) -----------------------------

/** Count KRs are capped at 2 in a quarter with fewer weeks than this left. */
export const SHORT_QUARTER_WEEKS = 8;

const WHY_BY_GOAL: Record<Exclude<GoalId, "other">, string> = {
  promotion: "Builds your case for promotion.",
  move_into_product: "Gets you ready for a product role.",
  stronger: "Makes you stronger in your current role.",
  leadership: "Prepares you to lead.",
};

/** How far a skill has to go (Goal − Now). */
export const skillGap = (answer: Pick<WizardSkillAnswer, "current" | "target">): number => answer.target - answer.current;

/** Step 1: biggest gap first, ties in pick order. */
export function orderSkillsByGap<T extends Pick<WizardSkillAnswer, "current" | "target">>(skills: readonly T[]): T[] {
  return skills
    .map((answer, index) => ({ answer, index }))
    .sort((a, b) => skillGap(b.answer) - skillGap(a.answer) || a.index - b.index)
    .map(({ answer }) => answer);
}

/** Weeks of a quarter still ahead: the rest of the current quarter, or a whole quarter later on. */
export function weeksAhead(quarter: QuarterKey, today: DayKey): number {
  return quarter === quarterOfDay(today) ? weeksLeftInQuarter(today) : 13;
}

/** Step 6: N from the skill gap (1 → 2, 2 → 3, 3+ → 4), at most 2 when the quarter is nearly over. */
export function countForGap(gap: number, weeksLeft: number): number {
  const count = gap >= 3 ? 4 : gap === 2 ? 3 : 2;
  return weeksLeft < SHORT_QUARTER_WEEKS ? Math.min(count, 2) : count;
}

export const clampCount = (count: number): number => Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(count)));

const truncate = (text: string, max: number) => (text.length <= max ? text : text.slice(0, max).trimEnd());

/** Step 3: phrase A, phrase B, then "Keep growing in {Skill}". Custom skills use generic phrases. */
export function objectiveTitle(skill: Pick<Skill, "id" | "name">, occurrence: number): string {
  const [first, second] = objectivePhrasesFor(skill.id) ?? [`Get stronger at ${skill.name}`, `Go deeper in ${skill.name}`];
  const title = occurrence <= 1 ? first : occurrence === 2 ? second : `Keep growing in ${skill.name}`;
  return truncate(title, PLAN_DRAFT_LIMITS.objectiveTitle);
}

/** Lower-cases the first letter of an ordinary word ("Lead a team" → "lead a team"), leaving acronyms ("AWS"). */
function inSentence(text: string): string {
  return /^[A-Z][a-z]/.test(text) ? text[0].toLowerCase() + text.slice(1) : text;
}

/** Step 4: one line linking the objective to the user's goal. */
export function whyLine(answers: Pick<WizardAnswers, "goal" | "goalText">): string {
  if (answers.goal !== "other") return WHY_BY_GOAL[answers.goal];
  const text = truncate(answers.goalText?.trim() ?? "", 60).replace(/[.!?\s]+$/, "");
  return text ? `Moves you toward ${inSentence(text)}.` : "Moves you toward your goal.";
}

/** A material's title up to its first colon ("Inspired: How to…" → "Inspired"). */
export function shortTitle(title: string): string {
  return title.split(":")[0].trim() || title.trim();
}

export const materialKeyResultTitle = (material: Pick<Material, "title">): string =>
  truncate(`Finish ${shortTitle(material.title)}`, PLAN_DRAFT_LIMITS.keyResultTitle);

export const certificationKeyResultTitle = (material: Pick<Material, "title">): string =>
  truncate(`Earn ${shortTitle(material.title)}`, PLAN_DRAFT_LIMITS.keyResultTitle);

export const countKeyResultTitle = (count: number, skillName: string): string =>
  truncate(`Complete ${count} ${skillName} ${count === 1 ? "item" : "items"}`, PLAN_DRAFT_LIMITS.keyResultTitle);

/**
 * The title a key result gets from its target: "Finish {title}", "Earn
 * {title}" or "Complete {N} {Skill} items". Empty while the target is missing.
 */
export function keyResultAutoTitle(
  keyResult: Pick<DraftKeyResult, "type" | "materialId" | "count" | "skillId">,
  lookup: { material: (id: ID) => Pick<Material, "title"> | undefined; skillName: (id: ID) => string | undefined },
): string {
  if (keyResult.type === "count") {
    const name = lookup.skillName(keyResult.skillId);
    return name && keyResult.count ? countKeyResultTitle(keyResult.count, name) : "";
  }
  const material = keyResult.materialId ? lookup.material(keyResult.materialId) : undefined;
  if (!material) return "";
  return keyResult.type === "certification" ? certificationKeyResultTitle(material) : materialKeyResultTitle(material);
}

/** Step 8: "Biggest gaps first: {Skill A}, then {Skill B}." (up to three skills). */
export function rationaleLine(skillNames: readonly string[]): string {
  const names = [...new Set(skillNames)].slice(0, 3);
  if (names.length === 0) return "";
  if (names.length === 1) return `Biggest gap first: ${names[0]}.`;
  const line = `Biggest gaps first: ${names.slice(0, -1).join(", ")}, then ${names.at(-1)}.`;
  return truncate(line, PLAN_DRAFT_LIMITS.rationale);
}

// --- Material choice (step 5) ---------------------------------------------------------

/** Materials that active objectives already target: a draft doesn't target them again. */
export function reservedMaterialIds(objectives: readonly Objective[]): Set<ID> {
  return new Set(
    activeObjectives(objectives).flatMap((objective) =>
      objective.keyResults.flatMap((keyResult) => (keyResult.type !== "count" && keyResult.materialId ? [keyResult.materialId] : [])),
    ),
  );
}

/** Level for a skill's first objective from its Now level: 1–2 beginner, 3 intermediate, 4–5 advanced. */
export function levelIndexFromNow(current: number): number {
  return current <= 2 ? 0 : current === 3 ? 1 : 2;
}

const levelIndex = (level: MaterialLevel) => MATERIAL_LEVELS.indexOf(level);
const PREFERRED_TYPES = new Set(["book", "course"]);

/**
 * The material for a skill's material KR: in the catalog's recommended order
 * (curated first, then the user's own), the first item whose first skill is
 * this skill, a book or course (any other non-certification type if there is
 * none), unused in the draft and not done, at the wanted level or the nearest one.
 */
export function pickMaterial({
  skillId,
  level,
  materials,
  exclude,
}: {
  skillId: ID;
  /** Index into MATERIAL_LEVELS (0 beginner … 2 advanced). */
  level: number;
  materials: readonly Material[];
  /** Materials already used by the draft or already done. */
  exclude: ReadonlySet<ID>;
}): Material | undefined {
  const ordered = [...materials.filter((m) => m.curated), ...materials.filter((m) => !m.curated)];
  const pool = ordered.filter((m) => m.skillIds[0] === skillId && m.type !== "certification" && !exclude.has(m.id));
  const preferred = pool.filter((m) => PREFERRED_TYPES.has(m.type));
  const candidates = preferred.length > 0 ? preferred : pool;
  let best: Material | undefined;
  let bestDistance = Infinity;
  for (const material of candidates) {
    const distance = Math.abs(levelIndex(material.level) - level);
    // Strictly closer only: ties keep the earlier item in the recommended order.
    if (distance < bestDistance) {
      best = material;
      bestDistance = distance;
    }
  }
  return best;
}

// --- The quick draft -------------------------------------------------------------------

export interface QuickDraftInput {
  answers: WizardAnswers;
  /** The wizard's quarters (okrs.ts `wizardScope`), earliest first. */
  scope: readonly QuarterKey[];
  today: DayKey;
  /** For skill names. */
  skills: readonly Skill[];
  /** Catalog plus the user's own materials, in recommended order. */
  materials: readonly Material[];
  /** Plan items; finished materials are never proposed. */
  items: readonly PlanItem[];
  /** Saved objectives; materials active ones target are not proposed again. */
  objectives?: readonly Objective[];
}

export function quickDraft({ answers, scope, today, skills, materials, items, objectives: saved = [] }: QuickDraftInput): PlanDraft {
  const ordered = orderSkillsByGap(answers.skills);
  if (ordered.length === 0) return { rationale: "", objectives: [] };
  const names = new Map(skills.map((skill) => [skill.id, skill.name]));
  const nameOf = (id: ID) => names.get(id) ?? id;
  const exclude = new Set([...doneMaterialIds(items), ...reservedMaterialIds(saved)]);
  const occurrences = new Map<ID, number>();

  const objectives = scope.map((quarter, index): DraftObjective => {
    // Step 2: quarter i gets skill S[i mod |S|].
    const answer = ordered[index % ordered.length];
    const skillId = answer.skillId;
    const occurrence = (occurrences.get(skillId) ?? 0) + 1;
    occurrences.set(skillId, occurrence);
    const name = nameOf(skillId);

    // Step 5: one level higher on each later occurrence of the skill.
    const level = Math.min(levelIndexFromNow(answer.current) + occurrence - 1, MATERIAL_LEVELS.length - 1);
    const material = pickMaterial({ skillId, level, materials, exclude });

    // Step 6.
    const weeks = weeksAhead(quarter, today);
    const count = countForGap(skillGap(answer), weeks);
    const counted: DraftKeyResult = { skillId, type: "count", count, title: countKeyResultTitle(count, name) };

    let keyResults: DraftKeyResult[];
    if (material) {
      exclude.add(material.id);
      keyResults = [{ skillId, type: "material", materialId: material.id, title: materialKeyResultTitle(material) }, counted];
    } else {
      // No material for the skill (e.g. a custom skill): its count KR, plus a count KR on the next
      // skill by gap, so no two KRs count the same items.
      const other = ordered.find((candidate) => candidate.skillId !== skillId)!;
      const otherCount = countForGap(skillGap(other), weeks);
      keyResults = [
        counted,
        { skillId: other.skillId, type: "count", count: otherCount, title: countKeyResultTitle(otherCount, nameOf(other.skillId)) },
      ];
    }

    return {
      quarter,
      title: objectiveTitle({ id: skillId, name }, occurrence),
      why: whyLine(answers),
      keyResults,
    };
  });

  const used = objectives.map((objective) => nameOf(objective.keyResults[0].skillId));
  return { rationale: rationaleLine(used), objectives };
}
