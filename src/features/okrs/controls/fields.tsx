"use client";

import { cn } from "cn";
import { MinusIcon, PencilIcon, PlusIcon } from "lucide-react";
import { useId, useLayoutEffect, useRef, type ComponentProps } from "react";
import { MAX_COUNT, MIN_COUNT } from "@/lib/domain/okrs";

/**
 * A one-line text field that looks like plain text until hovered or focused,
 * when it shows its border and an edit affordance (okrs-and-wizard.md §Review
 * screen). It wraps and grows instead of scrolling, so long titles stay
 * readable in narrow quarter columns; Enter never adds a line break.
 */
export function InlineTextField({
  className,
  inputClassName,
  invalid,
  value,
  onChange,
  onKeyDown,
  ...props
}: Omit<ComponentProps<"textarea">, "rows" | "value"> & { value: string; inputClassName?: string; invalid?: boolean }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  // Grow with the text (and with the column's width).
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const fit = () => {
      element.style.height = "auto";
      element.style.height = `${element.scrollHeight}px`;
    };
    fit();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(fit);
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);

  return (
    <div className={cn("group/inline relative min-w-0", className)}>
      <textarea
        ref={ref}
        rows={1}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={(event) => {
          // Pasted line breaks become spaces: titles are one line.
          if (/[\r\n]/.test(event.target.value)) event.target.value = event.target.value.replace(/[\r\n]+/g, " ");
          onChange?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.preventDefault();
          onKeyDown?.(event);
        }}
        className={cn(
          "-ml-1.5 block w-full min-w-0 resize-none overflow-hidden rounded-md border border-transparent bg-transparent py-0.5 pr-7 pl-1.5 outline-none transition-colors placeholder:text-muted-foreground",
          "hover:border-input focus-visible:border-ring focus-visible:bg-card focus-visible:ring-3 focus-visible:ring-ring/50",
          "aria-invalid:border-destructive",
          inputClassName,
        )}
        {...props}
      />
      <PencilIcon
        aria-hidden
        className="pointer-events-none absolute top-1.5 right-2 size-3.5 text-muted-foreground opacity-0 transition-opacity group-focus-within/inline:opacity-100 group-hover/inline:opacity-100"
      />
    </div>
  );
}

/** "N items" for a count key result: − / number / +, 1–10. */
export function CountStepper({
  id,
  value,
  onChange,
  describedBy,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  describedBy?: string;
}) {
  const labelId = useId();
  const set = (next: number) => onChange(Math.min(MAX_COUNT, Math.max(MIN_COUNT, Math.round(next))));
  const buttonClass =
    "grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40";
  return (
    <div role="group" aria-labelledby={labelId} className="inline-flex items-center gap-1">
      <span id={labelId} className="sr-only">
        Number of items
      </span>
      <div className="inline-flex items-center rounded-lg border border-input bg-card p-0.5">
        <button type="button" className={buttonClass} onClick={() => set(value - 1)} disabled={value <= MIN_COUNT} aria-label="Fewer items">
          <MinusIcon className="size-3.5" aria-hidden />
        </button>
        <input
          id={id}
          type="number"
          inputMode="numeric"
          min={MIN_COUNT}
          max={MAX_COUNT}
          value={value}
          aria-label="Number of items"
          aria-describedby={describedBy}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (event.target.value !== "" && Number.isFinite(next)) set(next);
          }}
          className="h-7 w-8 [appearance:textfield] bg-transparent text-center text-sm font-semibold tabular-nums outline-none focus-visible:rounded-md focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button type="button" className={buttonClass} onClick={() => set(value + 1)} disabled={value >= MAX_COUNT} aria-label="More items">
          <PlusIcon className="size-3.5" aria-hidden />
        </button>
      </div>
      <span className="text-xs text-muted-foreground" aria-hidden>
        items
      </span>
    </div>
  );
}
