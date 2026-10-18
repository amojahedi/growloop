"use client";

import { ChevronDownIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ID, Objective, Skill } from "@/lib/domain/types";
import type { FilterGroup } from "../library/filter-groups";
import { FilterPopover } from "../library/filter-popover";
import { NO_FILTERS, type BoardFilters as Filters } from "./board-model";

const ALL = "";

/**
 * "[Skills ▾] [Objective ▾]" (board.md §Header): Skills is the Library's
 * multi-select popover; Objective is a single select of the viewed quarter's
 * objectives (hidden when it has none).
 */
export function BoardFilters({
  filters,
  skills,
  objectives,
  onChange,
}: {
  filters: Filters;
  /** Visible skills, in display order. */
  skills: readonly Skill[];
  /** The viewed quarter's objectives. */
  objectives: readonly Objective[];
  onChange: (filters: Filters) => void;
}) {
  const group: FilterGroup = {
    category: "skills",
    label: "Skills",
    chipLabel: "Skill",
    options: skills.map((skill) => ({ value: skill.id, label: skill.name, color: skill.color })),
  };
  const toggleSkill = (id: ID) =>
    onChange({
      ...filters,
      skillIds: filters.skillIds.includes(id) ? filters.skillIds.filter((other) => other !== id) : [...filters.skillIds, id],
    });
  const objective = objectives.find((candidate) => candidate.id === filters.objectiveId);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterPopover group={group} selected={filters.skillIds} onToggle={toggleSkill} />
      {objectives.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant={objective ? "secondary" : "outline"} size="sm" className="max-w-64">
              <span className="truncate">{objective ? `Objective: ${objective.title}` : "Objective"}</span>
              <ChevronDownIcon aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuRadioGroup
              value={objective?.id ?? ALL}
              onValueChange={(objectiveId) => onChange({ ...filters, objectiveId })}
            >
              <DropdownMenuRadioItem value={ALL}>All objectives</DropdownMenuRadioItem>
              <DropdownMenuSeparator />
              {objectives.map((candidate) => (
                <DropdownMenuRadioItem key={candidate.id} value={candidate.id} className="items-start">
                  <span className="line-clamp-2">{candidate.title}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/** Active filters as removable chips, plus "Clear filters". Renders nothing when no filter is active. */
export function BoardFilterChips({
  filters,
  skills,
  objective,
  onChange,
}: {
  filters: Filters;
  skills: readonly Skill[];
  /** The active objective filter, if it is in the viewed quarter. */
  objective: Objective | undefined;
  onChange: (filters: Filters) => void;
}) {
  const chips = [
    ...filters.skillIds.flatMap((id) => {
      const skill = skills.find((candidate) => candidate.id === id);
      return skill
        ? [{ key: id, label: `Skill: ${skill.name}`, remove: () => onChange({ ...filters, skillIds: filters.skillIds.filter((other) => other !== id) }) }]
        : [];
    }),
    ...(objective ? [{ key: "objective", label: `Objective: ${objective.title}`, remove: () => onChange({ ...filters, objectiveId: ALL }) }] : []),
  ];
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Active filters">
      <ul className="contents">
        {chips.map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              aria-label={`Remove filter ${chip.label}`}
              onClick={chip.remove}
              className="inline-flex h-6 max-w-64 items-center gap-1 rounded-full bg-secondary px-2.5 text-xs font-medium text-secondary-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="truncate">{chip.label}</span>
              <XIcon aria-hidden className="size-3 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="link" size="xs" onClick={() => onChange(NO_FILTERS)}>
        Clear filters
      </Button>
    </div>
  );
}
