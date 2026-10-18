"use client";

import { HardDriveIcon } from "lucide-react";
import { useStorageHealth, type StorageHealth } from "@/lib/store/storage-health";

const COPY: Record<Exclude<StorageHealth, "ok">, string> = {
  blocked: "Your browser is blocking storage, so changes last only until you close this tab.",
  full: "Your browser's storage is full, so new changes last only until you close this tab.",
};

/**
 * Says when changes can't be kept (navigation-and-empty-states.md §Errors):
 * storage blocked (e.g. a private window) or full. Not dismissible; "blocked"
 * lasts for the session, "full" clears once a later save works.
 */
export function StorageBanner() {
  const health = useStorageHealth();
  if (health === "ok") return null;

  return (
    <div
      role="alert"
      className="flex items-center gap-3 border-b border-border bg-brand-soft px-4 py-2.5 text-sm text-brand-soft-foreground md:px-9"
    >
      <HardDriveIcon className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">{COPY[health]}</p>
    </div>
  );
}
