"use client";

import { useId } from "react";
import { SHOW_LABELS } from "./labels";
import { SHOW_OPTIONS, type ShowOption } from "./resource-filters";

/** "Show: All / Not in my library / In my library" as a segmented radio group. */
export function ShowToggle({ value, onChange }: { value: ShowOption; onChange: (value: ShowOption) => void }) {
  const name = useId();

  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="sr-only">Show</legend>
      <div className="inline-flex flex-wrap rounded-lg border bg-background p-0.5">
        {SHOW_OPTIONS.map((option) => (
          <label
            key={option}
            className="cursor-pointer rounded-md px-2 py-1 text-xs font-medium text-muted-foreground has-checked:bg-secondary has-checked:text-secondary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name={name}
              value={option}
              className="sr-only"
              checked={value === option}
              onChange={() => onChange(option)}
            />
            {SHOW_LABELS[option]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
