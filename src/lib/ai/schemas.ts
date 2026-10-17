import { z } from "zod";
import { MATERIAL_COSTS, MATERIAL_LEVELS, MATERIAL_TYPES } from "@/lib/domain/types";

/**
 * Request and response contracts for the local AI features. Shared by the
 * route handlers (server) and `useAI()` (client); contains no server code.
 */

// --- Status ---------------------------------------------------------------------

/** "disabled": the server isn't reached via localhost, so AI is off (e.g. a hosted deployment). */
export const aiUnavailableCodes = ["demo-mode", "disabled", "not-installed", "not-signed-in", "error"] as const;
export type AIUnavailableCode = (typeof aiUnavailableCodes)[number];

export const aiStatusSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  code: z.enum(aiUnavailableCodes).optional(),
});
export type AIStatus = z.infer<typeof aiStatusSchema>;

// --- Recommend materials --------------------------------------------------------

/** Trims and truncates instead of rejecting, so long titles never break a request. */
const clampedText = (max: number) => z.string().transform((value) => value.trim().slice(0, max));
const requiredText = (max: number) => clampedText(max).pipe(z.string().min(1));
/** Keeps the first `maxItems` entries, each truncated. `hardLimit` only rejects absurd payloads. */
const clampedList = (maxItems: number, maxLength: number, hardLimit = 2_000) =>
  z
    .array(z.string())
    .max(hardLimit)
    .transform((values) => values.map((value) => value.trim().slice(0, maxLength)).filter(Boolean).slice(0, maxItems));

export const MAX_EXISTING_TITLES = 150;
export const MAX_TITLE_LENGTH = 150;

/**
 * Prepares "already have these" titles for the prompt: trimmed, truncated,
 * de-duplicated and capped. Used by the client (small payloads) and the server.
 */
export function limitExistingTitles(titles: readonly string[]): string[] {
  const unique = new Set(titles.map((title) => title.trim().slice(0, MAX_TITLE_LENGTH)).filter(Boolean));
  return [...unique].slice(0, MAX_EXISTING_TITLES);
}

export const recommendRequestSchema = z.object({
  context: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("skill"),
      name: requiredText(100),
      description: clampedText(1000).optional(),
    }),
    z.object({
      kind: z.literal("objective"),
      title: requiredText(300),
      description: clampedText(1000).optional(),
      keyResults: clampedList(10, 300).optional(),
      skills: clampedList(20, 100).optional(),
    }),
  ]),
  /** Titles already in the library or plan, so they aren't suggested again. */
  existingTitles: z.array(z.string()).max(5_000).default([]).transform(limitExistingTitles),
});
/** What clients send. */
export type RecommendRequest = z.input<typeof recommendRequestSchema>;
/** What the server works with after validation and truncation. */
export type RecommendInput = z.output<typeof recommendRequestSchema>;

export const MAX_RECOMMENDATIONS = 5;

/** Models sometimes send `null` or "" for absent optional fields; treat both as absent. */
const absentToUndefined = (value: unknown) => (value === null || value === "" ? undefined : value);

export const recommendationSchema = z.object({
  title: z.string().trim().min(1),
  author: z.string().trim(),
  type: z.enum(["course", "certification", "book", "article", "podcast"]),
  url: z.preprocess(absentToUndefined, z.url({ protocol: /^https?$/ }).optional()),
  why: z.string().trim().min(1),
  estimatedHours: z.preprocess(absentToUndefined, z.number().positive().max(1000).optional()),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const recommendationsSchema = z.object({
  recommendations: z.array(recommendationSchema).transform((items) => items.slice(0, MAX_RECOMMENDATIONS)),
});
export type RecommendResponse = z.infer<typeof recommendationsSchema>;

// --- Refine summary ---------------------------------------------------------------

export const refineSummaryRequestSchema = z.object({
  material: z.object({
    title: requiredText(300),
    author: clampedText(200).optional(),
    /** What the material covers, so feedback can point out missing ideas. */
    brief: clampedText(3000).optional(),
  }),
  // The summary is the user's own text: reject rather than silently cut it.
  summary: z.string().trim().min(1, "Write a summary first.").max(8000, "Summaries are limited to 8,000 characters."),
});
export type RefineSummaryRequest = z.input<typeof refineSummaryRequestSchema>;
export type RefineSummaryInput = z.output<typeof refineSummaryRequestSchema>;

export const summaryFeedbackSchema = z.object({
  strengths: z.array(z.string().trim().min(1)),
  gaps: z.array(z.string().trim().min(1)),
  suggestions: z.array(z.string().trim().min(1)),
  improvedVersion: z.preprocess(absentToUndefined, z.string().trim().optional()),
});
export type SummaryFeedback = z.infer<typeof summaryFeedbackSchema>;

// --- Enrich material (paste to add) -----------------------------------------------

export const MAX_ENRICH_INPUT_LENGTH = 2000;
export const MAX_ENRICH_SKILLS = 60;

export const enrichMaterialRequestSchema = z.object({
  // What the user pasted (a title or a link). Their own text: reject rather than silently cut it.
  input: z
    .string()
    .trim()
    .min(1, "Paste a title or a link first.")
    .max(MAX_ENRICH_INPUT_LENGTH, `Pasted text is limited to ${MAX_ENRICH_INPUT_LENGTH.toLocaleString("en-US")} characters.`),
  /** The user's skills; the draft may only be tagged with these ids. */
  skills: z
    .array(z.object({ id: requiredText(100), name: requiredText(100) }))
    .max(MAX_ENRICH_SKILLS)
    .default([]),
});
export type EnrichMaterialRequest = z.input<typeof enrichMaterialRequestSchema>;
export type EnrichMaterialInput = z.output<typeof enrichMaterialRequestSchema>;

/** Drops a single bad optional value instead of failing the whole draft. */
const optional = <T extends z.ZodType>(schema: T) => z.preprocess(absentToUndefined, schema.optional()).catch(undefined);

/**
 * A draft the user reviews before saving. Text fields may be empty: the model
 * is told to leave out anything it isn't sure of rather than guess.
 */
export const materialDraftSchema = z.object({
  type: z.enum(MATERIAL_TYPES).catch("custom"),
  title: clampedText(300).default(""),
  author: clampedText(200).default(""),
  url: optional(z.url({ protocol: /^https?$/ }).max(2000)),
  tagline: clampedText(300).default(""),
  summary: clampedText(2000).default(""),
  skillIds: z.array(z.string()).max(MAX_ENRICH_SKILLS).catch([]).default([]),
  estimatedHours: optional(z.number().positive().max(1000)),
  level: optional(z.enum(MATERIAL_LEVELS)),
  cost: optional(z.enum(MATERIAL_COSTS)),
});
export type MaterialDraft = z.infer<typeof materialDraftSchema>;

/** Keeps only skill ids the user actually has (in their order), without duplicates. */
export function restrictDraftSkills(draft: MaterialDraft, skills: readonly { id: string }[]): MaterialDraft {
  const chosen = new Set(draft.skillIds);
  return { ...draft, skillIds: skills.map((skill) => skill.id).filter((id) => chosen.has(id)) };
}

// --- Errors -----------------------------------------------------------------------

export const aiErrorCodes = [
  "demo-mode",
  "forbidden",
  "bad-request",
  "unsupported-media-type",
  "too-large",
  "busy",
  "aborted",
  "not-installed",
  "timeout",
  "process-failed",
  "model-error",
  "invalid-output",
] as const;
export type AIErrorCode = (typeof aiErrorCodes)[number];

export const aiErrorResponseSchema = z.object({
  error: z.string(),
  code: z.enum(aiErrorCodes),
});
export type AIErrorResponse = z.infer<typeof aiErrorResponseSchema>;
