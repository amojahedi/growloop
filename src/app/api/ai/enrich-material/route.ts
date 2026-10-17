import { askClaude } from "@/lib/ai/claude-cli";
import { buildEnrichMaterialPrompt } from "@/lib/ai/prompts";
import { aiFailureResponse, readJsonBody, rejectDisallowedRequest } from "@/lib/ai/route-helpers";
import { enrichMaterialRequestSchema, materialDraftSchema, restrictDraftSkills, type MaterialDraft } from "@/lib/ai/schemas";

/** POST /api/ai/enrich-material → a reviewable draft of a resource from a pasted title or link (ML-2). */
export async function POST(request: Request) {
  const rejection = rejectDisallowedRequest(request);
  if (rejection) return rejection;

  const body = await readJsonBody(request, enrichMaterialRequestSchema);
  if (body.response) return body.response;

  try {
    const draft = await askClaude({ ...buildEnrichMaterialPrompt(body.data), schema: materialDraftSchema, signal: request.signal });
    // The JSON schema already limits skill ids; this enforces it even if the CLI doesn't.
    return Response.json(restrictDraftSkills(draft, body.data.skills) satisfies MaterialDraft);
  } catch (error) {
    return aiFailureResponse(error);
  }
}
