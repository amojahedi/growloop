"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanDraft } from "@/lib/domain/plan-draft";
import { offProvider, type AIProvider, type AIProviderKind } from "./provider";
import { localProvider } from "./providers/local";
import { ownKeyProvider } from "./providers/own-key";
import { AIRequestError } from "./request-error";
import type {
  DraftPlanRequest,
  EnrichMaterialRequest,
  MaterialDraft,
  RecommendRequest,
  RecommendResponse,
  RefineSummaryRequest,
  SummaryFeedback,
} from "./schemas";
import { useAIStatus, type LocalClaudeStatus } from "./status";

export { useAIStatus, useLocalClaudeStatus, type AIStatusInfo, type LocalClaudeStatus } from "./status";

/**
 * React access to the Claude features: which provider is active, plus one
 * async action per feature, each with its own loading / error / data state.
 *
 * Provider order (ADR 008): the visitor's own Claude API key → the local
 * Claude Code CLI (only when `/api/ai/status` says it's available) → off.
 *
 *   const ai = useAI();
 *   if (ai.status.state === "available") ai.recommend.run({ context, existingTitles });
 */

/** "available" with a key or local Claude Code; otherwise the local check's state. */
export type AIStatusState = LocalClaudeStatus;

export interface AsyncAction<Input, Output> {
  /** Resolves with the result, or `undefined` if the call failed or was superseded. */
  run: (input: Input) => Promise<Output | undefined>;
  data: Output | undefined;
  error: AIRequestError | undefined;
  /** The error from the latest `run`, readable right after it resolves (state updates land later). */
  lastError: () => AIRequestError | undefined;
  loading: boolean;
  /** Clears data and error, and cancels a call in flight. */
  reset: () => void;
}

function useAsyncAction<Input, Output>(
  request: (input: Input, signal: AbortSignal) => Promise<Output>,
): AsyncAction<Input, Output> {
  const [data, setData] = useState<Output>();
  // Tagged with the request that failed, so an error (e.g. "key rejected") clears once the provider changes.
  const [failure, setFailure] = useState<{ request: typeof request; error: AIRequestError }>();
  const error = failure?.request === request ? failure.error : undefined;
  const lastErrorRef = useRef<AIRequestError | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  // Cancel a call in flight on unmount, and when the provider behind `request` changes
  // (e.g. the key was forgotten): its result must not appear under the new provider.
  useEffect(() => () => controllerRef.current?.abort(), [request]);

  const run = useCallback(
    async (input: Input) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);
      setFailure(undefined);
      lastErrorRef.current = undefined;

      try {
        const result = await request(input, controller.signal);
        if (controller.signal.aborted) return undefined;
        setData(result);
        return result;
      } catch (caught) {
        if (controller.signal.aborted) return undefined;
        const failed =
          caught instanceof AIRequestError ? caught : new AIRequestError("Something went wrong.", "process-failed");
        lastErrorRef.current = failed;
        setFailure({ request, error: failed });
        return undefined;
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setLoading(false);
        }
      }
    },
    [request],
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setData(undefined);
    setFailure(undefined);
    lastErrorRef.current = undefined;
    setLoading(false);
  }, []);

  const lastError = useCallback(() => lastErrorRef.current, []);

  return { run, data, error, lastError, loading, reset };
}

export interface UseAI {
  /** Where Claude calls go: "key", "local", or null while checking or when Claude is off. */
  provider: AIProviderKind | null;
  status: AIStatusState;
  /** Re-checks local availability, e.g. after the user installs or signs in to Claude Code. */
  recheck: () => void;
  recommend: AsyncAction<RecommendRequest, RecommendResponse>;
  refineSummary: AsyncAction<RefineSummaryRequest, SummaryFeedback>;
  /** Drafts a resource's details from a pasted title or link. */
  enrichMaterial: AsyncAction<EnrichMaterialRequest, MaterialDraft>;
  /** Drafts the OKR wizard's plan; repair it before review. Fails with code "timeout" after 60 s. */
  draftPlan: AsyncAction<DraftPlanRequest, PlanDraft>;
}

const PROVIDERS: Record<AIProviderKind, AIProvider> = { key: ownKeyProvider, local: localProvider };

export function useAI(): UseAI {
  const { provider, local, recheck } = useAIStatus();
  const active = provider ? PROVIDERS[provider] : offProvider;

  return {
    provider,
    status: provider === "key" ? { state: "available" } : local,
    recheck,
    recommend: useAsyncAction(active.recommend),
    refineSummary: useAsyncAction(active.refineSummary),
    enrichMaterial: useAsyncAction(active.enrichMaterial),
    draftPlan: useAsyncAction(active.draftPlan),
  };
}
