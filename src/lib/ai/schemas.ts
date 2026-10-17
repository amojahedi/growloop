import { z } from "zod";

/**
 * Request and response contracts for the local AI features. Shared by the
 * route handlers (server) and `useAI()` (client); contains no server code.
 */

// --- Status ---------------------------------------------------------------------

export const aiUnavailableCodes = ["demo-mode", "not-installed", "not-signed-in", "error"] as const;
export type AIUnavailableCode = (typeof aiUnavailableCodes)[number];

export const aiStatusSchema = z.object({
  available: z.boolean(),
  reason: z.string().optional(),
  code: z.enum(aiUnavailableCodes).optional(),
});
export type AIStatus = z.infer<typeof aiStatusSchema>;

// --- Recommend materials --------------------------------------------------------

const shortText = (max: number) => z.string().trim().max(max);

export const recommendRequestSchema = z.object({
  context: z.discriminatedUnion("kind", [
    z.object({
      kind: z.literal("skill"),
      name: shortText(100).min(1),
      description: shortText(1000).optional(),
    }),
    z.object({
      kind: z.literal("objective"),
      title: shortText(300).min(1),
      description: shortText(1000).optional(),
      keyResults: z.array(shortText(300)).max(10).optional(),
      skills: z.array(shortText(100)).max(20).optional(),
    }),
  ]),
  /** Titles already in the library or plan, so they aren't suggested again. */
  existingTitles: z.array(shortText(300)).max(300).default([]),
});
export type RecommendRequest = z.input<typeof recommendRequestSchema>;

export const MAX_RECOMMENDATIONS = 5;

/** Models sometimes send `null` or "" for absent optional fields; treat both as absent. */
const absentToUndefined = (value: unknown) => (value === null || value === "" ? undefined : value);

export const recommendationSchema = z.object({
  title: z.string().trim().min(1),
  author: z.string().trim(),
  type: z.enum(["course", "book", "article", "podcast"]),
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
    title: shortText(300).min(1),
    author: shortText(200).optional(),
    /** What the material covers, so feedback can point out missing ideas. */
    brief: shortText(3000).optional(),
  }),
  summary: shortText(8000).min(1, "Write a summary first."),
});
export type RefineSummaryRequest = z.input<typeof refineSummaryRequestSchema>;

export const summaryFeedbackSchema = z.object({
  strengths: z.array(z.string().trim().min(1)),
  gaps: z.array(z.string().trim().min(1)),
  suggestions: z.array(z.string().trim().min(1)),
  improvedVersion: z.preprocess(absentToUndefined, z.string().trim().optional()),
});
export type SummaryFeedback = z.infer<typeof summaryFeedbackSchema>;

// --- Errors -----------------------------------------------------------------------

export const aiErrorCodes = [
  "demo-mode",
  "forbidden",
  "bad-request",
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
