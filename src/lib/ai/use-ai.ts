"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AIRequestError, fetchAIStatus, requestMaterialDraft, requestRecommendations, requestSummaryFeedback } from "./client";
import type {
  AIStatus,
  EnrichMaterialRequest,
  MaterialDraft,
  RecommendRequest,
  RecommendResponse,
  RefineSummaryRequest,
  SummaryFeedback,
} from "./schemas";

/**
 * React access to the local AI features: availability plus one async action
 * per feature, each with its own loading / error / data state.
 *
 *   const ai = useAI();
 *   if (ai.status.state === "available") ai.recommend.run({ context, existingTitles });
 */

export type AIStatusState =
  | { state: "checking" }
  | { state: "available" }
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
  status: AIStatusState;
  /** Re-checks availability, e.g. after the user installs or signs in to Claude Code. */
  recheck: () => void;
  recommend: AsyncAction<RecommendRequest, RecommendResponse>;
  refineSummary: AsyncAction<RefineSummaryRequest, SummaryFeedback>;
  /** Drafts a resource's details from a pasted title or link. */
  enrichMaterial: AsyncAction<EnrichMaterialRequest, MaterialDraft>;
}

export function useAI(): UseAI {
  const [status, setStatus] = useState<AIStatusState>({ state: "checking" });

  const check = useCallback((fresh: boolean) => {
    let active = true;
    loadStatus(fresh).then((result) => {
      if (active) setStatus(toStatusState(result));
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => check(false), [check]);

  const recheck = useCallback(() => {
    setStatus({ state: "checking" });
    check(true);
  }, [check]);

  return {
    status,
    recheck,
    recommend: useAsyncAction(requestRecommendations),
    refineSummary: useAsyncAction(requestSummaryFeedback),
    enrichMaterial: useAsyncAction(requestMaterialDraft),
  };
}
