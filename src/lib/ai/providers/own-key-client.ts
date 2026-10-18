import type Anthropic from "@anthropic-ai/sdk";

/**
 * The browser-side Anthropic SDK client for the visitor's own key: lazy SDK
 * loading, one cached client, and tracking of requests in flight so that
 * forgetting the key stops them and drops the client (and the key it holds)
 * from memory.
 */

export type SDK = typeof import("@anthropic-ai/sdk");

const TIMEOUT_MS = 120_000;

let importSdk: () => Promise<SDK> = () => import("@anthropic-ai/sdk");
let sdkPromise: Promise<SDK> | undefined;

/** Loads the SDK on first use, so it isn't part of every page's bundle. A failed load is retried next time. */
export function loadSdk(): Promise<SDK> {
  sdkPromise ??= importSdk().catch((error: unknown) => {
    sdkPromise = undefined;
    throw error;
  });
  return sdkPromise;
}

/** Test seam: replaces how the SDK module is imported. */
export function setSdkImporterForTests(importer: () => Promise<SDK>): void {
  importSdk = importer;
  sdkPromise = undefined;
}

function createClient(sdk: SDK, apiKey: string): Anthropic {
  return new sdk.Anthropic({
    apiKey,
    // The key is the visitor's own, entered by them, and stays in their browser (ADR 008).
    dangerouslyAllowBrowser: true,
    timeout: TIMEOUT_MS,
    maxRetries: 1,
    // Never print SDK diagnostics: nothing about the key or requests ends up in the console.
    logLevel: "off",
  });
}

let cachedClient: { apiKey: string; client: Anthropic } | undefined;

/** The client for `apiKey`. Pass `cache: false` for a one-off client (e.g. checking a key before saving it). */
export function clientFor(sdk: SDK, apiKey: string, { cache = true }: { cache?: boolean } = {}): Anthropic {
  if (!cache) return createClient(sdk, apiKey);
  if (cachedClient?.apiKey !== apiKey) cachedClient = { apiKey, client: createClient(sdk, apiKey) };
  return cachedClient.client;
}

const inFlight = new Set<AbortController>();

/**
 * Runs a request with its own abort signal, linked to the caller's, so
 * `resetOwnKeyClient()` can cancel it.
 */
export async function trackRequest<T>(signal: AbortSignal | undefined, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  inFlight.add(controller);
  try {
    return await run(controller.signal);
  } finally {
    inFlight.delete(controller);
    signal?.removeEventListener("abort", abort);
  }
}

/** Cancels requests in flight and drops the cached client. Called when the key is forgotten or replaced. */
export function resetOwnKeyClient(): void {
  for (const controller of inFlight) controller.abort();
  inFlight.clear();
  cachedClient = undefined;
}

/** For tests: whether a client is cached. */
export const hasCachedClient = () => cachedClient !== undefined;
