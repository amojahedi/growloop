"use client";

import { cn } from "cn";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { MATERIAL_TYPE_ICONS } from "@/components/icons";
import type { ID, Material } from "@/lib/domain/types";

const LEVEL_LABELS = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as const;

/**
 * Picks a key result's target material: an editable combobox (ARIA 1.2) that
 * filters the skill's materials as you type. Arrow keys move, Enter picks,
 * Escape closes and restores the current choice.
 */
export function MaterialCombobox({
  id,
  label,
  materials,
  value,
  onChange,
  onBlur,
  placeholder,
  disabled,
  invalid,
  describedBy,
}: {
  id: string;
  label: string;
  /** The choices, in recommended order. */
  materials: readonly Material[];
  value: ID | undefined;
  onChange: (materialId: ID) => void;
  onBlur?: () => void;
  placeholder: string;
  disabled?: boolean;
  invalid?: boolean;
  describedBy?: string;
}) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const selected = materials.find((material) => material.id === value);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return materials;
    return materials.filter(
      (material) => material.title.toLowerCase().includes(needle) || material.author.toLowerCase().includes(needle),
    );
  }, [materials, query]);

  const show = () => {
    if (disabled) return;
    setQuery("");
    setActive(Math.max(0, materials.findIndex((material) => material.id === value)));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    setQuery("");
  };
  const pick = (material: Material) => {
    onChange(material.id);
    close();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) return show();
        setActive((index) => Math.min(matches.length - 1, index + 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        if (!open) return show();
        setActive((index) => Math.max(0, index - 1));
        return;
      case "Home":
      case "End":
        if (!open) return;
        event.preventDefault();
        setActive(event.key === "Home" ? 0 : matches.length - 1);
        return;
      case "Enter":
        if (open && matches[active]) {
          event.preventDefault();
          pick(matches[active]);
        }
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
        return;
    }
  };

  const activeId = open && matches[active] ? `${listId}-${matches[active].id}` : undefined;

  // Keep the active option visible while arrowing through a long list.
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  return (
    <div className="relative w-full min-w-0">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        disabled={disabled}
        placeholder={placeholder}
        value={open ? query : (selected?.title ?? "")}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(0);
          setOpen(true);
        }}
        onClick={() => (open ? undefined : show())}
        onKeyDown={onKeyDown}
        onBlur={() => {
          close();
          onBlur?.();
        }}
        className={cn(
          "h-8 w-full min-w-0 truncate rounded-lg border border-input bg-card pr-7 pl-2.5 text-sm outline-none transition-colors placeholder:text-muted-foreground",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive",
        )}
      />
      <ChevronDownIcon
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-2 size-4 -translate-y-1/2 text-muted-foreground"
      />
      {/* Always rendered so aria-controls points at an element; hidden while closed. */}
      <ul
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={!open || matches.length === 0}
        className="absolute top-full right-0 left-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-md"
      >
        {matches.map((material, index) => {
          const Icon = MATERIAL_TYPE_ICONS[material.type];
          const isSelected = material.id === value;
          return (
            <li
              key={material.id}
              id={`${listId}-${material.id}`}
              role="option"
              aria-selected={isSelected}
              // Keep focus in the input so blur doesn't close the list before the click lands.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => pick(material)}
              onMouseMove={() => setActive(index)}
              className={cn(
                "flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm",
                index === active && "bg-accent text-accent-foreground",
              )}
            >
              <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block leading-snug">{material.title}</span>
                <span className="block text-xs text-muted-foreground">
                  {material.author ? `${material.author} · ` : ""}
                  {LEVEL_LABELS[material.level]}
                </span>
              </span>
              {isSelected && <CheckIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />}
            </li>
          );
        })}
      </ul>
      {/* Outside the listbox (it may only hold options), and announced as the list empties. */}
      <p role="status" className={open && matches.length === 0 ? "absolute top-full right-0 left-0 z-30 mt-1 rounded-lg border bg-popover px-2.5 py-1.5 text-sm text-muted-foreground shadow-md" : "sr-only"}>
        {open && matches.length === 0 ? "No matches" : ""}
      </p>
    </div>
  );
}
