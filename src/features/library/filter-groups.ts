import type { Skill, SkillColor } from "@/lib/domain/types";
import { COST_LABELS, LENGTH_LABELS, LEVEL_LABELS, SHOW_LABELS, TYPE_LABELS } from "./labels";
import {
  FILTER_COSTS,
  FILTER_LEVELS,
  FILTER_TYPES,
  LENGTH_BUCKETS,
  type FilterCategory,
  type ResourceFilters,
} from "./resource-filters";

/** The multi-select filter groups and the removable chips that describe active filters. */

export interface FilterOption {
  value: string;
  label: string;
  /** Skill color, shown as a dot. */
  color?: SkillColor;
}

export interface FilterGroup {
  category: FilterCategory;
  /** Group heading, e.g. "Skills". */
  label: string;
  /** Prefix for a chip, e.g. "Skill: Discovery". */
  chipLabel: string;
  options: FilterOption[];
}

const fromLabels = <T extends string>(values: readonly T[], labels: Record<T, string>): FilterOption[] =>
  values.map((value) => ({ value, label: labels[value] }));

export function buildFilterGroups(skills: readonly Skill[]): FilterGroup[] {
  return [
    {
      category: "skills",
      label: "Skills",
      chipLabel: "Skill",
      options: skills.map((skill) => ({ value: skill.id, label: skill.name, color: skill.color })),
    },
    { category: "types", label: "Type", chipLabel: "Type", options: fromLabels(FILTER_TYPES, TYPE_LABELS) },
    { category: "levels", label: "Level", chipLabel: "Level", options: fromLabels(FILTER_LEVELS, LEVEL_LABELS) },
    { category: "costs", label: "Cost", chipLabel: "Cost", options: fromLabels(FILTER_COSTS, COST_LABELS) },
    { category: "lengths", label: "Length", chipLabel: "Length", options: fromLabels(LENGTH_BUCKETS, LENGTH_LABELS) },
  ];
}

export interface FilterChip {
  key: string;
  label: string;
  /** Returns the filters without this one. */
  remove: (filters: ResourceFilters) => ResourceFilters;
}

/** One chip per active filter value, in the order the controls appear. */
export function activeFilterChips(filters: ResourceFilters, groups: readonly FilterGroup[]): FilterChip[] {
  const chips: FilterChip[] = [];
  const query = filters.query.trim();
  if (query) {
    chips.push({ key: "query", label: `Search: “${query}”`, remove: (current) => ({ ...current, query: "" }) });
  }

  for (const group of groups) {
    const selected = filters[group.category] as readonly string[];
    for (const value of selected) {
      const option = group.options.find((candidate) => candidate.value === value);
      if (!option) continue;
      chips.push({
        key: `${group.category}:${value}`,
        label: `${group.chipLabel}: ${option.label}`,
        remove: (current) => ({
          ...current,
          [group.category]: (current[group.category] as readonly string[]).filter((other) => other !== value),
        }),
      });
    }
  }

  if (filters.show !== "all") {
    chips.push({ key: "show", label: `Show: ${SHOW_LABELS[filters.show]}`, remove: (current) => ({ ...current, show: "all" }) });
  }
  return chips;
}
