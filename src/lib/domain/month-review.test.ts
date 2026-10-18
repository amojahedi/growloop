import { describe, expect, it } from "vitest";
import { at, makeData, makeItem, makeKeyResult, makeNote, makeObjective, makeSkill } from "@/lib/testing/fixtures";
import { applyMonthReview, defaultDecisions, defaultItemDecision, moveChecks, pendingReview, reviewRecap } from "./month-review";
import type { Workspace } from "./types";

const NOW = "2026-11-01T08:00:00.000Z";
const NOV_1 = "2026-11-01";

function octoberLeftovers() {
  return [
    makeItem({ id: "done", month: "2026-10", status: "done", completedAt: at("2026-10-20") }),
    makeItem({ id: "progress", month: "2026-10", status: "in_progress", order: 0 }),
    makeItem({ id: "todo", month: "2026-10", status: "todo", order: 0 }),
    makeItem({ id: "older", month: "2026-09", status: "todo", order: 0, carriedFrom: ["2026-08"] }),
    makeItem({ id: "parked", month: "2026-09", status: "backlog", order: 0 }),
    makeItem({ id: "current", month: "2026-11", status: "todo", order: 0 }),
  ];
}

const item = (data: Workspace, id: string) => data.planItems.find((candidate) => candidate.id === id);

describe("pendingReview: when it is due", () => {
  it("rule 1: unfinished items from earlier months, oldest first; backlog is never reviewed", () => {
    const pending = pendingReview(makeData({ planItems: octoberLeftovers() }), NOV_1);

    expect(pending?.toMonth).toBe("2026-11");
    expect(pending?.unfinished.map((entry) => entry.id)).toEqual(["older", "progress", "todo"]);
    // Several missed months combine into one review.
    expect(pending?.months).toEqual(["2026-09", "2026-10"]);
    expect(pendingReview(makeData({ planItems: [makeItem({ month: "2026-09", status: "backlog" })] }), NOV_1)).toBeNull();
  });

  it("a month where everything was finished and no quarter ended needs no review", () => {
    const planItems = [makeItem({ month: "2026-10", status: "done", completedAt: at("2026-10-05") })];
    expect(pendingReview(makeData({ planItems, objectives: [makeObjective({ quarter: "2026-Q4" })] }), NOV_1)).toBeNull();
  });

  it("rule 2: active objectives in ended quarters, one block per quarter, oldest first", () => {
    const q2 = makeObjective({ id: "q2", quarter: "2026-Q2" });
    const q3 = makeObjective({ id: "q3", quarter: "2026-Q3" });
    const closed = makeObjective({ quarter: "2026-Q3", status: "closed", finalProgress: 50 });
    const pending = pendingReview(makeData({ objectives: [q3, closed, q2, makeObjective({ quarter: "2026-Q4" })] }), "2026-10-01");

    expect(pending?.quarters.map((block) => [block.quarter, block.objectives.map((o) => o.id)])).toEqual([
      ["2026-Q2", ["q2"]],
      ["2026-Q3", ["q3"]],
    ]);
    expect(pending?.months).toEqual(["2026-09"]);
  });

  it("rule 3: an earlier, unarchived year with objectives is offered once", () => {
    const objectives = [makeObjective({ quarter: "2026-Q3", status: "closed", finalProgress: 80 })];
    expect(pendingReview(makeData({ objectives }), "2027-01-02")?.years).toEqual([2026]);
    expect(pendingReview(makeData({ objectives, archivedYears: [2026] }), "2027-01-02")).toBeNull();

    const declined = { fromMonth: "2026-12", toMonth: "2027-01", completedAt: NOW, yearsOffered: [2026] };
    expect(pendingReview(makeData({ objectives, rollovers: [declined] }), "2027-01-02")).toBeNull();
  });

  it("ignores objectives in archived years", () => {
    const stray = makeObjective({ quarter: "2025-Q4" });
    expect(pendingReview(makeData({ objectives: [stray], archivedYears: [2025] }), "2026-10-01")).toBeNull();
  });
});

describe("defaults", () => {
  it("in progress → carry over, to do → backlog, carried twice → backlog", () => {
    expect(defaultItemDecision(makeItem({ status: "in_progress" }))).toBe("carry_over");
    expect(defaultItemDecision(makeItem({ status: "todo" }))).toBe("backlog");
    expect(defaultItemDecision(makeItem({ status: "in_progress", carriedFrom: ["2026-08", "2026-09"] }))).toBe("backlog");
  });

  it("closes objectives and archives years by default", () => {
    const data = makeData({
      planItems: octoberLeftovers(),
      objectives: [makeObjective({ id: "q3", quarter: "2026-Q3" }), makeObjective({ quarter: "2025-Q4", status: "closed", finalProgress: 10 })],
    });
    const decisions = defaultDecisions(pendingReview(data, NOV_1)!);
    expect(decisions).toEqual({
      items: { older: "backlog", progress: "carry_over", todo: "backlog" },
      objectives: { q3: "close" },
      archive: { 2025: true },
    });
  });
});

describe("applyMonthReview: unfinished items", () => {
  const data = () => makeData({ planItems: octoberLeftovers() });

  it("carries items over into the current month, keeping status and recording history", () => {
    const result = applyMonthReview(data(), { items: { progress: "carry_over", older: "carry_over" } }, NOV_1, NOW)!;

    expect(item(result.data, "progress")).toMatchObject({ month: "2026-11", status: "in_progress", order: 0, carriedFrom: ["2026-10"] });
    expect(item(result.data, "older")).toMatchObject({
      month: "2026-11",
      status: "todo",
      order: 1, // appended after the existing November to-do
      carriedFrom: ["2026-08", "2026-09"],
    });
  });

  it("parks items in the backlog and drops items (their notes stay)", () => {
    const withNote = { ...data(), notes: [makeNote({ kind: "summary", planItemId: "todo", materialId: "material-x" })] };
    const result = applyMonthReview(withNote, { items: { progress: "backlog", todo: "drop", older: "carry_over" } }, NOV_1, NOW)!;

    expect(item(result.data, "progress")).toMatchObject({ month: "2026-11", status: "backlog", order: 1, carriedFrom: ["2026-10"] });
    expect(item(result.data, "todo")).toBeUndefined();
    expect(result.data.notes).toEqual(withNote.notes);
  });

  it("applies defaults for anything undecided and ignores decisions for items it doesn't cover", () => {
    const items = octoberLeftovers();
    const result = applyMonthReview(makeData({ planItems: items }), { items: { done: "drop", current: "drop", parked: "drop" } }, NOV_1, NOW)!;

    for (const id of ["done", "current", "parked"]) {
      expect(item(result.data, id)).toBe(items.find((candidate) => candidate.id === id));
    }
    expect(item(result.data, "progress")).toMatchObject({ month: "2026-11", status: "in_progress" });
    expect(item(result.data, "todo")).toMatchObject({ month: "2026-11", status: "backlog" });
  });

  it("records the review with counts, and nothing is pending afterwards", () => {
    const result = applyMonthReview(data(), { items: { progress: "carry_over", todo: "backlog", older: "drop" } }, NOV_1, NOW)!;

    expect(result.record).toEqual({
      fromMonth: "2026-10",
      toMonth: "2026-11",
      completedAt: NOW,
      counts: { carry_over: 1, backlog: 1, drop: 1 },
      closedObjectiveIds: [],
      movedObjectiveIds: [],
      yearsOffered: [],
    });
    expect(result.data.rollovers).toEqual([result.record]);
    expect(pendingReview(result.data, NOV_1)).toBeNull();
  });

  it("does nothing when no review is pending", () => {
    expect(applyMonthReview(makeData(), {}, NOV_1, NOW)).toBeNull();
  });
});

describe("applyMonthReview: quarter close", () => {
  const kr = makeKeyResult({ id: "kr", type: "material", materialId: "book" });
  const objective = makeObjective({ id: "q3", quarter: "2026-Q3", keyResults: [kr] });
  const card = makeItem({
    id: "card",
    month: "2026-09",
    status: "in_progress",
    keyResultId: "kr",
    tasks: [
      { id: "a", title: "A", done: true, kind: "milestone" },
      { id: "b", title: "B", done: false, kind: "milestone" },
    ],
  });

  it("closes at the current score, taken before items change (a dropped card can't lower it)", () => {
    const result = applyMonthReview(makeData({ objectives: [objective], planItems: [card] }), { items: { card: "drop" } }, "2026-10-01", NOW)!;

    expect(result.data.objectives[0]).toMatchObject({ status: "closed", finalProgress: 50, closedAt: NOW });
    expect(result.record.closedObjectiveIds).toEqual(["q3"]);
    expect(result.data.planItems).toEqual([]);
  });

  it("moves once to the next quarter, keeping key results and links", () => {
    const result = applyMonthReview(makeData({ objectives: [objective], planItems: [card] }), { objectives: { q3: "move" } }, "2026-10-01", NOW)!;

    expect(result.data.objectives[0]).toMatchObject({ status: "active", quarter: "2026-Q4", movedFrom: "2026-Q3", keyResults: [kr] });
    expect(result.record.movedObjectiveIds).toEqual(["q3"]);
    expect(item(result.data, "card")?.keyResultId).toBe("kr");
  });

  it("closes instead when the move isn't allowed (already moved, or missed quarter)", () => {
    const movedBefore = { ...objective, movedFrom: "2026-Q2" };
    const second = applyMonthReview(makeData({ objectives: [movedBefore] }), { objectives: { q3: "move" } }, "2026-10-01", NOW)!;
    expect(second.data.objectives[0]).toMatchObject({ status: "closed", quarter: "2026-Q3" });

    const old = { ...objective, quarter: "2026-Q2" };
    const missed = applyMonthReview(makeData({ objectives: [old] }), { objectives: { q3: "move" } }, "2026-10-01", NOW)!;
    expect(missed.data.objectives[0]).toMatchObject({ status: "closed", quarter: "2026-Q2" });
  });

  it("closes a met objective as met", () => {
    const done = { ...card, status: "done" as const, completedAt: at("2026-09-20") };
    const result = applyMonthReview(makeData({ objectives: [objective], planItems: [done] }), { objectives: { q3: "move" } }, "2026-10-01", NOW)!;
    expect(result.data.objectives[0]).toMatchObject({ status: "closed", finalProgress: 100 });
  });
});

describe("moveChecks: the one move, decided in order", () => {
  // 2027 has room for one more objective; two Q4 objectives both want to move into it.
  const first = makeObjective({ id: "first", quarter: "2026-Q4" });
  const second = makeObjective({ id: "second", quarter: "2026-Q4" });
  const taken = Array.from({ length: 3 }, (_, i) => makeObjective({ quarter: `2027-Q${i + 2}` }));
  const data = makeData({ objectives: [first, second, ...taken] });
  const pending = pendingReview(data, "2027-01-05")!;

  it("lets only the first claim the last slot, and the dialog and apply agree", () => {
    const both = { first: "move", second: "move" } as const;
    const checks = moveChecks(pending, data, "2027-01-05", both);
    expect(checks.get("first")).toEqual({ ok: true, to: "2027-Q1" });
    expect(checks.get("second")).toEqual({ ok: false, reason: "year-full", to: "2027-Q1" });

    const result = applyMonthReview(data, { objectives: both, archive: { 2026: false } }, "2027-01-05", NOW)!;
    expect(result.data.objectives.find((o) => o.id === "first")).toMatchObject({ quarter: "2027-Q1", status: "active" });
    expect(result.data.objectives.find((o) => o.id === "second")).toMatchObject({ quarter: "2026-Q4", status: "closed" });
  });

  it("frees the slot again when the first one closes instead", () => {
    const checks = moveChecks(pending, data, "2027-01-05", { first: "close", second: "move" });
    expect(checks.get("second")).toEqual({ ok: true, to: "2027-Q1" });
  });
});

describe("applyMonthReview: year archive", () => {
  const q4 = makeObjective({ id: "q4", quarter: "2026-Q4" });
  const q3 = makeObjective({ id: "q3", quarter: "2026-Q3", status: "closed", finalProgress: 70 });

  it("closes the last quarter and archives the year in one go (January review)", () => {
    const result = applyMonthReview(makeData({ objectives: [q3, q4] }), {}, "2027-01-02", NOW)!;

    expect(result.data.objectives.find((o) => o.id === "q4")).toMatchObject({ status: "closed" });
    expect(result.data.archivedYears).toEqual([2026]);
    expect(result.record.yearsOffered).toEqual([2026]);
    expect(pendingReview(result.data, "2027-01-02")).toBeNull();
  });

  it("keeps a declined year unarchived and doesn't offer it again", () => {
    const result = applyMonthReview(makeData({ objectives: [q3, q4] }), { archive: { 2026: false } }, "2027-01-02", NOW)!;
    expect(result.data.archivedYears).toEqual([]);
    expect(pendingReview(result.data, "2027-01-02")).toBeNull();
  });

  it("doesn't archive a year left without objectives after its last one moved on", () => {
    const result = applyMonthReview(makeData({ objectives: [q4] }), { objectives: { q4: "move" } }, "2027-01-02", NOW)!;
    expect(result.data.objectives[0]).toMatchObject({ quarter: "2027-Q1", movedFrom: "2026-Q4" });
    expect(result.data.archivedYears).toEqual([]);
  });
});

describe("reviewRecap", () => {
  const skills = [makeSkill({ id: "roadmapping" }), makeSkill({ id: "discovery" })];

  it("counts finished and summarized items and the skill that grew most", () => {
    const items = [
      makeItem({ id: "a", status: "done", completedAt: at("2026-10-03"), skillIds: ["discovery"] }),
      makeItem({ id: "b", status: "done", completedAt: at("2026-10-09"), skillIds: ["roadmapping", "discovery"] }),
      makeItem({ id: "c", status: "done", completedAt: at("2026-09-30"), skillIds: ["roadmapping"] }),
      makeItem({ id: "d", status: "in_progress", skillIds: ["roadmapping"] }),
    ];
    const notes = [makeNote({ kind: "summary", planItemId: "a" }), makeNote({ kind: "summary", planItemId: "c" })];

    expect(reviewRecap(items, notes, skills, ["2026-10"])).toEqual({ finished: 2, summarized: 1, topSkillId: "discovery" });
    expect(reviewRecap([], [], skills, ["2026-10"])).toEqual({ finished: 0, summarized: 0, topSkillId: undefined });
  });
});
