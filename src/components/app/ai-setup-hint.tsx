"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AIStatusState } from "@/lib/ai/use-ai";
import { cn } from "@/lib/utils";

type Unavailable = Extract<AIStatusState, { state: "unavailable" }>;

/**
 * Shown when AI is off. The main path is always the visitor's own key (works
 * on the hosted site); running Claude Code locally is a secondary note.
 */
export function AISetupHint({
  status,
  onRecheck,
  suffix,
  className,
}: {
  status: Unavailable;
  onRecheck?: () => void;
  /** Extra sentence after the main hint, e.g. what still works without AI. */
  suffix?: string;
  className?: string;
}) {
  // "demo-mode" / "disabled": not on localhost, so the CLI can't be used here at all.
  const hosted = status.code === "demo-mode" || status.code === "disabled";

  return (
    <div className={cn("flex flex-col gap-1 text-sm text-muted-foreground", className)}>
      <p>
        <Link href="/settings#claude" className="font-medium text-foreground underline underline-offset-4">
          Add your Claude API key in Settings
        </Link>{" "}
        to use AI.{suffix ? ` ${suffix}` : ""}
      </p>
      <p className="flex flex-wrap items-center gap-x-2 text-xs">
        {hosted ? (
          <span>Running Growloop on your own computer? It can use your Claude Code instead.</span>
        ) : (
          <>
            <span>
              Or use Claude Code on this computer{status.reason ? `: ${status.reason}` : "."}
            </span>
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
