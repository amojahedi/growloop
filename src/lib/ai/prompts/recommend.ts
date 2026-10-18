import { MAX_RECOMMENDATIONS, type RecommendInput } from "../schemas";
import { DATA_NOTICE, userData, type PromptSpec } from "./shared";

/** "Recommend materials" for a skill or objective (AI-4). */

export const RECOMMEND_SYSTEM_PROMPT = [
  "You are a learning advisor for product managers inside Growloop, a learning planner.",
  `Recommend up to ${MAX_RECOMMENDATIONS} high-quality learning materials (courses, certifications, books, articles, podcasts).`,
  "Only recommend real resources that you are confident exist, with their real title and author or provider.",
  "Never invent titles, authors or URLs. If you are not sure a resource exists, leave it out; returning fewer items is better than guessing.",
  "Only include a URL when you are confident it is the resource's canonical, long-lived address; otherwise omit it.",
  "Prefer well-regarded, practical resources and a mix of formats and depths.",
  "Each `why` is one or two sentences, written to the user, explaining how the resource helps with their goal.",
  "`estimatedHours` is a rough time to complete; omit it if you cannot estimate sensibly.",
  DATA_NOTICE,
  "Respond only with JSON matching the provided schema.",
].join("\n");

export const RECOMMEND_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      maxItems: MAX_RECOMMENDATIONS,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          author: { type: "string", description: "Author(s), host or provider." },
          type: { type: "string", enum: ["course", "certification", "book", "article", "podcast"] },
          url: { type: "string", description: "Canonical https URL; omit unless confident." },
          why: { type: "string" },
          estimatedHours: { type: "number" },
        },
        required: ["title", "author", "type", "why"],
        additionalProperties: false,
      },
    },
  },
  required: ["recommendations"],
  additionalProperties: false,
};

export function buildRecommendPrompt(request: RecommendInput): PromptSpec {
  const { context } = request;
  const goal =
    context.kind === "skill"
      ? [
          "Recommend materials to build this product skill.",
          userData("skill", [context.name, context.description].filter(Boolean).join("\n\n")),
        ]
      : [
          "Recommend materials that help achieve this quarterly learning objective.",
          userData(
            "objective",
            [
              context.title,
              context.description,
              context.keyResults?.length ? `Key results:\n${context.keyResults.map((kr) => `- ${kr}`).join("\n")}` : "",
              context.skills?.length ? `Related skills: ${context.skills.join(", ")}` : "",
            ]
              .filter(Boolean)
              .join("\n\n"),
          ),
        ];

  const existing = request.existingTitles;
  const exclusions = existing.length
    ? [
        "The user already has these materials. Do not recommend them again:",
        userData("existing_titles", existing.map((title) => `- ${title}`).join("\n")),
      ]
    : [];

  return {
    systemPrompt: RECOMMEND_SYSTEM_PROMPT,
    prompt: [...goal, ...exclusions].join("\n\n"),
    jsonSchema: RECOMMEND_JSON_SCHEMA,
  };
}
