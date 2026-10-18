"use client";

import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreHydrated } from "@/lib/store/hydration";
import { createNoteAndOpen } from "./use-notebook-params";

/** "+ New note" in the Notebook header. Waits for saved data, so a new note is never overwritten by loading. */
export function NewNoteButton() {
  const hydrated = useStoreHydrated();
  return (
    <Button size="sm" disabled={!hydrated} onClick={createNoteAndOpen}>
      <PlusIcon aria-hidden />
      New note
    </Button>
  );
}

/** The data gate's placeholder for the Notebook: two panes on desktop, the list below 1024 px. */
export function NotebookSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-full max-w-xl" />
      <div className="grid gap-6 lg:grid-cols-[22.5rem_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
        <Skeleton className="hidden h-72 w-full lg:block" />
      </div>
    </div>
  );
}
