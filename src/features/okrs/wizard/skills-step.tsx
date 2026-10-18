"use client";

import { Loader2Icon, SparklesIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LEVEL_LABELS, PLAN_DRAFT_LIMITS, type WizardSkillAnswer } from "@/lib/domain/plan-draft";
import { SKILL_LEVEL_VALUES, type ID, type Skill, type SkillLevel, type SkillLevelValue } from "@/lib/domain/types";
import { FieldMessage, SegmentedControl } from "../controls/choice-controls";
import { SkillCheckboxChip, SkillDot } from "../controls/skill-controls";
import { StepHeading } from "./step-heading";

const LEVEL_OPTIONS = SKILL_LEVEL_VALUES.map((value) => ({ value, label: String(value), srLabel: `${value}, ${LEVEL_LABELS[value]}` }));
const LEVEL_LEGEND = SKILL_LEVEL_VALUES.map((value) => `${value} ${LEVEL_LABELS[value]}`).join(" · ");
export const DEFAULT_LEVELS = { current: 2, target: 4 } as const satisfies Pick<WizardSkillAnswer, "current" | "target">;

export const skillsComplete = (skills: readonly WizardSkillAnswer[]): boolean =>
  skills.length >= PLAN_DRAFT_LIMITS.minSkills &&
  skills.length <= PLAN_DRAFT_LIMITS.maxSkills &&
  skills.every((answer) => answer.target > answer.current);

/** Step 2 of 2, "What do you want to grow?": 2–4 focus skills, each with a Now and a Goal level. */
export function SkillsStep({
  skills,
  value,
  savedLevels,
  onChange,
  draftLabel,
  checking,
  onDraft,
  onBack,
  focusHeading,
}: {
  /** Visible skills, in display order. */
  skills: readonly Skill[];
  /** Picked skills, in pick order. */
  value: readonly WizardSkillAnswer[];
  /** Levels saved in the profile, used when a skill is picked. */
  savedLevels: readonly SkillLevel[];
  onChange: (skills: WizardSkillAnswer[]) => void;
  /** "Draft with Claude" or "Draft my plan". */
  draftLabel: string;
  /** Claude's status is still being checked: the button shows a spinner (a click waits for it). */
  checking: boolean;
  onDraft: () => void;
  onBack: () => void;
  focusHeading: boolean;
}) {
  const picked = new Set(value.map((answer) => answer.skillId));
  const full = value.length >= PLAN_DRAFT_LIMITS.maxSkills;
  const names = new Map(skills.map((skill) => [skill.id, skill]));

  const toggle = (skillId: ID, checked: boolean) => {
    if (!checked) return onChange(value.filter((answer) => answer.skillId !== skillId));
    if (full || picked.has(skillId)) return;
    const saved = savedLevels.find((level) => level.skillId === skillId);
    onChange([...value, { skillId, current: saved?.current ?? DEFAULT_LEVELS.current, target: saved?.target ?? DEFAULT_LEVELS.target }]);
  };
  const setLevel = (skillId: ID, patch: Partial<Pick<WizardSkillAnswer, "current" | "target">>) =>
    onChange(value.map((answer) => (answer.skillId === skillId ? { ...answer, ...patch } : answer)));

  const hint = value.length === 1 ? "Pick at least one more." : full ? "Four is plenty for a year." : "";

  return (
    <form
      className="flex max-w-2xl flex-col gap-7"
      onSubmit={(event) => {
        event.preventDefault();
        if (skillsComplete(value)) onDraft();
      }}
    >
      <StepHeading step={2} title="What do you want to grow?" focusOnMount={focusHeading} />

      <fieldset className="flex flex-col gap-2.5" aria-describedby="wizard-skills-hint">
        <legend className="mb-2.5 text-sm font-semibold">Pick 2 to 4 skills</legend>
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <SkillCheckboxChip
              key={skill.id}
              skill={skill}
              checked={picked.has(skill.id)}
              disabled={full && !picked.has(skill.id)}
              onChange={(checked) => toggle(skill.id, checked)}
            />
          ))}
        </div>
        <p id="wizard-skills-hint" aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
          {hint}
        </p>
      </fieldset>

      {value.length > 0 && (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col divide-y rounded-xl border bg-card" aria-label="Levels">
            {value.map((answer) => {
              const skill = names.get(answer.skillId);
              const name = skill?.name ?? answer.skillId;
              const invalid = answer.target <= answer.current;
              const errorId = `wizard-level-${answer.skillId}-error`;
              return (
                <li key={answer.skillId} className="flex flex-col gap-2 px-4 py-3 sm:grid sm:grid-cols-[11rem_1fr] sm:items-start sm:gap-6">
                  <p className="flex items-center gap-2 text-sm font-semibold sm:pt-6">
                    <SkillDot skill={skill} className="size-2.5" />
                    {name}
                  </p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2">
                    <SegmentedControl
                      legend="Now"
                      groupLabel={`Now for ${name}`}
                      size="md"
                      options={LEVEL_OPTIONS}
                      value={answer.current}
                      onChange={(current: SkillLevelValue) => setLevel(answer.skillId, { current })}
                    />
                    <div className="flex flex-col gap-1">
                      <SegmentedControl
                        legend="Goal"
                        groupLabel={`Goal for ${name}`}
                        size="md"
                        options={LEVEL_OPTIONS}
                        value={answer.target}
                        invalid={invalid}
                        describedBy={invalid ? errorId : undefined}
                        onChange={(target: SkillLevelValue) => setLevel(answer.skillId, { target })}
                      />
                      {invalid && <FieldMessage id={errorId}>Set a goal above where you are.</FieldMessage>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">{LEVEL_LEGEND}</p>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" disabled={!skillsComplete(value)} aria-busy={checking || undefined}>
          {checking ? (
            <Loader2Icon aria-hidden className="animate-spin motion-reduce:animate-none" />
          ) : draftLabel === "Draft with Claude" ? (
            <SparklesIcon aria-hidden />
          ) : null}
          {draftLabel}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={onBack}>
          Back
        </Button>
      </div>
    </form>
  );
}
