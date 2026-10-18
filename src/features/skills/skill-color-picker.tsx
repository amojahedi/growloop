"use client";

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SKILL_COLORS, type SkillColor } from "@/lib/domain/types";
import { skillColorVar } from "@/lib/theme/skill-colors";
import { cn } from "@/lib/utils";
import { colorName } from "./skill-rules";

/**
 * The skill color dot as a button opening the 16 skill color swatches
 * (skills.md §Settings → Skills). Arrow keys move between swatches.
 */
export function SkillColorPicker({
  value,
  onChange,
  label,
}: {
  value: SkillColor;
  onChange: (color: SkillColor) => void;
  /** Accessible name of the dot button, e.g. "Color for Roadmapping". */
  label: string;
}) {
  const [open, setOpen] = useState(false);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowDown: 4, ArrowLeft: -1, ArrowUp: -4 }[event.key];
    if (!step) return;
    event.preventDefault();
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")];
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(Math.max(index, 0) + step + buttons.length) % buttons.length]?.focus();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${colorName(value)}`}
          className="flex size-6 shrink-0 items-center justify-center rounded-full outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span aria-hidden className="size-3 rounded-full" style={{ backgroundColor: skillColorVar(value) }} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-2"
        onOpenAutoFocus={(event) => {
          // Start on the current color rather than the first swatch.
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.querySelector<HTMLButtonElement>("[aria-checked=true]")?.focus();
        }}
      >
        <div role="radiogroup" aria-label={label} className="grid grid-cols-4 gap-1" onKeyDown={onKeyDown}>
          {SKILL_COLORS.map((color) => {
            const selected = color === value;
            return (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={colorName(color)}
                title={colorName(color)}
                tabIndex={selected ? 0 : -1}
                className="flex size-8 items-center justify-center rounded-md outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                onClick={() => {
                  onChange(color);
                  setOpen(false);
                }}
              >
                <span
                  aria-hidden
                  className={cn(
                    "size-5 rounded-full",
                    selected && "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
                  )}
                  style={{ backgroundColor: skillColorVar(color) }}
                />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
