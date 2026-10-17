"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useClaudeApiKey } from "./api-key-storage";
import { fetchAIStatus } from "./client";
import { offProvider, selectProviderKind, type AIProvider, type AIProviderKind } from "./provider";
import { localProvider } from "./providers/local";
import { createOwnKeyProvider } from "./providers/own-key";
import { AIRequestError } from "./request-error";
import type {
  AIStatus,
  DraftOkrsRequest,
  EnrichMaterialRequest,
  MaterialDraft,
  OkrDraft,
  RecommendRequest,
  RecommendResponse,
  RefineSummaryRequest,
  SummaryFeedback,
} from "./schemas";

/**
 * React access to the AI features: which provider is active, plus one async
 * action per feature, each with its own loading / error / data state.
 *
 * Provider order (ADR 008): the visitor's own Claude API key → the local
 * Claude Code CLI (only when `/api/ai/status` says it's available) → off.
 *
 *   const ai = useAI();
 *   if (ai.status.state === "available") ai.recommend.run({ context, existingTitles });
 */

export type AIStatusState =
  | { state: "checking" }
  | { state: "available" }
  /** No key and no local Claude Code; `reason` and `code` describe the local check. */
  | { state: "unavailable"; reason?: string; code?: AIStatus["code"] };

export interface AsyncAction<Input, Output> {
  /** Resolves with the result, or `undefined` if the call failed or was superseded. */
  run: (input: Input) => Promise<Output | undefined>;
  data: Output | undefined;
  error: AIRequestError | undefined;
  loading: boolean;
  /** Clears data and error, and cancels a call in flight. */
  reset: () => void;
}

// One status request per page load, shared by every component using the hook.
let statusPromise: Promise<AIStatus> | undefined;

function loadStatus(fresh: boolean): Promise<AIStatus> {
  if (fresh || !statusPromise) {
    statusPromise = fetchAIStatus({ fresh }).catch((error: unknown) => {
      statusPromise = undefined; // allow a retry
      return {
        available: false,
        code: "error",
        reason: error instanceof Error ? error.message : "Couldn't check AI availability.",
      } satisfies AIStatus;
    });
  }
  return statusPromise;
}

const toStatusState = (status: AIStatus): AIStatusState =>
  status.available ? { state: "available" } : { state: "unavailable", reason: status.reason, code: status.code };

function useAsyncAction<Input, Output>(
  request: (input: Input, signal: AbortSignal) => Promise<Output>,
): AsyncAction<Input, Output> {
  const [data, setData] = useState<Output>();
  const [error, setError] = useState<AIRequestError>();
  const [loading, setLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const run = useCallback(
    async (input: Input) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setLoading(true);
      setError(undefined);

      try {
        const result = await request(input, controller.signal);
        if (controller.signal.aborted) return undefined;
        setData(result);
        return result;
      } catch (caught) {
        if (controller.signal.aborted) return undefined;
        setError(caught instanceof AIRequestError ? caught : new AIRequestError("Something went wrong.", "process-failed"));
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
    setError(undefined);
    setLoading(false);
  }, []);

  return { run, data, error, loading, reset };
}

export interface UseAI {
  /** Where AI calls go; "off" while checking or when neither a key nor local Claude Code is available. */
  provider: AIProviderKind;
  status: AIStatusState;
  /** Re-checks local availability, e.g. after the user installs or signs in to Claude Code. */
  recheck: () => void;
  recommend: AsyncAction<RecommendRequest, RecommendResponse>;
  refineSummary: AsyncAction<RefineSummaryRequest, SummaryFeedback>;
  /** Drafts a resource's details from a pasted title or link. */
  enrichMaterial: AsyncAction<EnrichMaterialRequest, MaterialDraft>;
  /** Drafts objectives for the OKR wizard. The providers don't implement it yet. */
  draftOkrs: AsyncAction<DraftOkrsRequest, OkrDraft>;
}

export function useAI(): UseAI {
  const apiKey = useClaudeApiKey();
  const hasKey = apiKey !== null;
  const [localStatus, setLocalStatus] = useState<AIStatusState>({ state: "checking" });

  const check = useCallback((fresh: boolean) => {
    let active = true;
    loadStatus(fresh).then((result) => {
      if (active) setLocalStatus(toStatusState(result));
    });
    return () => {
      active = false;
    };
  }, []);

  // With a key the local CLI is never used, so skip its status check (which spawns processes).
  useEffect(() => (hasKey ? undefined : check(false)), [hasKey, check]);

  const recheck = useCallback(() => {
    setLocalStatus({ state: "checking" });
    check(true);
  }, [check]);

  const provider = selectProviderKind({ apiKey, localAvailable: localStatus.state === "available" });
  const active = useMemo<AIProvider>(() => {
    if (provider === "own-key" && apiKey) return createOwnKeyProvider(apiKey);
    return provider === "local" ? localProvider : offProvider;
  }, [provider, apiKey]);

  return {
    provider,
    status: hasKey ? { state: "available" } : localStatus,
    recheck,
    recommend: useAsyncAction(active.recommend),
    refineSummary: useAsyncAction(active.refineSummary),
    enrichMaterial: useAsyncAction(active.enrichMaterial),
    draftOkrs: useAsyncAction(active.draftOkrs),
  };
}
