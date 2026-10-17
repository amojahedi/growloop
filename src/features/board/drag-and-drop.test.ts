import { describe, expect, it } from "vitest";
import { boardColumns } from "@/lib/domain/board";
import { makeItem } from "@/lib/testing/fixtures";
import { columnDropId, columnOf, dropTarget, moveCard, toColumnIds, type ColumnIds } from "./drag-and-drop";

const MONTH = "2026-10";

function sampleItems() {
  return [
    makeItem({ id: "a", status: "todo", order: 0 }),
    makeItem({ id: "b", status: "todo", order: 1 }),
    makeItem({ id: "c", status: "todo", order: 2 }),
    makeItem({ id: "d", status: "in_progress", order: 0 }),
  ];
}

const columnsOf = (ids: Partial<ColumnIds>): ColumnIds => ({ backlog: [], todo: [], in_progress: [], done: [], ...ids });

describe("columnOf", () => {
  it("finds the column of a card or of a column drop id", () => {
    const columns = toColumnIds(boardColumns(sampleItems(), MONTH));
    expect(columnOf(columns, "b")).toBe("todo");
    expect(columnOf(columns, columnDropId("done"))).toBe("done");
    expect(columnOf(columns, "missing")).toBeUndefined();
  });
});

describe("moveCard", () => {
  const columns = columnsOf({ todo: ["a", "b", "c"], in_progress: ["d"] });

  it("takes the hovered card's slot within a column", () => {
    expect(moveCard(columns, "a", "c").todo).toEqual(["b", "c", "a"]);
    expect(moveCard(columns, "c", "a").todo).toEqual(["c", "a", "b"]);
  });

  it("goes before or after the hovered card in another column", () => {
    expect(moveCard(columns, "a", "d")).toEqual(columnsOf({ todo: ["b", "c"], in_progress: ["a", "d"] }));
    expect(moveCard(columns, "a", "d", true).in_progress).toEqual(["d", "a"]);
  });

  it("appends when over another column itself, including an empty one", () => {
    expect(moveCard(columns, "b", columnDropId("in_progress")).in_progress).toEqual(["d", "b"]);
    expect(moveCard(columns, "b", columnDropId("done")).done).toEqual(["b"]);
  });

  it("changes nothing over itself or its own column's empty space", () => {
    expect(moveCard(columns, "a", "a")).toBe(columns);
    expect(moveCard(columns, "a", columnDropId("todo"))).toBe(columns);
  });
});

describe("dropTarget", () => {
  it("returns the status and index for moveItem", () => {
    const columns = columnsOf({ todo: ["b", "c"], in_progress: ["d", "a"] });
    expect(dropTarget(columns, "a", sampleItems(), MONTH)).toEqual({ status: "in_progress", index: 1, month: MONTH });
  });

  it("targets index 0 in an empty column", () => {
    const columns = columnsOf({ todo: ["b", "c"], in_progress: ["d"], done: ["a"] });
    expect(dropTarget(columns, "a", sampleItems(), MONTH)).toEqual({ status: "done", index: 0, month: MONTH });
  });

  it("is undefined when the card ends where it started", () => {
    const columns = toColumnIds(boardColumns(sampleItems(), MONTH));
    expect(dropTarget(columns, "b", sampleItems(), MONTH)).toBeUndefined();
  });

  it("anchors to the visible card above when a filter hides cards", () => {
    // "b" is hidden by a filter: the user sees [a, c] and drops "d" between them.
    const columns = columnsOf({ todo: ["a", "d", "c"] });
    expect(dropTarget(columns, "d", sampleItems(), MONTH)).toEqual({ status: "todo", index: 1, month: MONTH });
    // Dropping "c" above "a" moves it to the very top, past the hidden card too.
    expect(dropTarget(columnsOf({ todo: ["c", "a"] }), "c", sampleItems(), MONTH)?.index).toBe(0);
    // Dropping "a" below "c" puts it after "c", i.e. last in the full column [b, c].
    expect(dropTarget(columnsOf({ todo: ["c", "a"] }), "a", sampleItems(), MONTH)?.index).toBe(2);
  });

  it("is undefined for a card that is not on the board", () => {
    expect(dropTarget(columnsOf({}), "a", sampleItems(), MONTH)).toBeUndefined();
  });
});
