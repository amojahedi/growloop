import { describe, expect, it } from "vitest";
import { createLimiter } from "./limiter";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

describe("createLimiter", () => {
  it("runs up to `concurrency` tasks and queues the rest in order", async () => {
    const limiter = createLimiter({ concurrency: 1, maxQueued: 2 });
    const gate = deferred();
    const order: string[] = [];

    const first = limiter.run(async () => {
      await gate.promise;
      order.push("first");
    });
    const second = limiter.run(async () => void order.push("second"));

    expect(limiter.active).toBe(1);
    expect(limiter.queued).toBe(1);

    gate.resolve();
    await Promise.all([first, second]);
    expect(order).toEqual(["first", "second"]);
    expect(limiter.active).toBe(0);
  });

  it("fails fast with a busy error when the queue is full", async () => {
    const limiter = createLimiter({ concurrency: 1, maxQueued: 1 });
    const gate = deferred();
    const running = limiter.run(() => gate.promise);
    const waiting = limiter.run(async () => "ok");

    await expect(limiter.run(async () => "nope")).rejects.toMatchObject({ code: "busy" });

    gate.resolve();
    await running;
    await expect(waiting).resolves.toBe("ok");
  });

  it("drops a queued task when its signal aborts", async () => {
    const limiter = createLimiter({ concurrency: 1, maxQueued: 2 });
    const gate = deferred();
    const running = limiter.run(() => gate.promise);
    const controller = new AbortController();
    const queued = limiter.run(async () => "never", controller.signal);

    controller.abort();
    await expect(queued).rejects.toMatchObject({ code: "aborted" });
    expect(limiter.queued).toBe(0);

    gate.resolve();
    await running;
  });

  it("releases its slot when a task throws", async () => {
    const limiter = createLimiter({ concurrency: 1, maxQueued: 0 });
    await expect(limiter.run(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(limiter.run(async () => "next")).resolves.toBe("next");
  });
});
