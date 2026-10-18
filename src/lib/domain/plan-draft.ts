import type { GoalId, ID, KeyResultType, Material, PlanItem, QuarterKey, RoleId, SkillLevelValue } from "./types";

/**
 * The OKR wizard's shared contract (docs/product/specs/okrs-and-wizard.md):
 * the answers both drafting engines read and the `PlanDraft` both produce.
 * Claude's draft (src/lib/ai) and the quick draft (plan-drafter.ts) pass the
 * same repair step and land on the same review, then `acceptPlan` saves them.
 */

export const PLAN_DRAFT_LIMITS = {
  rationale: 200,
  objectiveTitle: 70,
  why: 120,
  keyResultTitle: 80,
  goalText: 80,
  /** Pasted LinkedIn or CV text, used once by Claude and never saved. */
  context: 6000,
  candidatesPerSkill: 12,
  minSkills: 2,
  maxSkills: 4,
} as const;

export interface DraftKeyResult {
  /** One of the focus skills. */
  skillId: ID;
  type: KeyResultType;
  /** material / certification: a catalog or library id from the candidates. */
  materialId?: ID;
  /** count: 1–10. */
  count?: number;
  title: string;
}

export interface DraftObjective {
  /** Must be in the wizard's scope. */
  quarter: QuarterKey;
  title: string;
  why: string;
  /** 2–3. */
  keyResults: DraftKeyResult[];
}

export interface PlanDraft {
  /** One line shown above the columns. */
  rationale: string;
  objectives: DraftObjective[];
}

export interface WizardSkillAnswer {
  skillId: ID;
  current: SkillLevelValue;
  target: SkillLevelValue;
}

/** Steps 1 and 2 of the wizard. Skills are in pick order. */
export interface WizardAnswers {
  role: RoleId;
  goal: GoalId;
  /** Only for goal "other". */
  goalText?: string;
  skills: WizardSkillAnswer[];
}

/** Which engine drafted a plan; saved as each objective's `source`. */
export type DraftSource = "claude" | "quick";

// --- Copy shared by both engines (the quick draft, Claude's prompt and the UI) ---------

export const ROLE_LABELS: Record<RoleId, string> = {
  aspiring_pm: "Aspiring PM",
  associate_pm: "Associate PM",
  pm: "Product Manager",
  senior_pm: "Senior PM",
  lead_pm: "Lead or Group PM",
};

export const GOAL_LABELS: Record<GoalId, string> = {
  promotion: "A promotion",
  move_into_product: "A move into product",
  stronger: "Stronger in my current role",
  leadership: "A step into leadership",
  other: "Something else",
};

export const LEVEL_LABELS: Record<SkillLevelValue, string> = {
  1: "New to it",
  2: "Learning",
  3: "Capable",
  4: "Strong",
  5: "Expert",
};

/** The goal in words, using the user's own text for "Something else". */
export function goalDescription(answers: Pick<WizardAnswers, "goal" | "goalText">): string {
  return answers.goal === "other" && answers.goalText?.trim() ? answers.goalText.trim() : GOAL_LABELS[answers.goal];
}

// --- Candidates ---------------------------------------------------------------------

/** Materials finished on the board (they are never proposed again). */
export function doneMaterialIds(items: readonly PlanItem[]): Set<ID> {
  return new Set(items.filter((item) => item.status === "done").map((item) => item.materialId));
}

/**
 * Materials a draft may target for one skill: tagged with it, in the catalog's
 * recommended order (curated first, then the user's own), excluding items
 * already done, up to `limit`.
 */
export function draftCandidates(
  materials: readonly Material[],
  skillId: ID,
  done: ReadonlySet<ID>,
  limit: number = PLAN_DRAFT_LIMITS.candidatesPerSkill,
): Material[] {
  const tagged = materials.filter((material) => material.skillIds.includes(skillId) && !done.has(material.id));
  return [...tagged.filter((m) => m.curated), ...tagged.filter((m) => !m.curated)].slice(0, limit);
}
