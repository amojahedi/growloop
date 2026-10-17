"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dayKey } from "@/lib/domain/dates";
import { deleteBackup, useBackup } from "@/lib/store/backup";

function download(content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const link = Object.assign(document.createElement("a"), { href: url, download: `growloop-backup-${dayKey(new Date())}.json` });
  link.click();
  URL.revokeObjectURL(url);
}

/** Tells the user when saved data couldn't be read, and offers the kept copy for download. */
export function BackupBanner() {
  const backup = useBackup();
  if (!backup) return null;

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 border-b bg-brand-soft px-4 py-3 text-sm text-brand-soft-foreground md:px-6"
    >
      <TriangleAlertIcon className="size-4 shrink-0" aria-hidden />
      <p className="flex-1">
        Your saved data couldn&apos;t be read, so Growloop started fresh. A copy of the old data was kept.
      </p>
      <Button variant="outline" size="sm" onClick={() => download(backup)}>
        Download backup
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => window.confirm("Delete the backup? This cannot be undone.") && deleteBackup()}
      >
        Delete backup
      </Button>
    </div>
  );
}
