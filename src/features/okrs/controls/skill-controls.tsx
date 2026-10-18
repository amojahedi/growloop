"use client";

import { cn } from "cn";
import { ChevronDownIcon } from "lucide-react";
import type { ID, Skill } from "@/lib/domain/types";
import { skillColorVar, skillTextColor } from "@/lib/theme/skill-colors";
import { useUIStore } from "@/lib/store/ui-store";
import { chipClassName } from "./choice-controls";

/** The skill's color as a small dot. */
export function SkillDot({ skill, className }: { skill: Pick<Skill, "color"> | undefined; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full bg-muted-foreground", className)}
      style={skill ? { backgroundColor: skillColorVar(skill.color) } : undefined}
    />
  );
}

/**
 * A skill chip that opens the skill sheet (skills.md). Hidden skills stay
 * visible on key results, muted.
 */
export function SkillChip({ skill, skillId, className }: { skill: Skill | undefined; skillId: ID; className?: string }) {
  const openSkillSheet = useUIStore((state) => state.openSkillSheet);
  const muted = !skill || skill.hidden;
  const name = skill?.name ?? "Unknown skill";
  const content = (
    <>
      <SkillDot skill={skill} className={muted ? "opacity-50" : undefined} />
      <span className="truncate">{name}</span>
    </>
  );
  const base = cn(
    "inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-full border bg-card px-2 text-xs font-semibold",
    muted && "border-dashed text-muted-foreground",
    className,
  );
  if (!skill) return <span className={base}>{content}</span>;
  return (
    <button
      type="button"
      className={cn(base, "transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none")}
      style={muted ? undefined : { color: skillTextColor(skill.color) }}
      onClick={() => openSkillSheet(skillId)}
      aria-label={`${name}${skill.hidden ? " (hidden)" : ""}: open skill`}
    >
      {content}
    </button>
  );
}

/** A focus-skill chip in step 2: a checkbox in the skill's color. */
export function SkillCheckboxChip({
  skill,
  checked,
  disabled,
  onChange,
}: {
  skill: Skill;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="relative">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={chipClassName}>
        <SkillDot skill={skill} className="size-2.5" />
        {skill.name}
      </span>
    </label>
  );
}

/** The skill picker on a key result: a native select styled as a chip. */
export function SkillSelect({
  id,
  value,
  skills,
  onChange,
  onBlur,
  invalid,
  describedBy,
}: {
  id: string;
  value: ID;
  /** Visible skills, plus the current one if it is hidden. */
  skills: readonly Skill[];
  onChange: (skillId: ID) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const selected = skills.find((skill) => skill.id === value);
  return (
    <div className="relative inline-flex max-w-full min-w-0">
      <SkillDot skill={selected} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
      <select
        id={id}
        aria-label="Skill"
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        className={cn(
          "h-7 max-w-full min-w-0 cursor-pointer appearance-none truncate rounded-full border border-input bg-card pr-7 pl-6 text-xs font-semibold outline-none",
          "hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "aria-invalid:border-destructive",
          !selected && "text-muted-foreground",
        )}
        style={selected && !selected.hidden ? { color: skillTextColor(selected.color) } : undefined}
      >
        <option value="" disabled>
          Pick a skill
        </option>
        {skills.map((skill) => (
          <option key={skill.id} value={skill.id}>
            {skill.name}
            {skill.hidden ? " (hidden)" : ""}
          </option>
        ))}
      </select>
      <ChevronDownIcon aria-hidden className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
