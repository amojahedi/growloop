import { describe, expect, it } from "vitest";
import { makeItem } from "@/lib/testing/fixtures";
import { boardColumns, columnItems, moveItem, nextOrder } from "./board";
import type { PlanItem } from "./types";

const NOW = "2026-10-17T10:00:00.000Z";

const ids = (items: PlanItem[]) => items.map((item) => item.id);
const orders = (items: PlanItem[]) => items.map((item) => item.order);

function sampleBoard() {
  return [
    makeItem({ id: "a", status: "todo", order: 0 }),
    makeItem({ id: "b", status: "todo", order: 1 }),
    makeItem({ id: "c", status: "todo", order: 2 }),
    makeItem({ id: "d", status: "in_progress", order: 0 }),
    makeItem({ id: "e", status: "done", order: 0, completedAt: "2026-10-10T10:00:00.000Z" }),
    makeItem({ id: "other-month", month: "2026-11", status: "todo", order: 0 }),
  ];
}

describe("columns", () => {
  it("groups a month's items by status, sorted by order", () => {
    const items = [makeItem({ id: "late", order: 5 }), makeItem({ id: "early", order: 1 }), ...sampleBoard()];
    const columns = boardColumns(items, "2026-10");

    expect(ids(columns.todo)).toEqual(["a", "early", "b", "c", "late"]);
    expect(ids(columns.in_progress)).toEqual(["d"]);
    expect(columns.backlog).toEqual([]);
    expect(ids(columns.done)).toEqual(["e"]);
  });

  it("applies an optional filter", () => {
    const columns = boardColumns(sampleBoard(), "2026-10", (item) => item.id !== "b");
    expect(ids(columns.todo)).toEqual(["a", "c"]);
  });

  it("computes the order that appends to a column", () => {
    const items = sampleBoard();
    expect(nextOrder(items, "2026-10", "todo")).toBe(3);
    expect(nextOrder(items, "2026-10", "backlog")).toBe(0);
  });
});

describe("moveItem", () => {
  it("reorders within a column", () => {
    const result = moveItem(sampleBoard(), "c", { status: "todo", index: 0 }, NOW);
    const todo = columnItems(result, "2026-10", "todo");

    expect(ids(todo)).toEqual(["c", "a", "b"]);
    expect(orders(todo)).toEqual([0, 1, 2]);
  });

  it("moves between columns and renumbers both", () => {
    const result = moveItem(sampleBoard(), "a", { status: "in_progress", index: 0 }, NOW);

    expect(ids(columnItems(result, "2026-10", "in_progress"))).toEqual(["a", "d"]);
    expect(orders(columnItems(result, "2026-10", "in_progress"))).toEqual([0, 1]);
    expect(ids(columnItems(result, "2026-10", "todo"))).toEqual(["b", "c"]);
    expect(orders(columnItems(result, "2026-10", "todo"))).toEqual([0, 1]);
  });

  it("appends when no index is given and clamps out-of-range indexes", () => {
    const appended = moveItem(sampleBoard(), "a", { status: "in_progress" }, NOW);
    expect(ids(columnItems(appended, "2026-10", "in_progress"))).toEqual(["d", "a"]);

    const clamped = moveItem(sampleBoard(), "d", { status: "todo", index: 99 }, NOW);
    expect(ids(columnItems(clamped, "2026-10", "todo"))).toEqual(["a", "b", "c", "d"]);
  });

  it("stamps completedAt when moved to done", () => {
    const result = moveItem(sampleBoard(), "d", { status: "done", index: 0 }, NOW);
    const moved = result.find((item) => item.id === "d");

    expect(moved).toMatchObject({ status: "done", completedAt: NOW, order: 0 });
  });

  it("keeps the original completedAt when reordering inside done", () => {
    const items = [...sampleBoard(), makeItem({ id: "f", status: "done", order: 1, completedAt: "2026-10-11T10:00:00Z" })];
    const result = moveItem(items, "f", { status: "done", index: 0 }, NOW);

    expect(result.find((item) => item.id === "f")?.completedAt).toBe("2026-10-11T10:00:00Z");
  });

  it("clears completedAt when moved out of done", () => {
    const result = moveItem(sampleBoard(), "e", { status: "todo", index: 1 }, NOW);
    const moved = result.find((item) => item.id === "e");

    expect(moved?.status).toBe("todo");
    expect(moved).not.toHaveProperty("completedAt");
    expect(ids(columnItems(result, "2026-10", "todo"))).toEqual(["a", "e", "b", "c"]);
  });

  it("leaves other months and untouched items alone", () => {
    const items = sampleBoard();
    const result = moveItem(items, "a", { status: "todo", index: 0 }, NOW);

    expect(result.find((item) => item.id === "other-month")).toBe(items.find((item) => item.id === "other-month"));
    expect(result).toEqual(items);
  });

  it("shows backlog items from earlier months and schedules them when they leave the backlog", () => {
    const items = [
      makeItem({ id: "old-backlog", month: "2026-09", status: "backlog", order: 0 }),
      makeItem({ id: "new-backlog", month: "2026-10", status: "backlog", order: 1 }),
      makeItem({ id: "future-backlog", month: "2026-11", status: "backlog", order: 0 }),
      makeItem({ id: "todo", month: "2026-10", status: "todo", order: 0 }),
    ];
    expect(ids(boardColumns(items, "2026-10").backlog)).toEqual(["old-backlog", "new-backlog"]);

    const moved = moveItem(items, "old-backlog", { status: "todo", index: 0, month: "2026-10" }, NOW);
    expect(moved.find((item) => item.id === "old-backlog")).toMatchObject({ month: "2026-10", status: "todo", order: 0 });
    expect(ids(columnItems(moved, "2026-10", "todo"))).toEqual(["old-backlog", "todo"]);
    expect(orders(columnItems(moved, "2026-10", "backlog"))).toEqual([0]);
  });

  it("keeps an item's month when it is parked in the backlog", () => {
    const items = [makeItem({ id: "a", month: "2026-10", status: "todo" })];
    const moved = moveItem(items, "a", { status: "backlog", month: "2026-12" }, NOW);
    expect(moved[0]).toMatchObject({ month: "2026-10", status: "backlog" });
  });

  it("is a no-op for unknown ids and does not mutate the input", () => {
    const items = sampleBoard();
    const snapshot = structuredClone(items);

    expect(moveItem(items, "missing", { status: "done" }, NOW)).toEqual(items);
    moveItem(items, "a", { status: "done" }, NOW);
    expect(items).toEqual(snapshot);
  });
});
