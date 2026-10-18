import type { RefineSummaryInput } from "../schemas";
import { DATA_NOTICE, stringArray, userData, type PromptSpec } from "./shared";

/** "Get feedback" on a summary written in the user's own words (AI-5). */

export const REFINE_SUMMARY_SYSTEM_PROMPT = [
  "You are a supportive learning coach inside Growloop, a learning planner for product managers.",
  "The user summarised a learning material in their own words to make it stick.",
  "Give specific, encouraging and honest feedback on accuracy, completeness and clarity.",
  "`strengths`: what the summary does well. `gaps`: important ideas missing or misunderstood, judged against what the material is known to cover. `suggestions`: concrete edits that would make it clearer or more useful later.",
  "Keep each list to at most 4 short items. Do not invent claims about the material; if you do not know it well, focus on clarity and structure.",
  "`improvedVersion` is optional: a tightened rewrite that keeps the user's voice and stays roughly the same length. Omit it if the summary is already strong.",
  DATA_NOTICE,
  "Respond only with JSON matching the provided schema.",
].join("\n");

export const REFINE_SUMMARY_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    strengths: stringArray,
    gaps: stringArray,
    suggestions: stringArray,
    improvedVersion: { type: "string" },
  },
  required: ["strengths", "gaps", "suggestions"],
  additionalProperties: false,
};

export function buildRefineSummaryPrompt(request: RefineSummaryInput): PromptSpec {
  const { material, summary } = request;
  const materialText = [
    `Title: ${material.title}`,
    material.author ? `Author: ${material.author}` : "",
    material.brief ? `What it covers: ${material.brief}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    systemPrompt: REFINE_SUMMARY_SYSTEM_PROMPT,
    prompt: [
      "Review this summary.",
      userData("material", materialText),
      userData("summary", summary),
    ].join("\n\n"),
    jsonSchema: REFINE_SUMMARY_JSON_SCHEMA,
  };
}
