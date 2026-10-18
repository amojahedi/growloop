import type { PlanDraft } from "@/lib/domain/plan-draft";
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

/**
 * One client-side interface for every Claude feature (ADR 008), backed by one of:
 *  - "key":   the visitor's own Claude API key, called directly from the browser;
 *  - "local": the local Claude Code CLI via the `/api/ai/*` routes (localhost only);
 *  - null:    Claude is off; every call rejects with a friendly error.
 *
 * The names match the settings spec (`provider: "key" | "local" | null`).
 * Both real providers use the same prompts (`prompts/`) and validate answers
 * with the same zod schemas (`schemas.ts`), so they return identical shapes.
 */

export type AIProviderKind = "key" | "local";

export interface AIProvider {
  /** null for the "off" provider. */
  readonly kind: AIProviderKind | null;
  /** Up to five real materials for a skill or objective. */
  recommend: (input: RecommendRequest, signal?: AbortSignal) => Promise<RecommendResponse>;
  /** Feedback on a summary written in the user's own words. */
  refineSummary: (input: RefineSummaryRequest, signal?: AbortSignal) => Promise<SummaryFeedback>;
  /** A reviewable draft of a resource from a pasted title or link. */
  enrichMaterial: (input: EnrichMaterialRequest, signal?: AbortSignal) => Promise<MaterialDraft>;
  /** The OKR wizard's draft plan (unrepaired: run the shared repair step before review). Gives up after 60 s. */
  draftPlan: (input: DraftPlanRequest, signal?: AbortSignal) => Promise<PlanDraft>;
}

/** Provider order: own key → local Claude Code (only when available) → off (null). */
export function selectProviderKind({
  hasKey,
  localAvailable,
}: {
  hasKey: boolean;
  localAvailable: boolean;
}): AIProviderKind | null {
  if (hasKey) return "key";
  if (localAvailable) return "local";
  return null;
}

export const AI_OFF_MESSAGE = "Claude is off. Turn it on in Settings.";

const rejectOff = () => Promise.reject(new AIRequestError(AI_OFF_MESSAGE, "off"));

export const offProvider: AIProvider = {
  kind: null,
  recommend: rejectOff,
  refineSummary: rejectOff,
  enrichMaterial: rejectOff,
  draftPlan: rejectOff,
};
