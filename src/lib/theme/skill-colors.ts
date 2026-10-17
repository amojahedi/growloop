import type { SkillColor } from "@/lib/domain/types";

/**
 * Skill colors are theme tokens (`--skill-<color>`), so each style theme can
 * tune them. Class names can't be built dynamically with Tailwind, so use the
 * CSS variable directly, e.g. `style={{ backgroundColor: skillColorVar(skill.color) }}`.
 */
export function skillColorVar(color: SkillColor): string {
  return `var(--skill-${color})`;
}

/**
 * A skill color that is safe for text: raw skill colors are too light for small
 * text on cards (amber or lime on Linen is about 2:1), so this mixes in the
 * theme's foreground, which darkens in light mode and lightens in dark mode
 * (about 5:1 or better on cards in both).
 */
export function skillTextColor(color: SkillColor): string {
  return `color-mix(in oklch, ${skillColorVar(color)} 50%, var(--foreground))`;
}
