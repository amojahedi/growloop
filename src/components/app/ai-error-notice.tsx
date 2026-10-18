"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { forgetApiKey } from "@/lib/ai/providers/key-storage";
import type { AIRequestError } from "@/lib/ai/request-error";
import { useLocalClaudeStatus } from "@/lib/ai/use-ai";
import { cn } from "@/lib/utils";

/**
 * A failed Claude action. A rejected key never silently falls back to Claude
 * Code (settings spec, ADR 008): it says so and offers to forget the key, and,
 * when Claude Code is available here, to use it instead (which also forgets
 * the key, since a saved key always wins).
 */
export function AIErrorNotice({ error, className }: { error: AIRequestError; className?: string }) {
  const rejected = error.code === "key-rejected";
  const local = useLocalClaudeStatus({ enabled: rejected });

  return (
    <div className={cn("flex flex-col gap-1 text-sm", className)} role="alert">
      <p className="text-destructive">
        {rejected ? (
          <>
            Your Claude key was rejected. Check it in{" "}
            <Link href="/settings#claude" className="underline underline-offset-4">
              Settings
            </Link>
            .
          </>
        ) : (
          error.message
        )}
      </p>
      {rejected && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="xs" onClick={forgetApiKey}>
            Forget key
          </Button>
          {local.status.state === "available" && (
            <Button type="button" variant="outline" size="xs" onClick={forgetApiKey}>
              Use Claude Code instead
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
