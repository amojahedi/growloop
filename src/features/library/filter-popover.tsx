"use client";

import { ChevronDownIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CheckboxGroup } from "./checkbox-group";
import type { FilterGroup } from "./filter-groups";

/** "Skills: Discovery +1": names the selection without counting results. */
export function selectionSummary(group: FilterGroup, selected: readonly string[]): string {
  const labels = group.options.filter((option) => selected.includes(option.value)).map((option) => option.label);
  if (labels.length === 0) return group.label;
  return labels.length === 1 ? `${group.label}: ${labels[0]}` : `${group.label}: ${labels[0]} +${labels.length - 1}`;
}

/** A multi-select filter: a trigger button that opens a checkbox group in a popover. */
export function FilterPopover({
  group,
  selected,
  onToggle,
}: {
  group: FilterGroup;
  selected: readonly string[];
  onToggle: (value: string) => void;
}) {
  const active = selected.length > 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant={active ? "secondary" : "outline"} size="sm" className="max-w-56">
          <span className="truncate">{selectionSummary(group, selected)}</span>
          <ChevronDownIcon aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <CheckboxGroup legend={group.label} hideLegend options={group.options} selected={selected} onToggle={onToggle} />
      </PopoverContent>
    </Popover>
  );
}
