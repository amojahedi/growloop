import { ClaudeCliError } from "./errors";

/**
 * Caps how many Claude Code processes run at once. Extra calls wait in a short
 * queue; beyond that they fail fast with a "busy" error instead of piling up.
 */
export function createLimiter({ concurrency, maxQueued }: { concurrency: number; maxQueued: number }) {
  let active = 0;
  const queue: Array<() => void> = [];

  const release = () => {
    active -= 1;
    queue.shift()?.();
  };

  async function acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) throw abortedError();
    if (active < concurrency) {
      active += 1;
      return;
    }
    if (queue.length >= maxQueued) {
      throw new ClaudeCliError("Claude is busy with other requests. Try again in a moment.", "busy");
    }

    await new Promise<void>((resolve, reject) => {
      const start = () => {
        signal?.removeEventListener("abort", cancel);
        active += 1;
        resolve();
      };
      const cancel = () => {
        queue.splice(queue.indexOf(start), 1);
        reject(abortedError());
      };
      queue.push(start);
      signal?.addEventListener("abort", cancel, { once: true });
    });
  }

  return {
    async run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
      await acquire(signal);
      try {
        return await task();
      } finally {
        release();
      }
    },
    get active() {
      return active;
    },
    get queued() {
      return queue.length;
    },
  };
}

export const abortedError = () => new ClaudeCliError("The request was cancelled.", "aborted");
