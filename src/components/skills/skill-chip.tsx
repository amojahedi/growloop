"use client";

import type { ID, Skill } from "@/lib/domain/types";
import { useSkill } from "@/lib/store/hooks";
import { useUIStore } from "@/lib/store/ui-store";
import { skillColorVar, skillTextColor } from "@/lib/theme/skill-colors";
import { cn } from "@/lib/utils";

/**
 * Skill chips (skills.md §Skill sheet). `SkillChip` is a button that opens the
 * skill's sheet; use it in card detail, Library cards and brief, KR rows, the
 * Notebook and the wizard review. `SkillTag` looks the same but isn't
 * interactive, for places where the whole surface is already a button (board
 * cards). Hidden skills render muted; unknown ids render nothing.
 */

const chipClassName =
  "inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium";

function ChipContent({ skill }: { skill: Skill }) {
  return (
    <>
      <span
        aria-hidden
        className={cn("size-2 shrink-0 rounded-full", skill.hidden && "opacity-50")}
        style={{ backgroundColor: skillColorVar(skill.color) }}
      />
      <span
        className={cn("truncate", skill.hidden && "text-muted-foreground")}
        style={skill.hidden ? undefined : { color: skillTextColor(skill.color) }}
      >
        {skill.name}
      </span>
      {skill.hidden && <span className="sr-only"> (hidden)</span>}
    </>
  );
}

export function SkillChip({ skillId, className }: { skillId: ID; className?: string }) {
  const skill = useSkill(skillId);
  const openSkillSheet = useUIStore((state) => state.openSkillSheet);
  if (!skill) return null;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      className={cn(
        chipClassName,
        "cursor-pointer transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
        skill.hidden && "border-dashed",
        className,
      )}
      onClick={(event) => {
        // Chips sit inside clickable rows and cards; only the sheet should open.
        event.stopPropagation();
        openSkillSheet(skill.id);
      }}
    >
      <ChipContent skill={skill} />
    </button>
  );
}

export function SkillTag({ skillId, className }: { skillId: ID; className?: string }) {
  const skill = useSkill(skillId);
  if (!skill) return null;
  return (
    <span className={cn(chipClassName, skill.hidden && "border-dashed", className)}>
      <ChipContent skill={skill} />
    </span>
  );
}
