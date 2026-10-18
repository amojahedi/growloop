import { describe, expect, it } from "vitest";
import { boardColumns, moveItem } from "@/lib/domain/board";
import { makeItem, makeKeyResult, makeObjective } from "@/lib/testing/fixtures";
import {
  earliestMonth,
  isReadOnlyMonth,
  matchesFilters,
  menuMoves,
  monthToOpen,
  monthProgress,
  NO_FILTERS,
  shortTitle,
  visibleColumns,
  worksToward,
} from "./board-model";
import { toColumnIds } from "./drag-and-drop";

const MONTH = "2026-10";

describe("monthProgress", () => {
  it("counts To do, In progress and Done of the month, never Backlog or other months", () => {
    const items = [
      makeItem({ status: "done" }),
      makeItem({ status: "done" }),
      makeItem({ status: "in_progress" }),
      makeItem({ status: "todo" }),
      makeItem({ status: "backlog" }),
      makeItem({ status: "done", month: "2026-09" }),
    ];
    expect(monthProgress(items, MONTH)).toEqual({ done: 2, planned: 4 });
    expect(monthProgress([], MONTH)).toEqual({ done: 0, planned: 0 });
  });
});

describe("month range", () => {
  it("goes back to the first month with a plan item, and never past the current month", () => {
    const items = [makeItem({ month: "2026-08" }), makeItem({ month: "2026-05" }), makeItem({ month: "2026-12" })];
    expect(earliestMonth(items, MONTH)).toBe("2026-05");
    expect(earliestMonth([], MONTH)).toBe(MONTH);
    expect(earliestMonth([makeItem({ month: "2026-12" })], MONTH)).toBe(MONTH);
  });

  it("only lets the current month be edited, and hides Backlog elsewhere", () => {
    expect(isReadOnlyMonth("2026-09", MONTH)).toBe(true);
    expect(isReadOnlyMonth("2026-11", MONTH)).toBe(true);
    expect(isReadOnlyMonth(MONTH, MONTH)).toBe(false);
    expect(visibleColumns(true)).toEqual(["todo", "in_progress", "done"]);
    expect(visibleColumns(false)).toEqual(["backlog", "todo", "in_progress", "done"]);
  });
});

describe("monthToOpen", () => {
  it("opens an item on its month, Backlog and later months on the current one", () => {
    expect(monthToOpen({ month: "2026-08", status: "done" }, MONTH)).toBe("2026-08");
    expect(monthToOpen({ month: "2026-08", status: "backlog" }, MONTH)).toBe(MONTH);
    expect(monthToOpen({ month: "2026-12", status: "todo" }, MONTH)).toBe(MONTH);
  });
});

describe("filters", () => {
  const kr = makeKeyResult({ id: "kr-linked", type: "material", skillId: "strategy" });
  const count = makeKeyResult({ id: "kr-count", type: "count", skillId: "discovery" });
  const objective = makeObjective({ keyResults: [kr, count] });

  it("matches cards linked to the objective's KRs or tagged with a count KR's skill", () => {
    expect(worksToward(makeItem({ keyResultId: "kr-linked" }), objective)).toBe(true);
    expect(worksToward(makeItem({ skillIds: ["roadmapping", "discovery"] }), objective)).toBe(true);
    // A material KR's skill alone doesn't count: only its linked card does.
    expect(worksToward(makeItem({ skillIds: ["strategy"] }), objective)).toBe(false);
    expect(worksToward(makeItem({ keyResultId: "kr-elsewhere" }), objective)).toBe(false);
  });

  it("combines any-of skills with the objective", () => {
    const items = [
      makeItem({ id: "a", skillIds: ["discovery"] }),
      makeItem({ id: "b", skillIds: ["roadmapping"] }),
      makeItem({ id: "c", skillIds: ["strategy"], keyResultId: "kr-linked" }),
    ];
    const ids = (filter: (item: (typeof items)[number]) => boolean) => items.filter(filter).map((item) => item.id);

    expect(ids(matchesFilters(NO_FILTERS, undefined))).toEqual(["a", "b", "c"]);
    expect(ids(matchesFilters({ skillIds: ["roadmapping", "strategy"], objectiveId: "" }, undefined))).toEqual(["b", "c"]);
    expect(ids(matchesFilters({ skillIds: [], objectiveId: objective.id }, objective))).toEqual(["a", "c"]);
    expect(ids(matchesFilters({ skillIds: ["strategy"], objectiveId: objective.id }, objective))).toEqual(["c"]);
  });
});

describe("menuMoves", () => {
  const items = [
    makeItem({ id: "a", status: "todo", order: 0 }),
    makeItem({ id: "b", status: "todo", order: 1 }),
    makeItem({ id: "c", status: "todo", order: 2 }),
    makeItem({ id: "d", status: "in_progress", order: 0 }),
  ];
  const columns = toColumnIds(boardColumns(items, MONTH));

  it("omits the current column and offers up/down only toward a neighbour", () => {
    expect(menuMoves(columns, "a", items, MONTH)).toEqual({
      moveTo: ["backlog", "in_progress", "done"],
      up: undefined,
      down: { status: "todo", index: 1, month: MONTH },
    });
    const last = menuMoves(columns, "c", items, MONTH);
    expect(last.up).toEqual({ status: "todo", index: 1, month: MONTH });
    expect(last.down).toBeUndefined();
    expect(menuMoves(columns, "d", items, MONTH)).toMatchObject({ up: undefined, down: undefined });
  });

  it("swaps with the visible neighbour when filters hide cards in between", () => {
    const filtered = toColumnIds(boardColumns(items, MONTH, (item) => item.id !== "b"));
    const up = menuMoves(filtered, "c", items, MONTH).up!;
    const order = (list: typeof items) =>
      list.filter((item) => item.status === "todo").sort((x, y) => x.order - y.order).map((item) => item.id);
    expect(order(moveItem(items, "c", up, "now"))).toEqual(["c", "a", "b"]);

    const down = menuMoves(filtered, "a", items, MONTH).down!;
    expect(order(moveItem(items, "a", down, "now"))).toEqual(["b", "c", "a"]);
  });

  it("only offers the given columns (past months have no Backlog)", () => {
    expect(menuMoves(columns, "d", items, MONTH, visibleColumns(true)).moveTo).toEqual(["todo", "done"]);
    expect(menuMoves(columns, "missing", items, MONTH)).toEqual({ moveTo: [] });
  });
});

describe("shortTitle", () => {
  it("uses a trailing abbreviation in brackets, else the title", () => {
    expect(shortTitle("Certified Scrum Product Owner (CSPO)")).toBe("CSPO");
    expect(shortTitle("Professional Scrum Product Owner I (PSPO I)")).toBe("PSPO I");
    expect(shortTitle("Google Project Management Professional Certificate")).toBe(
      "Google Project Management Professional Certificate",
    );
  });
});
