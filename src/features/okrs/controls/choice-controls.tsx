"use client";

import { cn } from "cn";
import { useId, type ReactNode } from "react";

/**
 * Form controls for the wizard and the ObjectiveEditor, built on native radio
 * buttons and checkboxes so groups, arrow keys and screen-reader names come
 * from the platform (okrs-and-wizard.md: segmented controls are radio groups
 * with visible labels).
 */

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: ReactNode;
  /** Extra words for screen readers, e.g. "New to it" after the visible "1". */
  srLabel?: string;
  disabled?: boolean;
}

/** Single choice shown as chips (step 1's role and goal). */
export function RadioChips<T extends string>({
  legend,
  options,
  value,
  onChange,
  name,
}: {
  legend: string;
  options: readonly ChoiceOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  name?: string;
}) {
  const generated = useId();
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2.5 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label key={option.value} className="relative">
            <input
              type="radio"
              className="peer sr-only"
              name={name ?? generated}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className={chipClassName}>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export const chipClassName = cn(
  "inline-flex h-9 cursor-pointer items-center gap-2 rounded-full border border-input bg-card px-3.5 text-sm font-medium text-foreground transition-colors select-none",
  "hover:border-[color-mix(in_oklch,var(--input),var(--foreground)_20%)]",
  "peer-checked:border-primary peer-checked:bg-accent peer-checked:text-accent-foreground",
  "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-focus-visible:outline-none",
  "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
);

/** One choice among a few, shown as a segmented control. */
export function SegmentedControl<T extends string | number>({
  legend,
  hideLegend = false,
  options,
  value,
  onChange,
  id,
  size = "sm",
  stretch = false,
  invalid,
  describedBy,
}: {
  legend: ReactNode;
  hideLegend?: boolean;
  options: readonly ChoiceOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  /** Put on the first radio, so "Fix 2 things" can focus the group. */
  id?: string;
  size?: "sm" | "md";
  stretch?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const name = useId();
  return (
    <fieldset className={cn("min-w-0", stretch && "w-full")} aria-describedby={describedBy} aria-invalid={invalid || undefined}>
      <legend className={hideLegend ? "sr-only" : "mb-1 text-xs font-semibold text-muted-foreground"}>{legend}</legend>
      <div
        className={cn(
          "inline-flex gap-0.5 rounded-lg border bg-muted p-0.5",
          stretch && "flex w-full flex-wrap",
          invalid && "border-destructive",
        )}
      >
        {options.map((option, index) => (
          <label key={String(option.value)} className={cn("relative", stretch && "min-w-0 flex-1")}>
            <input
              id={index === 0 ? id : undefined}
              type="radio"
              className="peer sr-only"
              name={name}
              value={String(option.value)}
              checked={value === option.value}
              disabled={option.disabled}
              onChange={() => onChange(option.value)}
            />
            <span
              className={cn(
                "flex cursor-pointer items-center justify-center rounded-md font-semibold whitespace-nowrap text-muted-foreground tabular-nums transition-colors select-none",
                size === "sm" ? "h-7 px-2 text-xs" : "h-8 min-w-8 px-2.5 text-sm",
                "hover:text-foreground",
                "peer-checked:bg-card peer-checked:text-foreground peer-checked:shadow-xs",
                "peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
              )}
            >
              <span aria-hidden={option.srLabel ? true : undefined}>{option.label}</span>
              {option.srLabel && <span className="sr-only">{option.srLabel}</span>}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** An error or hint line under a field. */
export function FieldMessage({ id, children, tone = "error" }: { id?: string; children: ReactNode; tone?: "error" | "hint" }) {
  return (
    <p id={id} className={cn("text-xs", tone === "error" ? "font-medium text-destructive" : "text-muted-foreground")}>
      {children}
    </p>
  );
}
