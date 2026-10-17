import { askClaude } from "@/lib/ai/claude-cli";
import { buildRefineSummaryPrompt } from "@/lib/ai/prompts";
import { aiFailureResponse, readJsonBody, rejectDisallowedRequest } from "@/lib/ai/route-helpers";
import { refineSummaryRequestSchema, summaryFeedbackSchema, type SummaryFeedback } from "@/lib/ai/schemas";

/** POST /api/ai/refine-summary → feedback on a summary written in the user's own words. */
export async function POST(request: Request) {
  const rejection = rejectDisallowedRequest(request);
  if (rejection) return rejection;

  const body = await readJsonBody(request, refineSummaryRequestSchema);
  if (body.response) return body.response;

  try {
    const result = await askClaude({ ...buildRefineSummaryPrompt(body.data), schema: summaryFeedbackSchema });
    return Response.json(result satisfies SummaryFeedback);
  } catch (error) {
    return aiFailureResponse(error);
  }
}
