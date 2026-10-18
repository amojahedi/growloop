"use client";

import { useState } from "react";
import { AIErrorNotice } from "@/components/app/ai-error-notice";
import { AISetupHint, TurnOnClaudeLink } from "@/components/app/ai-setup-hint";
import { Section } from "@/components/app/section";
import { Button } from "@/components/ui/button";
import type { AIProviderKind } from "@/lib/ai/provider";
import type { RecommendRequest } from "@/lib/ai/schemas";
import { useAI } from "@/lib/ai/use-ai";
import { useActions } from "@/lib/store/hooks";

interface AIRecommendationsProps {
  context: RecommendRequest["context"];
  existingTitles: string[];
  /** Skills to tag saved recommendations with. */
  skillIds?: string[];
}

const DESCRIPTIONS: Record<AIProviderKind, string> = {
  "own-key": "Suggested by Claude, using your API key",
  local: "Suggested by Claude Code running on your machine",
  off: "Suggested by Claude",
};

/** "Recommend materials" via the active AI provider (L-6). Degrades to a setup hint when AI is off. */
export function AIRecommendations({ context, existingTitles, skillIds = [] }: AIRecommendationsProps) {
  const { provider, status, recheck, recommend } = useAI();
  const { addCustomMaterial } = useActions();
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set());

  return (
    <Section title="AI recommendations" description={DESCRIPTIONS[provider]}>
      {status.state === "checking" && <p className="text-sm text-muted-foreground">Checking AI…</p>}

      {status.state === "unavailable" && (
        <AISetupHint status={status} onRecheck={recheck}>
          Want picks for {context.kind === "skill" ? context.name : context.title}? <TurnOnClaudeLink />.
        </AISetupHint>
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
          {recommend.error && <AIErrorNotice error={recommend.error} />}
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
                    aria-label={`${saved.has(recommendation.title) ? "Saved" : "Save"} "${recommendation.title}" to library`}
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
