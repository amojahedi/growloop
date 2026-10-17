import type { SkillColor } from "@/lib/domain/types";

/**
 * Skill colors are theme tokens (`--skill-<color>`), so each style theme can
 * tune them. Class names can't be built dynamically with Tailwind, so use the
 * CSS variable directly, e.g. `style={{ backgroundColor: skillColorVar(skill.color) }}`.
 */
export function skillColorVar(color: SkillColor): string {
  return `var(--skill-${color})`;
}
