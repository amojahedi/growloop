"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { now } from "@/lib/clock";
import { dayKey } from "@/lib/domain/dates";
import { deleteBackup, readBackups, saveBackup, useBackup } from "@/lib/store/backup";

function download(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `growloop-backup-${dayKey(now())}.json` });
  link.click();
  URL.revokeObjectURL(url);
}

/** Deletes every kept backup at once, with Undo instead of a confirm (specs/README.md §Undo over confirm). */
export function deleteBackupsWithUndo(): void {
  const kept = readBackups();
  deleteBackup();
  toast({
    message: "Backup deleted.",
    // Oldest first, so the newest ends up first again.
    action: { label: "Undo", onClick: () => [...kept].reverse().forEach((backup) => saveBackup(backup.raw)) },
  });
}

/**
 * Tells the user when saved data couldn't be read (navigation-and-empty-states.md
 * §Errors), and offers the kept copy for download until it is deleted.
 */
export function BackupBanner() {
  const backup = useBackup();
  if (!backup) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-brand-soft px-4 py-2.5 text-sm text-brand-soft-foreground md:px-9"
    >
      <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1">
        Your saved data couldn&apos;t be read, so Growloop started fresh. A copy of the old data was kept.
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => download(backup)}>
          Download backup
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            deleteBackupsWithUndo();
            // The banner (and this button) goes away: keep keyboard focus on the page.
            document.getElementById("content")?.focus();
          }}
        >
          Delete backup
        </Button>
      </div>
    </div>
  );
}
