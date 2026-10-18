"use client";

import Link from "next/link";
import { useAIStatus } from "@/lib/ai/status";
import { cn } from "@/lib/utils";

export type ClaudeStatusLabel = "Claude on" | "Claude off" | "Claude…";

/** The footer's words for the shared Claude status (NAV-3). */
export function claudeStatusLabel({ provider, checking }: { provider: unknown; checking: boolean }): ClaudeStatusLabel {
  if (provider) return "Claude on";
  return checking ? "Claude…" : "Claude off";
}

/** "Saved on this device" and the live Claude status, linking to Settings → Claude. */
export function SidebarFooter({ onNavigate }: { onNavigate?: () => void }) {
  const status = useAIStatus();
  const label = claudeStatusLabel(status);

  return (
    <div className="flex flex-col gap-1.5 rounded-2xl border border-sidebar-border bg-card/60 px-3 py-2.5 text-xs">
      <p className="text-muted-foreground">Saved on this device</p>
      <Link
        href="/settings#claude"
        onClick={onNavigate}
        className="flex items-center gap-2 rounded-md font-semibold text-sidebar-foreground underline-offset-4 hover:underline"
      >
        <span
          aria-hidden
          className={cn(
            "size-2 shrink-0 rounded-full",
            label === "Claude on" && "bg-chart-2 ring-3 ring-chart-2/20",
            label === "Claude off" && "bg-muted-foreground/60",
            label === "Claude…" && "bg-chart-3 motion-safe:animate-pulse",
          )}
        />
        {label}
      </Link>
    </div>
  );
}
