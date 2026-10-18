import { AIRequestError } from "./request-error";

/**
 * Runs a request that gives up after `ms` and is also cancelled by the
 * caller's signal. A timeout surfaces as a "timeout" error the UI can explain,
 * while the caller's own cancel still looks like a cancel.
 */
export async function withTimeout<T>(
  ms: number,
  signal: AbortSignal | undefined,
  run: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, ms);
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    return await run(controller.signal);
  } catch (error) {
    if (timedOut) throw new AIRequestError("Claude didn't respond in time. Try again.", "timeout");
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
