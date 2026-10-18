"use client";

import { useId } from "react";
import { LEVEL_LABELS } from "@/lib/domain/plan-draft";
import { SKILL_LEVEL_VALUES, type SkillLevelValue } from "@/lib/domain/types";
import { cn } from "@/lib/utils";

/**
 * Skill levels (S-5): 1 New to it · 2 Learning · 3 Capable · 4 Strong · 5 Expert.
 * `LevelDots` shows a level as 5 dots with its word on hover and focus;
 * `LevelControl` is the 1–5 segmented control the wizard and the skill sheet share.
 */

export function LevelDots({ label, value }: { label: string; value: SkillLevelValue }) {
  const word = LEVEL_LABELS[value];
  return (
    <span className="group relative inline-flex items-center gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        role="img"
        tabIndex={0}
        aria-label={`${label}: ${word}, ${value} of 5`}
        className="inline-flex gap-1 rounded-full p-0.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {SKILL_LEVEL_VALUES.map((dot) => (
          <span
            key={dot}
            aria-hidden
            className={cn("size-2.5 rounded-full border", dot <= value ? "border-primary bg-primary" : "border-border bg-transparent")}
          />
        ))}
      </span>
      <span
        aria-hidden
        className="pointer-events-none absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 rounded-md bg-foreground px-2 py-0.5 text-xs whitespace-nowrap text-background opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 motion-reduce:transition-none"
      >
        {word}
      </span>
    </span>
  );
}

export function LevelControl({
  label,
  value,
  onChange,
  className,
}: {
  /** "Now" or "Goal"; also names the radio group. */
  label: string;
  value: SkillLevelValue;
  onChange: (value: SkillLevelValue) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={cn("flex items-center gap-2", className)}>
      <legend className="sr-only">{label}</legend>
      <span aria-hidden className="w-10 text-xs text-muted-foreground">
        {label}
      </span>
      <span className="inline-flex rounded-lg border border-border bg-background p-0.5">
        {SKILL_LEVEL_VALUES.map((level) => (
          <label
            key={level}
            title={LEVEL_LABELS[level]}
            className="relative flex size-7 cursor-pointer items-center justify-center rounded-md text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name={name}
              value={level}
              checked={value === level}
              onChange={() => onChange(level)}
              aria-label={`${level} ${LEVEL_LABELS[level]}`}
              className="absolute inset-0 cursor-pointer opacity-0"
            />
            <span aria-hidden>{level}</span>
          </label>
        ))}
      </span>
    </fieldset>
  );
}
