import { quarterOfDay, weeksLeftInQuarter, type DayKey } from "@/lib/domain/dates";
import { doneMaterialIds, draftCandidates, type WizardAnswers } from "@/lib/domain/plan-draft";
import type { Material, PlanItem, QuarterKey, Skill } from "@/lib/domain/types";
import type { DraftPlanRequest } from "./schemas";

/**
 * Builds the draft-plan request from the wizard's answers: only what the
 * feature needs (settings spec §What is sent), never the whole workspace.
 */
export function buildDraftPlanRequest({
  answers,
  scope,
  today,
  skills,
  materials,
  items,
  context,
}: {
  answers: WizardAnswers;
  /** The wizard's quarters (okrs.ts `wizardScope`). */
  scope: readonly QuarterKey[];
  today: DayKey;
  skills: readonly Skill[];
  /** Catalog plus the user's own materials. */
  materials: readonly Material[];
  items: readonly PlanItem[];
  /** Pasted LinkedIn or CV text, used once. */
  context?: string;
}): DraftPlanRequest {
  const names = new Map(skills.map((skill) => [skill.id, skill.name]));
  const done = doneMaterialIds(items);
  const trimmedContext = context?.trim();
  const goalText = answers.goal === "other" ? answers.goalText?.trim() : undefined;

  return {
    role: answers.role,
    goal: answers.goal,
    ...(goalText ? { goalText } : {}),
    skills: answers.skills.map((answer) => ({
      id: answer.skillId,
      name: names.get(answer.skillId) ?? answer.skillId,
      current: answer.current,
      target: answer.target,
    })),
    quarters: [...scope],
    currentQuarter: quarterOfDay(today),
    weeksLeftInCurrentQuarter: Math.round(weeksLeftInQuarter(today) * 10) / 10,
    candidates: answers.skills.flatMap(({ skillId }) =>
      draftCandidates(materials, skillId, done).map((material) => ({
        id: material.id,
        skillId,
        title: material.title,
        type: material.type,
        level: material.level,
        ...(material.estimatedHours ? { hours: material.estimatedHours } : {}),
      })),
    ),
    ...(trimmedContext ? { context: trimmedContext } : {}),
  };
}
