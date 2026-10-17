"use client";

import { cn } from "cn";
import { skillColorVar } from "@/lib/theme/skill-colors";
import type { FilterOption } from "./filter-groups";

/** A labelled group of checkboxes: native inputs, so keyboard and screen reader support come for free. */
export function CheckboxGroup({
  legend,
  options,
  selected,
  onToggle,
  hideLegend = false,
  className,
}: {
  legend: string;
  options: readonly FilterOption[];
  selected: readonly string[];
  onToggle: (value: string) => void;
  /** Visually hide the legend (e.g. when a popover trigger already names the group). */
  hideLegend?: boolean;
  className?: string;
}) {
  return (
    <fieldset className={cn("flex min-w-0 flex-col gap-1", className)}>
      <legend className={hideLegend ? "sr-only" : "mb-1 text-xs font-medium text-muted-foreground"}>{legend}</legend>
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
        >
          <input
            type="checkbox"
            className="size-4 shrink-0 accent-primary outline-none"
            checked={selected.includes(option.value)}
            onChange={() => onToggle(option.value)}
          />
          {option.color && (
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: skillColorVar(option.color) }} />
          )}
          <span className="min-w-0 truncate">{option.label}</span>
        </label>
      ))}
    </fieldset>
  );
}
