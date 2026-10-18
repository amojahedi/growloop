"use client";

import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNewerVersionInAnotherTab } from "@/lib/store/hydration";

/**
 * Another tab saved the workspace with a newer build. This tab stops following
 * its changes (so two builds never fight over the data) and offers a reload.
 */
export function UpdateBanner() {
  const newer = useNewerVersionInAnotherTab();
  if (!newer) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 border-b border-border bg-brand-soft px-4 py-2.5 text-sm text-brand-soft-foreground md:px-9"
    >
      <RefreshCwIcon className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">Growloop was updated in another tab. Reload to keep going here.</p>
      <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
        Reload
      </Button>
    </div>
  );
}
