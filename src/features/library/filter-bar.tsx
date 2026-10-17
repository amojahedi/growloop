"use client";

import { SlidersHorizontalIcon } from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/input";
import { CheckboxGroup } from "./checkbox-group";
import type { FilterGroup } from "./filter-groups";
import { FilterPopover } from "./filter-popover";
import { SORT_LABELS } from "./labels";
import {
  clearFilters,
  hasActiveFilters,
  SORT_OPTIONS,
  toggleOption,
  type FilterCategory,
  type ResourceFilters,
  type SortOption,
} from "./resource-filters";
import { SearchField } from "./search-field";
import { ShowToggle } from "./show-toggle";
import type { UpdateFiltersOptions } from "./use-resource-filters";

type Update = (update: (current: ResourceFilters) => ResourceFilters, options?: UpdateFiltersOptions) => void;

/**
 * Search, filters and sort (RS-2). On wide screens each filter is a popover;
 * on small screens they collapse into a "Filters" sheet.
 */
export function FilterBar({
  filters,
  groups,
  onUpdate,
}: {
  filters: ResourceFilters;
  groups: readonly FilterGroup[];
  onUpdate: Update;
}) {
  const toggle = (category: FilterCategory, value: string) =>
    onUpdate((current) => toggleOption(current, category, value));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          value={filters.query}
          // Starting a search adds one history entry; refining it replaces that entry, so Back skips the keystrokes.
          onCommit={(query) => onUpdate((current) => ({ ...current, query }), { replace: filters.query.trim() !== "" })}
        />
        <FilterSheet filters={filters} groups={groups} onUpdate={onUpdate} onToggle={toggle} />
        <SortSelect value={filters.sort} onChange={(sort) => onUpdate((current) => ({ ...current, sort }))} />
      </div>

      <div className="hidden flex-wrap items-center gap-2 md:flex">
        {groups.map((group) => (
          <FilterPopover
            key={group.category}
            group={group}
            selected={filters[group.category]}
            onToggle={(value) => toggle(group.category, value)}
          />
        ))}
        <ShowToggle value={filters.show} onChange={(show) => onUpdate((current) => ({ ...current, show }))} />
      </div>
    </div>
  );
}

function SortSelect({ value, onChange }: { value: SortOption; onChange: (value: SortOption) => void }) {
  const id = useId();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        Sort
      </label>
      <NativeSelect id={id} className="w-auto" value={value} onChange={(event) => onChange(event.target.value as SortOption)}>
        {SORT_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {SORT_LABELS[option]}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}

/** Small screens: every filter in one sheet. Changes apply immediately. */
function FilterSheet({
  filters,
  groups,
  onUpdate,
  onToggle,
}: {
  filters: ResourceFilters;
  groups: readonly FilterGroup[];
  onUpdate: Update;
  onToggle: (category: FilterCategory, value: string) => void;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={hasActiveFilters(filters) ? "secondary" : "outline"} className="md:hidden">
          <SlidersHorizontalIcon aria-hidden />
          Filters
        </Button>
      </DialogTrigger>
      <DialogContent side="bottom">
        <DialogHeader>
          <DialogTitle>Filters</DialogTitle>
          <DialogDescription>Pick any mix. Results update as you go.</DialogDescription>
        </DialogHeader>
        <ShowToggle value={filters.show} onChange={(show) => onUpdate((current) => ({ ...current, show }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((group) => (
            <CheckboxGroup
              key={group.category}
              legend={group.label}
              options={group.options}
              selected={filters[group.category]}
              onToggle={(value) => onToggle(group.category, value)}
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" disabled={!hasActiveFilters(filters)} onClick={() => onUpdate(clearFilters)}>
            Clear all
          </Button>
          <DialogClose asChild>
            <Button>Done</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
