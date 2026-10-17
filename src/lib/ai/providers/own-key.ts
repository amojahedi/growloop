import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { parseJsonText } from "../parse";
import { buildEnrichMaterialPrompt, buildRecommendPrompt, buildRefineSummaryPrompt, type PromptSpec } from "../prompts";
import { draftOkrsNotImplemented, type AIProvider } from "../provider";
import { AIRequestError } from "../request-error";
import {
  enrichMaterialRequestSchema,
  materialDraftSchema,
  recommendationsSchema,
  recommendRequestSchema,
  refineSummaryRequestSchema,
  restrictDraftSkills,
  summaryFeedbackSchema,
} from "../schemas";

/**
 * The visitor's own Claude API key (ADR 008): the browser calls the Claude API
 * directly with the official SDK, so the key never touches Growloop's server.
 * Requests reuse the CLI provider's prompts (user text wrapped as data) and
 * answers are validated with the same zod schemas.
 */

export const OWN_KEY_MODEL = "claude-opus-5-5";

/** Opus 5.5 always thinks; effort is the only depth control (its default is "medium", so always set it). */
export type Effort = "low" | "medium";
export const FEATURE_EFFORT = {
  recommend: "low",
  enrichMaterial: "low",
  refineSummary: "medium",
  draftOkrs: "medium",
} as const satisfies Record<keyof Omit<AIProvider, "kind">, Effort>;

/** Thinking counts towards max_tokens; this leaves room for it without risking HTTP timeouts. */
const MAX_TOKENS = 16_000;
const TIMEOUT_MS = 120_000;
/** Server-side refusal fallback: if the model declines, the API retries on its default fallback model. */
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

type SDK = typeof import("@anthropic-ai/sdk");

// Loaded on first use so the SDK isn't part of every page's bundle.
let sdkPromise: Promise<SDK> | undefined;
const loadSdk = () => (sdkPromise ??= import("@anthropic-ai/sdk"));

let cachedClient: { apiKey: string; client: Anthropic } | undefined;

function clientFor(sdk: SDK, apiKey: string): Anthropic {
  if (cachedClient?.apiKey !== apiKey) {
    const client = new sdk.Anthropic({
      apiKey,
      // The key is the visitor's own, entered by them, and stays in their browser (ADR 008).
      dangerouslyAllowBrowser: true,
      timeout: TIMEOUT_MS,
      maxRetries: 1,
      // Never print SDK diagnostics: nothing about the key or requests ends up in the console.
      logLevel: "off",
    });
    cachedClient = { apiKey, client };
  }
  return cachedClient.client;
}

/** Maps SDK errors to friendly messages. Most specific classes first. */
export function toRequestError(sdk: SDK, error: unknown): AIRequestError {
  if (error instanceof AIRequestError) return error;
  if (error instanceof sdk.APIUserAbortError) return new AIRequestError("The request was cancelled.", "aborted");
  if (error instanceof sdk.AuthenticationError) {
    return new AIRequestError("Key rejected. Check your Claude API key in Settings.", "key-rejected");
  }
  if (error instanceof sdk.PermissionDeniedError) {
    return new AIRequestError("Your Claude API key isn't allowed to make this request.", "forbidden");
  }
  if (error instanceof sdk.NotFoundError) {
    return new AIRequestError("Your Claude API key can't use Claude Opus 5.5.", "forbidden");
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
  if (error instanceof sdk.APIConnectionError) {
    return new AIRequestError("Couldn't reach the Claude API. Check your connection.", "network");
  }
  if (error instanceof sdk.InternalServerError) {
    return new AIRequestError("Claude is temporarily unavailable. Try again shortly.", "model-error");
  }
  if (error instanceof sdk.APIError) {
    return new AIRequestError("The Claude API returned an error. Try again.", "model-error");
  }
  return new AIRequestError("Something went wrong while asking Claude.", "process-failed");
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
      throw new AIRequestError("Claude declined to answer this request. Try rephrasing it.", "refusal");
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
  apiKey: string;
  spec: PromptSpec;
  schema: z.ZodType<T>;
  effort: Effort;
  signal?: AbortSignal;
}

/** One structured-output request to Claude with the visitor's key. */
export async function askClaudeWithKey<T>({ apiKey, spec, schema, effort, signal }: AskWithKeyOptions<T>): Promise<T> {
  const sdk = await loadSdk();
  try {
    const message = await clientFor(sdk, apiKey).beta.messages.create(
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
      { signal },
    );
    return readStructuredAnswer(message, schema);
  } catch (error) {
    throw toRequestError(sdk, error);
  }
}

/**
 * Checks a key without spending tokens: fetching the model's details needs a
 * valid key with access to the model.
 */
export async function testApiKey(apiKey: string, signal?: AbortSignal): Promise<void> {
  const sdk = await loadSdk();
  try {
    await clientFor(sdk, apiKey).models.retrieve(OWN_KEY_MODEL, null, { signal });
  } catch (error) {
    throw toRequestError(sdk, error);
  }
}

export function createOwnKeyProvider(apiKey: string): AIProvider {
  return {
    kind: "own-key",
    recommend: async (input, signal) =>
      askClaudeWithKey({
        apiKey,
        spec: buildRecommendPrompt(parseRequest(recommendRequestSchema, input)),
        schema: recommendationsSchema,
        effort: FEATURE_EFFORT.recommend,
        signal,
      }),
    refineSummary: async (input, signal) =>
      askClaudeWithKey({
        apiKey,
        spec: buildRefineSummaryPrompt(parseRequest(refineSummaryRequestSchema, input)),
        schema: summaryFeedbackSchema,
        effort: FEATURE_EFFORT.refineSummary,
        signal,
      }),
    enrichMaterial: async (input, signal) => {
      const request = parseRequest(enrichMaterialRequestSchema, input);
      const draft = await askClaudeWithKey({
        apiKey,
        spec: buildEnrichMaterialPrompt(request),
        schema: materialDraftSchema,
        effort: FEATURE_EFFORT.enrichMaterial,
        signal,
      });
      // The output schema already limits skill ids; this enforces it regardless.
      return restrictDraftSkills(draft, request.skills);
    },
    // The OKR wizard implements this with askClaudeWithKey and FEATURE_EFFORT.draftOkrs.
    draftOkrs: draftOkrsNotImplemented,
  };
}
