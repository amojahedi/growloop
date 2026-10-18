import { yearOf, type DayKey } from "./dates";
import { MAX_KEY_RESULTS, MIN_KEY_RESULTS, roomInYear } from "./okrs";
import {
  doneMaterialIds,
  PLAN_DRAFT_LIMITS,
  type DraftKeyResult,
  type DraftObjective,
  type PlanDraft,
  type WizardAnswers,
} from "./plan-draft";
import {
  clampCount,
  countForGap,
  countKeyResultTitle,
  keyResultAutoTitle,
  levelIndexFromNow,
  materialKeyResultTitle,
  objectiveTitle,
  orderSkillsByGap,
  pickMaterial,
  rationaleLine,
  reservedMaterialIds,
  skillGap,
  weeksAhead,
  whyLine,
} from "./plan-drafter";
import type { ID, Material, Objective, PlanItem, QuarterKey, Skill } from "./types";

/**
 * The shared repair step (okrs-and-wizard.md §Repair before review). Both
 * engines' drafts pass through it before the review, so neither can produce
 * an unusable plan: whatever survives fits the scope, the yearly cap, the
 * focus skills and the library, with 2–3 key results per objective.
 */

export interface RepairContext {
  /** The wizard's quarters, earliest first. */
  scope: readonly QuarterKey[];
  /** Focus skills (pick order, with levels) and the goal, for sizing counts and regenerating text. */
  answers: WizardAnswers;
  /** For skill names. */
  skills: readonly Skill[];
  /** Catalog plus the user's own materials. */
  materials: readonly Material[];
  /** Objectives already saved (for the yearly cap, and materials active objectives already target). */
  objectives: readonly Objective[];
  /** Plan items: finished materials are never targeted again. */
  items: readonly PlanItem[];
  today: DayKey;
}

export type RepairResult = { ok: true; draft: PlanDraft } | { ok: false; reason: "empty" };

const truncate = (text: string, max: number) => (text.length <= max ? text : text.slice(0, max).trimEnd());

export function repairDraft(draft: PlanDraft, context: RepairContext): RepairResult {
  const { scope, answers, today } = context;
  const inScope = new Set(scope);
  const focus = new Map(answers.skills.map((answer) => [answer.skillId, answer]));
  const materials = new Map(context.materials.map((material) => [material.id, material]));
  const names = new Map(context.skills.map((skill) => [skill.id, skill.name]));
  const nameOf = (id: ID) => names.get(id) ?? id;
  const sizedCount = (skillId: ID, quarter: QuarterKey) =>
    countForGap(skillGap(focus.get(skillId) ?? { current: 2, target: 4 }), weeksAhead(quarter, today));
  const countFor = (skillId: ID, quarter: QuarterKey): DraftKeyResult => {
    const count = sizedCount(skillId, quarter);
    return { skillId, type: "count", count, title: countKeyResultTitle(count, nameOf(skillId)) };
  };

  // Materials no key result may take: finished ones, those active objectives already target, then those used in this draft.
  const used = new Set([...doneMaterialIds(context.items), ...reservedMaterialIds(context.objectives)]);
  const byGap = orderSkillsByGap(answers.skills).map((answer) => answer.skillId);
  const taken = new Set<QuarterKey>();
  const room = new Map<number, number>();
  const kept: DraftObjective[] = [];

  for (const objective of draft.objectives) {
    // Outside the scope, a second objective for a quarter, or over the year's cap.
    if (!inScope.has(objective.quarter) || taken.has(objective.quarter)) continue;
    const year = yearOf(objective.quarter);
    const left = room.get(year) ?? roomInYear(context.objectives, year);
    if (left <= 0) continue;

    const claimed = new Set<ID>();
    const keyResults: DraftKeyResult[] = [];
    const converted = new Set<DraftKeyResult>();
    for (const keyResult of objective.keyResults) {
      const repaired = repairKeyResult(keyResult, objective.quarter, claimed);
      if (!repaired) continue;
      if (keyResult.type !== "count" && repaired.type === "count") converted.add(repaired);
      keyResults.push(repaired);
    }
    // One count KR per skill (a second would count the same items twice), preferring one the draft asked for.
    const keeper = new Map<ID, DraftKeyResult>();
    for (const keyResult of keyResults) {
      if (keyResult.type !== "count") continue;
      const current = keeper.get(keyResult.skillId);
      if (!current || (converted.has(current) && !converted.has(keyResult))) keeper.set(keyResult.skillId, keyResult);
    }
    const unique = keyResults.filter((keyResult) => keyResult.type !== "count" || keeper.get(keyResult.skillId) === keyResult);
    // Nothing usable left: the objective has no skill to build on.
    if (unique.length === 0) continue;
    if (unique.length < MIN_KEY_RESULTS) {
      const filler = fillKeyResult(unique, objective.quarter, claimed);
      if (!filler) continue;
      unique.push(filler);
    }

    taken.add(objective.quarter);
    room.set(year, left - 1);
    const final = unique.slice(0, MAX_KEY_RESULTS);
    for (const keyResult of final) if (keyResult.materialId) used.add(keyResult.materialId);
    kept.push({ ...objective, keyResults: final });
  }

  if (kept.length === 0) return { ok: false, reason: "empty" };

  // Earliest quarter first, then regenerate anything left empty with the quick-draft templates.
  const order = new Map(scope.map((quarter, index) => [quarter, index]));
  kept.sort((a, b) => order.get(a.quarter)! - order.get(b.quarter)!);
  const occurrences = new Map<ID, number>();
  const lookup = { material: (id: ID) => materials.get(id), skillName: (id: ID) => names.get(id) };
  const objectives = kept.map((objective): DraftObjective => {
    const skillId = objective.keyResults[0].skillId;
    const occurrence = (occurrences.get(skillId) ?? 0) + 1;
    occurrences.set(skillId, occurrence);
    return {
      quarter: objective.quarter,
      title: truncate(objective.title.trim() || objectiveTitle({ id: skillId, name: nameOf(skillId) }, occurrence), PLAN_DRAFT_LIMITS.objectiveTitle),
      why: truncate(objective.why.trim() || whyLine(answers), PLAN_DRAFT_LIMITS.why),
      keyResults: objective.keyResults.map((keyResult) => ({
        ...keyResult,
        title: truncate(keyResult.title.trim() || keyResultAutoTitle(keyResult, lookup), PLAN_DRAFT_LIMITS.keyResultTitle),
      })),
    };
  });

  const rationale =
    draft.rationale.trim() || rationaleLine(objectives.map((objective) => nameOf(objective.keyResults[0].skillId)));
  return { ok: true, draft: { rationale: truncate(rationale, PLAN_DRAFT_LIMITS.rationale), objectives } };

  /** One key result made valid, or undefined when it has to go. `claimed` holds materials this objective has taken so far. */
  function repairKeyResult(keyResult: DraftKeyResult, quarter: QuarterKey, claimed: Set<ID>): DraftKeyResult | undefined {
    const { skillId, title } = keyResult;
    if (!focus.has(skillId)) return undefined;

    if (keyResult.type === "count") {
      const count = Number.isFinite(keyResult.count) ? clampCount(keyResult.count!) : sizedCount(skillId, quarter);
      // A changed count makes the old title wrong ("Complete 15 …"): regenerate it.
      return { skillId, type: "count", count, title: count === keyResult.count ? title : "" };
    }

    const material = keyResult.materialId ? materials.get(keyResult.materialId) : undefined;
    const available = material !== undefined && !used.has(material.id) && !claimed.has(material.id);
    const fits = available && material.skillIds.includes(skillId);
    if (keyResult.type === "certification") {
      // A certification KR must point at an unused, unfinished certification on its skill.
      if (!fits || material.type !== "certification") return undefined;
      claimed.add(material.id);
      return { skillId, type: "certification", materialId: material.id, title };
    }
    // A material KR with a bad, finished or already used target becomes a count KR on the same skill
    // (dropped later if the objective already counts that skill).
    if (!fits || material.type === "certification") return countFor(skillId, quarter);
    claimed.add(material.id);
    return { skillId, type: "material", materialId: material.id, title };
  }

  /**
   * A second key result for an objective left with one: a material on its
   * skill (as the quick draft picks it), else a count KR on its skill or, if
   * that is taken, on the next focus skill by gap. Undefined when nothing fits.
   */
  function fillKeyResult(keyResults: readonly DraftKeyResult[], quarter: QuarterKey, claimed: Set<ID>): DraftKeyResult | undefined {
    const skillId = keyResults[0].skillId;
    const counted = new Set(keyResults.filter((keyResult) => keyResult.type === "count").map((keyResult) => keyResult.skillId));
    if (!counted.has(skillId)) return countFor(skillId, quarter);
    const answer = focus.get(skillId);
    const material = pickMaterial({
      skillId,
      level: levelIndexFromNow(answer?.current ?? 2),
      materials: context.materials,
      exclude: new Set([...used, ...claimed]),
    });
    if (material) {
      claimed.add(material.id);
      return { skillId, type: "material", materialId: material.id, title: materialKeyResultTitle(material) };
    }
    const other = byGap.find((candidate) => !counted.has(candidate));
    return other ? countFor(other, quarter) : undefined;
  }
}
