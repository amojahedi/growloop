import type { z } from "zod";
import { isDemoMode } from "@/lib/env";
import {
  aiErrorResponseSchema,
  aiStatusSchema,
  limitExistingTitles,
  materialDraftSchema,
  recommendationsSchema,
  summaryFeedbackSchema,
  type AIStatus,
  type EnrichMaterialRequest,
  type MaterialDraft,
  type RecommendRequest,
  type RecommendResponse,
  type RefineSummaryRequest,
  type SummaryFeedback,
} from "./schemas";
import { AIRequestError } from "./request-error";

/** Browser-side calls to the local `/api/ai/*` routes (Claude Code bridge), with validated responses. */

export { AIRequestError };

export const DEMO_MODE_STATUS: AIStatus = {
  available: false,
  code: "demo-mode",
  reason: "Claude Code only runs when Growloop runs on your own computer.",
};

async function requestJson<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new AIRequestError("Couldn't reach the Growloop server.", "network");
  }

  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const error = aiErrorResponseSchema.safeParse(body);
    throw error.success
      ? new AIRequestError(error.data.error, error.data.code)
      : new AIRequestError(`Request failed (${response.status}).`, "process-failed");
  }

  const result = schema.safeParse(body);
  if (!result.success) throw new AIRequestError("The server sent an unexpected response.", "invalid-output");
  return result.data;
}

const postJson = (body: unknown, signal?: AbortSignal): RequestInit => ({
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
  signal,
});

export function fetchAIStatus({ fresh = false } = {}): Promise<AIStatus> {
  if (isDemoMode) return Promise.resolve(DEMO_MODE_STATUS);
  return requestJson(`/api/ai/status${fresh ? "?fresh" : ""}`, aiStatusSchema, { cache: "no-store" });
}

export function requestRecommendations(input: RecommendRequest, signal?: AbortSignal): Promise<RecommendResponse> {
  // Large libraries would make the payload (and prompt) huge; send a bounded list.
  const body = { ...input, existingTitles: limitExistingTitles(input.existingTitles ?? []) };
  return requestJson("/api/ai/recommend", recommendationsSchema, postJson(body, signal));
}

export function requestMaterialDraft(input: EnrichMaterialRequest, signal?: AbortSignal): Promise<MaterialDraft> {
  return requestJson("/api/ai/enrich-material", materialDraftSchema, postJson(input, signal));
}

export function requestSummaryFeedback(input: RefineSummaryRequest, signal?: AbortSignal): Promise<SummaryFeedback> {
  return requestJson("/api/ai/refine-summary", summaryFeedbackSchema, postJson(input, signal));
}
