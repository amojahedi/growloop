"use client";

import { cn } from "cn";
import { useId } from "react";

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  /** Id of the element explaining why the option is disabled. */
  describedBy?: string;
}

/**
 * "Carry over · Backlog · Drop": a radio group drawn as joined segments.
 * Native radios underneath, so arrow keys, focus and screen readers behave
 * like any radio group.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  /** Accessible name of the group, e.g. "What to do with Inspired". */
  label: string;
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  const name = useId();

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex shrink-0 rounded-lg border bg-muted p-0.5 text-xs font-medium", className)}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className={cn(
            "relative cursor-pointer rounded-md px-2.5 py-1 whitespace-nowrap text-muted-foreground transition-colors",
            "has-checked:bg-card has-checked:text-foreground has-checked:shadow-xs",
            "has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
            "has-disabled:cursor-not-allowed has-disabled:opacity-50",
            !option.disabled && "hover:text-foreground",
          )}
        >
          <input
            type="radio"
            name={name}
            className="sr-only"
            value={option.value}
            checked={value === option.value}
            disabled={option.disabled}
            aria-describedby={option.describedBy}
            onChange={() => onChange(option.value)}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}
