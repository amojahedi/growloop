"use client";

import { SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export const NOTEBOOK_SEARCH_DEBOUNCE_MS = 300;

/**
 * "Search notes": commits after a short pause (or on Enter) and follows outside
 * changes such as Back or Clear filters without clobbering what is being typed.
 */
export function NotebookSearch({ value, onCommit }: { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [seen, setSeen] = useState(value);
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
        aria-label="Search notes"
        placeholder="Search notes"
        className="pl-8"
        value={draft}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => commit(next), NOTEBOOK_SEARCH_DEBOUNCE_MS);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(draft);
        }}
      />
    </div>
  );
}
