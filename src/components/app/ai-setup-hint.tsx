"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AIStatusState } from "@/lib/ai/use-ai";
import { cn } from "@/lib/utils";

type Unavailable = Extract<AIStatusState, { state: "unavailable" }>;

/** "Turn on Claude", linking to the Claude section of Settings (the one AI-off pattern everywhere). */
export function TurnOnClaudeLink({ children = "Turn on Claude" }: { children?: React.ReactNode }) {
  return (
    <Link href="/settings#claude" className="font-medium text-foreground underline underline-offset-4">
      {children}
    </Link>
  );
}

/**
 * Shown when Claude is off: a feature-specific lead with a "Turn on Claude"
 * link (own key, works on the hosted site), and running Claude Code locally
 * as a secondary note.
 */
export function AISetupHint({
  status,
  onRecheck,
  children,
  className,
}: {
  status: Unavailable;
  onRecheck?: () => void;
  /** The lead, including a <TurnOnClaudeLink />. */
  children: React.ReactNode;
  className?: string;
}) {
  // "demo-mode" / "disabled": not on localhost, so the CLI can't be used here at all.
  const hosted = status.code === "demo-mode" || status.code === "disabled";

  return (
    <div className={cn("flex flex-col gap-1 text-sm text-muted-foreground", className)}>
      <p>{children}</p>
      <p className="flex flex-wrap items-center gap-x-2 text-xs">
        {hosted ? (
          <span>Running Growloop on your own computer? It can use your Claude Code instead.</span>
        ) : (
          <>
            <span>Or use Claude Code on this computer{status.reason ? `: ${status.reason}` : "."}</span>
            {onRecheck && (
              <Button variant="ghost" size="xs" onClick={onRecheck}>
                Check again
              </Button>
            )}
          </>
        )}
      </p>
    </div>
  );
}
