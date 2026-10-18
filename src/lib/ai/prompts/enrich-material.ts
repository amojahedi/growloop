import type { EnrichMaterialInput } from "../schemas";
import { DATA_NOTICE, userData, type PromptSpec } from "./shared";

/** "Add your own": a resource's details from a pasted title or link (AI-3). */

export const MAX_DRAFT_SKILLS = 3;

export const ENRICH_MATERIAL_SYSTEM_PROMPT = [
  "You help a product manager add a learning resource to Growloop, a learning planner.",
  "The user pasted a title or a link. Identify the resource from your own knowledge; you cannot open links.",
  'Don\'t invent facts. Fill a field only when you are confident it is accurate for this specific resource. When unsure, leave text fields empty ("") and omit optional fields; the user reviews and completes the draft.',
  'If you don\'t recognise the resource, return the pasted title as `title` (or "" for a bare link), type "custom", and leave everything else empty.',
  '`type`: course, certification, book, article or podcast; "custom" when it is none of these or you are unsure.',
  "`title`: the resource's real title. `author`: author(s), host or provider.",
  "`url`: only the resource's canonical https address, and only when you are confident; otherwise omit it.",
  "`tagline`: one short line on why it is worth the time. `summary`: two or three sentences on what it covers, in your own words; never copy publisher text.",
  `\`skillIds\`: at most ${MAX_DRAFT_SKILLS} ids from the provided skill list that clearly fit; never use an id that is not in the list. An empty list is fine.`,
  "`estimatedHours`: rough time to complete. `level` and `cost`: the usual audience level and price model. Omit any of these when unsure.",
  DATA_NOTICE,
  "Respond only with JSON matching the provided schema.",
].join("\n");

/** The output schema; `skillIds` is limited to the user's own skill ids. */
export function enrichMaterialJsonSchema(skillIds: readonly string[]): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      type: { type: "string", enum: ["course", "certification", "book", "article", "podcast", "custom"] },
      title: { type: "string" },
      author: { type: "string", description: "Author(s), host or provider; empty when unsure." },
      url: { type: "string", description: "Canonical https URL; omit unless confident." },
      tagline: { type: "string" },
      summary: { type: "string" },
      skillIds:
        skillIds.length > 0
          ? { type: "array", maxItems: MAX_DRAFT_SKILLS, items: { type: "string", enum: [...skillIds] } }
          : { type: "array", maxItems: 0, items: { type: "string" } },
      estimatedHours: { type: "number" },
      level: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
      cost: { type: "string", enum: ["free", "freemium", "paid"] },
    },
    required: ["type", "title", "author", "tagline", "summary", "skillIds"],
    additionalProperties: false,
  };
}

export function buildEnrichMaterialPrompt(request: EnrichMaterialInput): PromptSpec {
  const skills = request.skills.length
    ? [
        "Skills to choose from (id: name):",
        userData("skills", request.skills.map((skill) => `${skill.id}: ${skill.name}`).join("\n")),
      ]
    : ["There are no skills to choose from; return an empty `skillIds` list."];

  return {
    systemPrompt: ENRICH_MATERIAL_SYSTEM_PROMPT,
    prompt: ["Identify this learning resource and draft its details.", userData("pasted", request.input), ...skills].join(
      "\n\n",
    ),
    jsonSchema: enrichMaterialJsonSchema(request.skills.map((skill) => skill.id)),
  };
}
