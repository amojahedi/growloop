import { columnItems } from "@/lib/domain/board";
import { compareQuarters, monthOf, quarterOfDay, toDayKey, yearOf, type DayKey } from "@/lib/domain/dates";
import { listedNotes } from "@/lib/domain/notes";
import { objectiveProgress } from "@/lib/domain/okrs";
import type { DeletedSkill } from "@/lib/store/app-store";
import {
  SKILL_COLORS,
  type BoardStatus,
  type ID,
  type Objective,
  type PlanItem,
  type QuarterKey,
  type Skill,
  type SkillColor,
  type SkillLevelValue,
  type Workspace,
} from "@/lib/domain/types";

/**
 * Pure rules behind the skill sheet and Settings → Skills (docs/product/specs/skills.md).
 */

/** The radar needs at least 3 axes; more than 16 stops being readable. */
export const MIN_VISIBLE_SKILLS = 3;
export const MAX_VISIBLE_SKILLS = 16;
export const MAX_SKILL_NAME_LENGTH = 40;

/** The wizard's defaults when a skill has no level yet (okrs-and-wizard.md, step 2). */
export const DEFAULT_LEVELS: { current: SkillLevelValue; target: SkillLevelValue } = { current: 2, target: 4 };

export const PICK_A_DIFFERENT_NAME = "Pick a different name.";
export const KEEP_THREE_VISIBLE = "Keep at least 3 visible so the radar works.";
export const USED_BY_KEY_RESULT = "Used by a key result. Hide it, or change that key result first.";

export const visibleCount = (skills: readonly Skill[]): number => skills.filter((skill) => !skill.hidden).length;

/** Hiding one more would leave fewer than 3 on the radar. */
export const canHideMore = (skills: readonly Skill[]): boolean => visibleCount(skills) > MIN_VISIBLE_SKILLS;

/** Room for one more visible skill (adding or showing one). */
export const canShowMore = (skills: readonly Skill[]): boolean => visibleCount(skills) < MAX_VISIBLE_SKILLS;

/**
 * The trimmed name if it can be used, or undefined: empty names and names
 * another skill already has (case-insensitive, hidden skills included) are rejected.
 */
export function validSkillName(name: string, skills: readonly Skill[], exceptId?: ID): string | undefined {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > MAX_SKILL_NAME_LENGTH) return undefined;
  const key = trimmed.toLocaleLowerCase();
  const taken = skills.some((skill) => skill.id !== exceptId && skill.name.trim().toLocaleLowerCase() === key);
  return taken ? undefined : trimmed;
}

/** Deleting this skill would leave fewer than 3 on the radar (hidden skills can always go). */
export const deleteWouldBreakMinimum = (skill: Skill, skills: readonly Skill[]): boolean =>
  !skill.hidden && !canHideMore(skills);

/**
 * A name no other skill has: the name itself, or "Name 2", "Name 3"… (kept
 * within 40 characters). Used when undoing a delete after the name was reused.
 */
export function uniqueSkillName(name: string, skills: readonly Skill[], exceptId?: ID): string {
  if (validSkillName(name, skills, exceptId)) return name.trim();
  for (let n = 2; ; n += 1) {
    const suffix = ` ${n}`;
    const candidate = `${name.trim().slice(0, MAX_SKILL_NAME_LENGTH - suffix.length).trimEnd()}${suffix}`;
    if (validSkillName(candidate, skills, exceptId)) return candidate;
  }
}

/**
 * What undoing a delete puts back, under the rules that hold now: hidden when
 * 16 skills are already visible, renamed when its name was taken meanwhile.
 */
export function restorableSkill(deleted: DeletedSkill, skills: readonly Skill[]): DeletedSkill {
  const { skill } = deleted;
  const name = uniqueSkillName(skill.name, skills, skill.id);
  const hidden = skill.hidden || !canShowMore(skills);
  if (name === skill.name && hidden === Boolean(skill.hidden)) return deleted;
  return { ...deleted, skill: { ...skill, name, hidden } };
}

/** The first skill color not in use yet (in token order), or the first color when all are taken. */
export function firstUnusedColor(skills: readonly Skill[]): SkillColor {
  const used = new Set(skills.map((skill) => skill.color));
  return SKILL_COLORS.find((color) => !used.has(color)) ?? SKILL_COLORS[0];
}

/** "sky" → "Sky", for swatch names read out to screen readers. */
export const colorName = (color: SkillColor): string => color.charAt(0).toUpperCase() + color.slice(1);

// --- Skill sheet ----------------------------------------------------------------------

export type ObjectiveMeasure =
  | { kind: "progress"; percent: number }
  /** Not started yet: shows its quarter instead of 0%. */
  | { kind: "quarter"; quarter: QuarterKey };

export interface SheetObjective {
  objective: Objective;
  year: number;
  measure: ObjectiveMeasure;
}

export interface SkillSheetSummary {
  /** Active and closed objectives in this year and next with a KR on the skill, in quarter order. */
  objectives: SheetObjective[];
  /** This month's cards and the rolling Backlog, tagged with the skill. */
  cards: PlanItem[];
  /** Done cards tagged with the skill, finished this calendar year. */
  finishedThisYear: number;
  /** Notes with text tagged with the skill. */
  noteCount: number;
}

/** Order on the sheet: what's moving first, then what's waiting, then what's done. */
const CARD_ORDER: readonly BoardStatus[] = ["in_progress", "todo", "backlog", "done"];

export function skillSheetSummary(
  data: Pick<Workspace, "objectives" | "planItems" | "notes">,
  skillId: ID,
  today: DayKey,
): SkillSheetSummary {
  const year = yearOf(today);
  const month = monthOf(today);
  const currentQuarter = quarterOfDay(today);

  const objectives = data.objectives
    .filter((objective) => {
      const objectiveYear = yearOf(objective.quarter);
      return (
        (objectiveYear === year || objectiveYear === year + 1) &&
        objective.keyResults.some((keyResult) => keyResult.skillId === skillId)
      );
    })
    .sort((a, b) => compareQuarters(a.quarter, b.quarter) || a.createdAt.localeCompare(b.createdAt))
    .map((objective): SheetObjective => {
      const upcoming = objective.status === "active" && compareQuarters(objective.quarter, currentQuarter) > 0;
      return {
        objective,
        year: yearOf(objective.quarter),
        measure: upcoming
          ? { kind: "quarter", quarter: objective.quarter }
          : { kind: "progress", percent: objectiveProgress(objective, data.planItems) },
      };
    });

  const tagged = data.planItems.filter((item) => item.skillIds.includes(skillId));
  const cards = CARD_ORDER.flatMap((status) => columnItems(tagged, month, status));
  const finishedThisYear = tagged.filter(
    (item) => item.status === "done" && item.completedAt !== undefined && yearOf(toDayKey(item.completedAt)) === year,
  ).length;
  const noteCount = listedNotes(data.notes).filter((note) => note.skillIds.includes(skillId)).length;

  return { objectives, cards, finishedThisYear, noteCount };
}
