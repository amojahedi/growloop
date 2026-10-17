import { askClaude } from "@/lib/ai/claude-cli";
import { buildRecommendPrompt } from "@/lib/ai/prompts";
import { aiFailureResponse, readJsonBody, rejectDisallowedRequest } from "@/lib/ai/route-helpers";
import { recommendRequestSchema, recommendationsSchema, type RecommendResponse } from "@/lib/ai/schemas";

/** POST /api/ai/recommend → up to five real materials for a skill or objective. */
export async function POST(request: Request) {
  const rejection = rejectDisallowedRequest(request);
  if (rejection) return rejection;

  const body = await readJsonBody(request, recommendRequestSchema);
  if (body.response) return body.response;

  try {
    const result = await askClaude({ ...buildRecommendPrompt(body.data), schema: recommendationsSchema });
    return Response.json(result satisfies RecommendResponse);
  } catch (error) {
    return aiFailureResponse(error);
  }
}
