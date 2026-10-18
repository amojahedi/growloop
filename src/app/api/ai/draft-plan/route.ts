import type { PlanDraft } from "@/lib/domain/plan-draft";
import { askClaude } from "@/lib/ai/claude-cli";
import { buildDraftPlanPrompt } from "@/lib/ai/prompts";
import { aiFailureResponse, readJsonBody, rejectDisallowedRequest } from "@/lib/ai/route-helpers";
import { DRAFT_PLAN_TIMEOUT_MS, draftPlanRequestSchema, planDraftSchema } from "@/lib/ai/schemas";

/** POST /api/ai/draft-plan → the OKR wizard's draft plan (unrepaired), from local Claude Code. */
export async function POST(request: Request) {
  const rejection = rejectDisallowedRequest(request);
  if (rejection) return rejection;

  const body = await readJsonBody(request, draftPlanRequestSchema);
  if (body.response) return body.response;

  try {
    const result = await askClaude({
      ...buildDraftPlanPrompt(body.data),
      schema: planDraftSchema,
      // The wizard gives up after this long, so don't keep a process running past it.
      timeoutMs: DRAFT_PLAN_TIMEOUT_MS,
      signal: request.signal,
    });
    return Response.json(result satisfies PlanDraft);
  } catch (error) {
    return aiFailureResponse(error);
  }
}
