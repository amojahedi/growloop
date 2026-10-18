import { requestDraftPlan, requestMaterialDraft, requestRecommendations, requestSummaryFeedback } from "../client";
import type { AIProvider } from "../provider";

/**
 * The local Claude Code CLI (ADR 004), reached through the `/api/ai/*` routes.
 * Those routes only answer on localhost; `useAI()` picks this provider only
 * when `/api/ai/status` reports Claude Code as available.
 */
export const localProvider: AIProvider = {
  kind: "local",
  recommend: requestRecommendations,
  refineSummary: requestSummaryFeedback,
  enrichMaterial: requestMaterialDraft,
  draftPlan: requestDraftPlan,
};
