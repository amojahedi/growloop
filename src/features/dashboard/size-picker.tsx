"use client";

import { useId } from "react";
import { WIDGET_SIZES, type WidgetSize } from "@/lib/domain/types";

const LABELS: Record<WidgetSize, { short: string; long: string }> = {
  small: { short: "S", long: "Small" },
  medium: { short: "M", long: "Medium" },
  large: { short: "L", long: "Large" },
};

/** Segmented S / M / L radio group for a widget's width. */
export function SizePicker({
  widgetTitle,
  value,
  onChange,
}: {
  widgetTitle: string;
  value: WidgetSize;
  onChange: (size: WidgetSize) => void;
}) {
  const name = useId();
  return (
    <fieldset className="flex shrink-0 overflow-hidden rounded-md border-token border-input">
      <legend className="sr-only">Size of {widgetTitle}</legend>
      {WIDGET_SIZES.map((size) => (
        <label
          key={size}
          title={LABELS[size].long}
          className="cursor-pointer px-2 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted has-checked:bg-primary has-checked:text-primary-foreground has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
        >
          <input
            type="radio"
            name={name}
            value={size}
            checked={value === size}
            onChange={() => onChange(size)}
            className="sr-only"
          />
          <span aria-hidden>{LABELS[size].short}</span>
          <span className="sr-only">{LABELS[size].long}</span>
        </label>
      ))}
    </fieldset>
  );
}
