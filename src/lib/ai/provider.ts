import { AIRequestError } from "./request-error";
import type {
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
 * One client-side interface for every AI feature (ADR 008), backed by one of:
 *  - "own-key": the visitor's own Claude API key, called directly from the browser;
 *  - "local":   the local Claude Code CLI via the `/api/ai/*` routes (localhost only);
 *  - "off":     no AI; every call rejects with a friendly error.
 *
 * Both real providers use the same prompts (`prompts.ts`) and validate answers
 * with the same zod schemas (`schemas.ts`), so they return identical shapes.
 */

export type AIProviderKind = "own-key" | "local" | "off";

export interface AIProvider {
  readonly kind: AIProviderKind;
  /** Up to five real materials for a skill or objective. */
  recommend: (input: RecommendRequest, signal?: AbortSignal) => Promise<RecommendResponse>;
  /** Feedback on a summary written in the user's own words. */
  refineSummary: (input: RefineSummaryRequest, signal?: AbortSignal) => Promise<SummaryFeedback>;
  /** A reviewable draft of a resource from a pasted title or link. */
  enrichMaterial: (input: EnrichMaterialRequest, signal?: AbortSignal) => Promise<MaterialDraft>;
  /** Objectives and key results from the OKR wizard's answers. Not implemented yet. */
  draftOkrs: (input: DraftOkrsRequest, signal?: AbortSignal) => Promise<OkrDraft>;
}

/** Provider order: own key → local Claude Code (only when available) → off. */
export function selectProviderKind({
  apiKey,
  localAvailable,
}: {
  apiKey: string | null;
  localAvailable: boolean;
}): AIProviderKind {
  if (apiKey) return "own-key";
  if (localAvailable) return "local";
  return "off";
}

export const AI_OFF_MESSAGE = "AI is off. Add your Claude API key in Settings to turn it on.";

const rejectOff = () => Promise.reject(new AIRequestError(AI_OFF_MESSAGE, "off"));

export const offProvider: AIProvider = {
  kind: "off",
  recommend: rejectOff,
  refineSummary: rejectOff,
  enrichMaterial: rejectOff,
  draftOkrs: rejectOff,
};

/** Placeholder until the OKR wizard implements drafting (prompt + schema + provider calls). */
export const draftOkrsNotImplemented = (): Promise<never> =>
  Promise.reject(new AIRequestError("Drafting OKRs with AI isn't available yet.", "not-implemented"));
