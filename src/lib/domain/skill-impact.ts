import { monthOf } from "./dates";
import type { ID, MonthKey, PlanItem, Skill, SkillColor, Workspace } from "./types";

/**
 * How strongly a material (or a plan item made from one) builds each skill (S-4).
 *
 *   weight = role × effort
 *   role   = 1 for the first tagged skill (primary), 0.5 for every other tagged skill
 *   effort = 0.5 under 1h · 1 for 1–5h · 1.5 for 5–20h · 2 for 20h or more · 1 when unknown
 *
 * This is the only place the formula lives; the radar, previews and impact bars all use it.
 */

/** Anything with skill tags and an effort estimate: a material or a plan item. */
export interface ImpactSource {
  skillIds: readonly ID[];
  estimatedHours?: number;
}

export interface SkillWeight {
  skillId: ID;
  weight: number;
}

const PRIMARY_WEIGHT = 1;
const SECONDARY_WEIGHT = 0.5;

export function effortFactor(estimatedHours: number | undefined): number {
  if (estimatedHours === undefined) return 1;
  if (estimatedHours < 1) return 0.5;
  if (estimatedHours < 5) return 1;
  if (estimatedHours < 20) return 1.5;
  return 2;
}

/** Weight per tagged skill, primary first. Skills that no longer exist are left out. */
export function skillImpact(source: ImpactSource, skills: readonly Skill[]): SkillWeight[] {
  const known = new Set(skills.map((skill) => skill.id));
  const effort = effortFactor(source.estimatedHours);
  return [...new Set(source.skillIds)]
    .map((skillId, index) => ({ skillId, weight: (index === 0 ? PRIMARY_WEIGHT : SECONDARY_WEIGHT) * effort }))
    .filter(({ skillId }) => known.has(skillId));
}

/** The largest weight a single skill can get from one material, for scaling impact bars. */
export const MAX_SKILL_WEIGHT = PRIMARY_WEIGHT * effortFactor(Number.POSITIVE_INFINITY);

export interface RadarAxisValue {
  skillId: ID;
  name: string;
  color: SkillColor;
  /** Impact of items completed in the month. */
  completed: number;
  /** `completed` plus the impact of items still to do or in progress this month. */
  projected: number;
}

const isCompletedIn = (item: PlanItem, month: MonthKey) =>
  item.status === "done" && item.completedAt !== undefined && monthOf(item.completedAt) === month;

const isOpenIn = (item: PlanItem, month: MonthKey) =>
  item.month === month && (item.status === "todo" || item.status === "in_progress");

/**
 * Completed and projected skill impact for a month, one entry per visible skill
 * (so a radar keeps stable axes). Backlog items are not committed, so they don't count.
 */
export function radarSeries(workspace: Pick<Workspace, "planItems" | "skills">, month: MonthKey): RadarAxisValue[] {
  const totals = (items: readonly PlanItem[]) => {
    const sums = new Map<ID, number>();
    for (const item of items) {
      for (const { skillId, weight } of skillImpact(item, workspace.skills)) {
        sums.set(skillId, (sums.get(skillId) ?? 0) + weight);
      }
    }
    return sums;
  };
  const completed = totals(workspace.planItems.filter((item) => isCompletedIn(item, month)));
  const open = totals(workspace.planItems.filter((item) => isOpenIn(item, month)));

  return workspace.skills
    .filter((skill) => !skill.hidden)
    .map((skill) => {
      const done = completed.get(skill.id) ?? 0;
      return {
        skillId: skill.id,
        name: skill.name,
        color: skill.color,
        completed: done,
        projected: done + (open.get(skill.id) ?? 0),
      };
    });
}
