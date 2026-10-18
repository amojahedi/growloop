import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { parseJsonText } from "../parse";
import {
  buildDraftPlanPrompt,
  buildEnrichMaterialPrompt,
  buildRecommendPrompt,
  buildRefineSummaryPrompt,
  type PromptSpec,
} from "../prompts";
import { AI_OFF_MESSAGE, type AIProvider } from "../provider";
import { AIRequestError } from "../request-error";
import {
  DRAFT_PLAN_TIMEOUT_MS,
  draftPlanRequestSchema,
  enrichMaterialRequestSchema,
  materialDraftSchema,
  planDraftSchema,
  recommendationsSchema,
  recommendRequestSchema,
  refineSummaryRequestSchema,
  restrictDraftSkills,
  summaryFeedbackSchema,
} from "../schemas";
import { withTimeout } from "../timeout";
import { readApiKey } from "./key-storage";
import { clientFor, loadSdk, trackRequest, type SDK } from "./own-key-client";

/**
 * The visitor's own Claude API key (ADR 008): the browser calls the Claude API
 * directly with the official SDK, so the key never touches Growloop's server.
 * The key is read from storage at call time (never held in React state).
 * Requests reuse the CLI provider's prompts (user text wrapped as data) and
 * answers are validated with the same zod schemas.
 */

export const OWN_KEY_MODEL = "claude-opus-5-5";

/** Opus 5.5 always thinks; effort is the only depth control (its default is "medium", so always set it). */
export type Effort = "low" | "medium";
/** Per the settings spec: the OKR wizard drafts at medium effort, everything else at low. */
export const FEATURE_EFFORT = {
  recommend: "low",
  enrichMaterial: "low",
  refineSummary: "low",
  draftPlan: "medium",
} as const satisfies Record<keyof Omit<AIProvider, "kind">, Effort>;

/** Thinking counts towards max_tokens; this leaves room for it without risking HTTP timeouts. */
const MAX_TOKENS = 16_000;
/** Server-side refusal fallback: if the model declines, the API retries on its default fallback model. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export const KEY_REJECTED_MESSAGE = "Your Claude key was rejected. Check it in Settings.";
const UNREACHABLE_MESSAGE = "Couldn't reach Anthropic. Check your connection and try again.";

/** Maps SDK errors to friendly messages. Most specific classes first. `sdk` is undefined if it failed to load. */
export function toRequestError(sdk: SDK | undefined, error: unknown): AIRequestError {
  if (error instanceof AIRequestError) return error;
  // The SDK chunk itself couldn't be loaded (offline, or a deploy replaced it).
  if (!sdk) return new AIRequestError(UNREACHABLE_MESSAGE, "network");
  if (error instanceof sdk.APIUserAbortError) return new AIRequestError("The request was cancelled.", "aborted");
  if (error instanceof sdk.AuthenticationError || error instanceof sdk.PermissionDeniedError) {
    return new AIRequestError(KEY_REJECTED_MESSAGE, "key-rejected");
  }
  if (error instanceof sdk.NotFoundError) {
    return new AIRequestError("Your Claude key can't use Claude Opus 5.5.", "forbidden");
  }
  if (error instanceof sdk.RateLimitError) {
    return new AIRequestError("Your key hit Claude's rate limit. Wait a moment and try again.", "rate-limited");
  }
  if (error instanceof sdk.BadRequestError) {
    return new AIRequestError("Claude couldn't process this request.", "bad-request");
  }
  if (error instanceof sdk.APIConnectionTimeoutError) {
    return new AIRequestError("Claude didn't respond in time. Try again.", "timeout");
  }
  if (error instanceof sdk.APIConnectionError) return new AIRequestError(UNREACHABLE_MESSAGE, "network");
  if (error instanceof sdk.InternalServerError) {
    return new AIRequestError("Claude is temporarily unavailable. Try again shortly.", "model-error");
  }
  if (error instanceof sdk.APIError) {
    return new AIRequestError("The Claude API returned an error. Try again.", "model-error");
  }
  return new AIRequestError("Something went wrong while asking Claude.", "process-failed");
}

/** Runs `task` with the loaded SDK, mapping every failure (including a failed SDK load) to an AIRequestError. */
async function withSdk<T>(task: (sdk: SDK) => Promise<T>): Promise<T> {
  let sdk: SDK | undefined;
  try {
    sdk = await loadSdk();
    return await task(sdk);
  } catch (error) {
    throw toRequestError(sdk, error);
  }
}

/** Validates a request with the same schema the local routes use (trimming, truncation, limits). */
function parseRequest<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new AIRequestError(z.prettifyError(result.error), "bad-request");
  return result.data;
}

/**
 * Structured outputs accept a subset of JSON Schema. `maxItems` isn't part of
 * it, so it moves into the description (zod still enforces the limit).
 */
export function toStructuredOutputSchema(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toStructuredOutputSchema);
  if (typeof schema !== "object" || schema === null) return schema;

  const { maxItems, ...rest } = schema as Record<string, unknown>;
  const result = Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, toStructuredOutputSchema(value)]));
  if (typeof maxItems === "number") {
    const limit = `At most ${maxItems} items.`;
    result.description = typeof result.description === "string" ? `${result.description} ${limit}` : limit;
  }
  return result;
}

/** Reads and validates the JSON answer, after checking why the model stopped. */
export function readStructuredAnswer<T>(message: Anthropic.Beta.BetaMessage, schema: z.ZodType<T>): T {
  switch (message.stop_reason) {
    case "refusal":
      throw new AIRequestError("Claude couldn't respond this time.", "refusal");
    case "max_tokens":
    case "model_context_window_exceeded":
      throw new AIRequestError("Claude's answer was cut off. Try again with less text.", "truncated");
  }

  const text = message.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  const payload = parseJsonText(text);
  if (payload === undefined) throw new AIRequestError("Claude's answer did not contain JSON.", "invalid-output");

  const result = schema.safeParse(payload);
  if (!result.success) throw new AIRequestError("Claude's answer had an unexpected shape. Try again.", "invalid-output");
  return result.data;
}

export interface AskWithKeyOptions<T> {
  spec: PromptSpec;
  schema: z.ZodType<T>;
  effort: Effort;
  signal?: AbortSignal;
}

/** One structured-output request to Claude with the saved key. Forgetting the key cancels it. */
export function askClaudeWithKey<T>({ spec, schema, effort, signal }: AskWithKeyOptions<T>): Promise<T> {
  return withSdk(async (sdk) => {
    const apiKey = readApiKey();
    if (!apiKey) throw new AIRequestError(AI_OFF_MESSAGE, "off");

    const message = await trackRequest(signal, (requestSignal) =>
      clientFor(sdk, apiKey).beta.messages.create(
        {
          model: OWN_KEY_MODEL,
          max_tokens: MAX_TOKENS,
          system: spec.systemPrompt,
          messages: [{ role: "user", content: spec.prompt }],
          output_config: {
            effort,
            format: { type: "json_schema", schema: toStructuredOutputSchema(spec.jsonSchema) as Record<string, unknown> },
          },
          betas: [FALLBACK_BETA],
          fallbacks: "default",
        },
        { signal: requestSignal },
      ),
    );
    return readStructuredAnswer(message, schema);
  });
}

/**
 * Checks a key (before it is saved) with one cheap call that spends no
 * tokens: listing models. Uses a throwaway client, so a rejected key isn't kept.
 */
export function validateApiKey(apiKey: string, signal?: AbortSignal): Promise<void> {
  return withSdk(async (sdk) => {
    await clientFor(sdk, apiKey.trim(), { cache: false }).models.list({ limit: 1 }, { signal });
  });
}

export const ownKeyProvider: AIProvider = {
  kind: "key",
  recommend: async (input, signal) =>
    askClaudeWithKey({
      spec: buildRecommendPrompt(parseRequest(recommendRequestSchema, input)),
      schema: recommendationsSchema,
      effort: FEATURE_EFFORT.recommend,
      signal,
    }),
  refineSummary: async (input, signal) =>
    askClaudeWithKey({
      spec: buildRefineSummaryPrompt(parseRequest(refineSummaryRequestSchema, input)),
      schema: summaryFeedbackSchema,
      effort: FEATURE_EFFORT.refineSummary,
      signal,
    }),
  enrichMaterial: async (input, signal) => {
    const request = parseRequest(enrichMaterialRequestSchema, input);
    const draft = await askClaudeWithKey({
      spec: buildEnrichMaterialPrompt(request),
      schema: materialDraftSchema,
      effort: FEATURE_EFFORT.enrichMaterial,
      signal,
    });
    // The output schema already limits skill ids; this enforces it regardless.
    return restrictDraftSkills(draft, request.skills);
  },
  draftPlan: async (input, signal) => {
    const request = parseRequest(draftPlanRequestSchema, input);
    return withTimeout(DRAFT_PLAN_TIMEOUT_MS, signal, (timed) =>
      askClaudeWithKey({ spec: buildDraftPlanPrompt(request), schema: planDraftSchema, effort: FEATURE_EFFORT.draftPlan, signal: timed }),
    );
  },
};
