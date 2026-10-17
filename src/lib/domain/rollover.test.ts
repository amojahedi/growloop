import { describe, expect, it } from "vitest";
import { makeData, makeItem } from "@/lib/testing/fixtures";
import { applyRollover, bulkDecisions, pendingRollover } from "./rollover";

const NOW = "2026-11-01T08:00:00.000Z";

function octoberLeftovers() {
  return [
    makeItem({ id: "done", month: "2026-10", status: "done", completedAt: "2026-10-20T10:00:00Z" }),
    makeItem({ id: "progress", month: "2026-10", status: "in_progress", order: 0 }),
    makeItem({ id: "todo", month: "2026-10", status: "todo", order: 0 }),
    makeItem({ id: "older", month: "2026-09", status: "todo", order: 0, carriedFrom: ["2026-08"] }),
    makeItem({ id: "parked", month: "2026-09", status: "backlog", order: 0 }),
    makeItem({ id: "current", month: "2026-11", status: "todo", order: 0 }),
  ];
}

describe("pendingRollover", () => {
  it("finds unfinished items from earlier months, oldest first", () => {
    const pending = pendingRollover(octoberLeftovers(), "2026-11");

    expect(pending?.toMonth).toBe("2026-11");
    expect(pending?.fromMonths).toEqual(["2026-09", "2026-10"]);
    expect(pending?.items.map((item) => item.id)).toEqual(["older", "progress", "todo"]);
  });

  it("does not re-ask about backlog items", () => {
    const pending = pendingRollover(octoberLeftovers(), "2026-11");
    expect(pending?.items.map((item) => item.id)).not.toContain("parked");
    expect(pendingRollover([makeItem({ month: "2026-09", status: "backlog" })], "2026-11")).toBeNull();
  });

  it("returns null when there is nothing to review", () => {
    expect(pendingRollover(octoberLeftovers(), "2026-09")).toBeNull();
    expect(pendingRollover([], "2026-11")).toBeNull();
  });
});

describe("applyRollover", () => {
  it("carries items over into the new month, keeping status and recording history", () => {
    const data = makeData({ planItems: octoberLeftovers() });
    const { data: next } = applyRollover(data, "2026-11", { progress: "carry_over", older: "carry_over" }, NOW);

    expect(next.planItems.find((item) => item.id === "progress")).toMatchObject({
      month: "2026-11",
      status: "in_progress",
      order: 0,
      carriedFrom: ["2026-10"],
    });
    expect(next.planItems.find((item) => item.id === "older")).toMatchObject({
      month: "2026-11",
      status: "todo",
      order: 1, // appended after the existing November to-do
      carriedFrom: ["2026-08", "2026-09"],
    });
  });

  it("moves items to the new month's backlog", () => {
    const data = makeData({ planItems: octoberLeftovers() });
    const { data: next } = applyRollover(data, "2026-11", { progress: "backlog" }, NOW);

    expect(next.planItems.find((item) => item.id === "progress")).toMatchObject({
      month: "2026-11",
      status: "backlog",
      order: 1, // after the backlog item already in the pool
      carriedFrom: ["2026-10"],
    });
  });

  it("drops items", () => {
    const data = makeData({ planItems: octoberLeftovers() });
    const { data: next } = applyRollover(data, "2026-11", { todo: "drop" }, NOW);

    expect(next.planItems.map((item) => item.id)).not.toContain("todo");
    expect(next.planItems).toHaveLength(5);
  });

  it("leaves undecided, finished, backlog and current-month items untouched", () => {
    const items = octoberLeftovers();
    const data = makeData({ planItems: items });
    const { data: next } = applyRollover(
      data,
      "2026-11",
      { done: "drop", current: "drop", parked: "drop", todo: "carry_over" },
      NOW,
    );

    for (const id of ["done", "current", "parked", "progress", "older"]) {
      expect(next.planItems.find((item) => item.id === id)).toBe(items.find((item) => item.id === id));
    }
  });

  it("records the review with decision counts", () => {
    const data = makeData({ planItems: octoberLeftovers() });
    const decisions = { progress: "carry_over", todo: "backlog", older: "drop" } as const;
    const { data: next, record } = applyRollover(data, "2026-11", decisions, NOW);

    expect(record).toEqual({
      fromMonth: "2026-10",
      toMonth: "2026-11",
      completedAt: NOW,
      counts: { carry_over: 1, backlog: 1, drop: 1 },
    });
    expect(next.rollovers).toEqual([record]);
    expect(pendingRollover(next.planItems, "2026-11")).toBeNull();
  });

  it("supports bulk decisions", () => {
    const pending = pendingRollover(octoberLeftovers(), "2026-11");
    const decisions = bulkDecisions(pending?.items ?? [], "carry_over");

    expect(decisions).toEqual({ older: "carry_over", progress: "carry_over", todo: "carry_over" });

    const { data } = applyRollover(makeData({ planItems: octoberLeftovers() }), "2026-11", decisions, NOW);
    const novemberTodo = data.planItems
      .filter((item) => item.month === "2026-11" && item.status === "todo")
      .sort((a, b) => a.order - b.order);
    expect(novemberTodo.map((item) => [item.id, item.order])).toEqual([
      ["current", 0],
      ["older", 1],
      ["todo", 2],
    ]);
  });
});
