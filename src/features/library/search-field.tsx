"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export const SEARCH_DEBOUNCE_MS = 300;

/**
 * Search box that commits its value after a short pause in typing (or on
 * Enter). It follows outside changes to `value` (back button, "Clear all")
 * without clobbering what the user is typing.
 */
export function SearchField({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
  // What we committed last, so the echo of our own commit doesn't overwrite newer keystrokes.
  const [committed, setCommitted] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  if (value !== seen) {
    setSeen(value);
    if (value !== committed) setDraft(value);
    setCommitted(null);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  const commit = (next: string) => {
    clearTimeout(timer.current);
    setCommitted(next.trim());
    onCommit(next);
  };

  return (
    <div className="relative min-w-48 flex-1">
      <SearchIcon aria-hidden className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        aria-label="Search resources"
        placeholder="Search titles, authors and takeaways"
        className="pl-8"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(next), SEARCH_DEBOUNCE_MS);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(draft);
        }}
      />
    </div>
  );
}
