import { describe, expect, it } from "vitest";
import { pendingReview } from "@/lib/domain/month-review";
import { makeItem, makeKeyResult, makeObjective } from "@/lib/testing/fixtures";
import { banner, effectiveDecision, moveHint, quarterLabel, wrappedUp, yearSummary } from "./review-model";

describe("review copy", () => {
  it("names one or several months", () => {
    expect(banner(["2026-09"])).toBe("September is done. Wrap it up in a minute.");
    expect(banner(["2026-08", "2026-09"])).toBe("August and September are done. Wrap it up in a minute.");
    expect(wrappedUp(["2026-09"])).toBe("September is wrapped up.");
    expect(wrappedUp(["2026-07", "2026-08", "2026-09"])).toBe("July, August and September are wrapped up.");
  });

  it("adds the year to quarters outside the current one", () => {
    expect(quarterLabel("2026-Q3", 2026)).toBe("Q3");
    expect(quarterLabel("2026-Q4", 2027)).toBe("Q4 2026");
  });
});

describe("effectiveDecision", () => {
  const ok = { ok: true, to: "2026-Q4" } as const;
  it("moves only when chosen, allowed and not met", () => {
    expect(effectiveDecision(40, "move", ok)).toBe("move");
    expect(effectiveDecision(40, "close", ok)).toBe("close");
    expect(effectiveDecision(40, undefined, ok)).toBe("close");
    expect(effectiveDecision(100, "move", ok)).toBe("close");
    expect(effectiveDecision(40, "move", { ok: false, reason: "already-moved", to: "2026-Q4" })).toBe("close");
  });
});

describe("moveHint", () => {
  const objective = { quarter: "2026-Q4" };
  it("explains a disabled move, and says nothing when the move is hidden or allowed", () => {
    expect(moveHint(objective, { ok: false, reason: "already-moved", to: "2027-Q1" })).toBe("Already moved once");
    expect(moveHint(objective, { ok: false, reason: "year-full", to: "2027-Q1" })).toBe("2027 already has 4 objectives");
    expect(moveHint(objective, { ok: false, reason: "outside-window" })).toBeUndefined();
    expect(moveHint(objective, { ok: true, to: "2027-Q1" })).toBeUndefined();
  });
});

describe("yearSummary", () => {
  it("counts the year's finished items and the objectives closed once the review applies", () => {
    const items = [
      makeItem({ status: "done", completedAt: "2026-03-02T10:00:00.000Z", month: "2026-03" }),
      makeItem({ status: "done", completedAt: "2026-12-20T10:00:00.000Z", month: "2026-12" }),
      makeItem({ status: "done", completedAt: "2025-12-20T10:00:00.000Z", month: "2025-12" }),
      makeItem({ status: "todo", month: "2026-12" }),
    ];
    const closedEarlier = makeObjective({ quarter: "2026-Q2", status: "closed", finalProgress: 50 });
    const closing = makeObjective({ id: "closing", quarter: "2026-Q4", keyResults: [makeKeyResult()] });
    const moving = makeObjective({ id: "moving", quarter: "2026-Q4", keyResults: [makeKeyResult()] });
    const objectives = [closedEarlier, closing, moving];
    const data = { planItems: items, objectives, archivedYears: [], rollovers: [] };
    const pending = pendingReview(data, "2027-01-03")!;
    const checks = new Map([
      ["closing", { ok: true, to: "2027-Q1" } as const],
      ["moving", { ok: true, to: "2027-Q1" } as const],
    ]);

    expect(yearSummary(2026, items, objectives, pending, { moving: "move" }, checks)).toBe(
      "2026 is done: 2 things finished, 2 objectives closed.",
    );
    expect(yearSummary(2026, items, objectives, pending, {}, checks)).toBe("2026 is done: 2 things finished, 3 objectives closed.");
    expect(yearSummary(2025, items, [], pending, {}, checks)).toBe("2025 is done: 1 thing finished, 0 objectives closed.");
  });
});
