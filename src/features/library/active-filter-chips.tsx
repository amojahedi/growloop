"use client";

import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { activeFilterChips, type FilterGroup } from "./filter-groups";
import { clearFilters, type ResourceFilters } from "./resource-filters";

/** Active filters as removable chips, plus "Clear all". Renders nothing when no filter is active. */
export function ActiveFilterChips({
  filters,
  groups,
  onUpdate,
}: {
  filters: ResourceFilters;
  groups: readonly FilterGroup[];
  onUpdate: (update: (current: ResourceFilters) => ResourceFilters) => void;
}) {
  const chips = activeFilterChips(filters, groups);
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Active filters">
      <ul className="contents">
        {chips.map((chip) => (
          <li key={chip.key}>
            <button
              type="button"
              aria-label={`Remove filter ${chip.label}`}
              onClick={() => onUpdate(chip.remove)}
              className="inline-flex h-6 max-w-64 items-center gap-1 rounded-full bg-secondary px-2.5 text-xs font-medium text-secondary-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="truncate">{chip.label}</span>
              <XIcon aria-hidden className="size-3 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      <Button variant="link" size="xs" onClick={() => onUpdate(clearFilters)}>
        Clear all
      </Button>
    </div>
  );
}
