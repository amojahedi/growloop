"use client";

import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PlanItem, Skill } from "@/lib/domain/types";
import { useActions, useSkills } from "@/lib/store/hooks";
import { SkillChip } from "@/components/skills/skill-chip";
import { skillColorVar } from "@/lib/theme/skill-colors";
import { MAX_CARD_SKILLS, setPrimarySkill, toggleCardSkill } from "./card-mode";

/**
 * The card's own skills (C-6): chips open the skill sheet; Edit picks 1–3
 * visible skills and the primary one. Changes affect only this card and
 * apply at once, so the radar and count KRs follow immediately.
 */
export function CardSkills({ item, readOnly }: { item: PlanItem; readOnly: boolean }) {
  const allSkills = useSkills({ includeHidden: true });

  return (
    // The first skill is the primary one (full impact weight).
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Skills, primary first">
      {item.skillIds.map((id) => (
        <SkillChip key={id} skillId={id} />
      ))}
      {!readOnly && <EditSkills item={item} skills={allSkills} />}
    </div>
  );
}

function EditSkills({ item, skills }: { item: PlanItem; skills: readonly Skill[] }) {
  const { setPlanItemSkills } = useActions();
  const radioName = useId();
  const hintId = useId();
  // Visible skills, plus any hidden one still on the card so it can be removed.
  const options = skills.filter((skill) => !skill.hidden || item.skillIds.includes(skill.id));
  const full = item.skillIds.length >= MAX_CARD_SKILLS;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="link" size="xs" aria-label="Edit skills for this card">
          Edit
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <fieldset className="flex flex-col gap-1" aria-describedby={hintId}>
          <legend className="mb-1 text-xs font-medium text-muted-foreground">Skills for this card</legend>
          <p id={hintId} className="mb-1 text-xs text-muted-foreground">
            Pick 1 to 3. The primary skill gets the full impact.
          </p>
          <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
            {options.map((skill) => {
              const checked = item.skillIds.includes(skill.id);
              const primary = item.skillIds[0] === skill.id;
              const lockedOn = checked && item.skillIds.length === 1;
              return (
                <div key={skill.id} className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted">
                  <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      className="size-4 shrink-0 accent-primary"
                      checked={checked}
                      disabled={lockedOn || (!checked && full)}
                      onChange={() => setPlanItemSkills(item.id, toggleCardSkill(item.skillIds, skill.id))}
                    />
                    <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: skillColorVar(skill.color) }} />
                    <span className="truncate">
                      {skill.name}
                      {skill.hidden && <span className="text-muted-foreground"> (hidden)</span>}
                    </span>
                  </label>
                  <label className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    <input
                      type="radio"
                      name={radioName}
                      className="accent-primary"
                      checked={primary}
                      disabled={!checked}
                      aria-label={`Make ${skill.name} the primary skill`}
                      onChange={() => setPlanItemSkills(item.id, setPrimarySkill(item.skillIds, skill.id))}
                    />
                    <span aria-hidden>Primary</span>
                  </label>
                </div>
              );
            })}
          </div>
        </fieldset>
      </PopoverContent>
    </Popover>
  );
}
