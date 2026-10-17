"use client";

import { useState } from "react";
import { Section } from "@/components/app/section";
import { Button } from "@/components/ui/button";
import type { RecommendRequest } from "@/lib/ai/schemas";
import { useAI } from "@/lib/ai/use-ai";
import { useActions } from "@/lib/store/hooks";

interface AIRecommendationsProps {
  context: RecommendRequest["context"];
  existingTitles: string[];
  /** Skills to tag saved recommendations with. */
  skillIds?: string[];
}

/** "Recommend materials" via the local Claude Code CLI (L-6). Degrades to a setup hint when unavailable. */
export function AIRecommendations({ context, existingTitles, skillIds = [] }: AIRecommendationsProps) {
  const { status, recheck, recommend } = useAI();
  const { addCustomMaterial } = useActions();
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());

  return (
    <Section title="AI recommendations" description="Suggested by Claude Code running on your machine">
      {status.state === "checking" && <p className="text-sm text-muted-foreground">Checking for Claude Code…</p>}

      {status.state === "unavailable" && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span>{status.reason}</span>
          {status.code !== "demo-mode" && status.code !== "disabled" && (
            <Button variant="ghost" size="xs" onClick={recheck}>
              Check again
            </Button>
          )}
        </div>
      )}

      {status.state === "available" && (
        <div className="flex flex-col gap-3">
          <Button
            className="self-start"
            size="sm"
            disabled={recommend.loading}
            onClick={() => recommend.run({ context, existingTitles })}
          >
            {recommend.loading ? "Asking Claude…" : "Recommend materials"}
          </Button>
          {recommend.error && <p className="text-sm text-destructive">{recommend.error.message}</p>}
          {recommend.data && (
            <ul className="divide-y">
              {recommend.data.recommendations.map((recommendation) => (
                <li key={recommendation.title} className="flex flex-wrap items-start justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">
                      {recommendation.title} <span className="font-normal text-muted-foreground">· {recommendation.author}</span>
                    </p>
                    <p className="text-muted-foreground">{recommendation.why}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={saved.has(recommendation.title)}
                    onClick={() => {
                      setSaved((current) => new Set(current).add(recommendation.title));
                      addCustomMaterial({
                        title: recommendation.title,
                        author: recommendation.author,
                        type: recommendation.type,
                        url: recommendation.url,
                        estimatedHours: recommendation.estimatedHours,
                        summary: recommendation.why,
                        skillIds,
                      });
                    }}
                  >
                    {saved.has(recommendation.title) ? "Saved" : "Save to library"}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Section>
  );
}
