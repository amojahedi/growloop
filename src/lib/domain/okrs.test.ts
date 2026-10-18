import { describe, expect, it } from "vitest";
import { at, makeItem, makeKeyResult, makeObjective } from "@/lib/testing/fixtures";
import {
  autoLinkKeyResult,
  checkMoveToNextQuarter,
  countKeyResultsForItem,
  endedActiveObjectives,
  isPlannable,
  keyResultProgress,
  objectivePace,
  objectiveProgress,
  objectiveSkillIds,
  objectivesInYear,
  objectiveWindow,
  plannableQuarters,
  roomInYear,
  wizardScope,
} from "./okrs";
import type { Task } from "./types";

const tasks = (done: number, total: number): Task[] =>
  Array.from({ length: total }, (_, i) => ({ id: `t${i}`, title: `Task ${i}`, done: i < done, kind: "milestone" as const }));

describe("keyResultProgress: material", () => {
  const kr = makeKeyResult({ id: "kr", type: "material", materialId: "book", skillId: "roadmapping" });
  const objective = makeObjective({ keyResults: [kr] });

  it("is 0% and 'not on the board' without a linked card", () => {
    const progress = keyResultProgress(kr, objective, [makeItem({ materialId: "book" })]);
    expect(progress).toMatchObject({ type: "material", progress: 0, met: false, item: undefined });
  });

  it("follows the linked card's task completion", () => {
    const item = makeItem({ keyResultId: "kr", status: "in_progress", tasks: tasks(3, 5) });
    expect(keyResultProgress(kr, objective, [item])).toMatchObject({ progress: 60, met: false, item });
  });

  it("is capped at 99% until the card is Done", () => {
    const allTicked = makeItem({ keyResultId: "kr", status: "in_progress", tasks: tasks(5, 5) });
    expect(keyResultProgress(kr, objective, [allTicked])).toMatchObject({ progress: 99, met: false });

    const done = { ...allTicked, status: "done" as const, completedAt: at("2026-10-10") };
    expect(keyResultProgress(kr, objective, [done])).toMatchObject({ progress: 100, met: true });
  });

  it("counts a Done card with unticked tasks as met", () => {
    const done = makeItem({ keyResultId: "kr", status: "done", completedAt: at("2026-10-10"), tasks: tasks(0, 4) });
    expect(keyResultProgress(kr, objective, [done])).toMatchObject({ progress: 100, met: true });
  });

  it("uses the best linked card when several are linked", () => {
    const behind = makeItem({ keyResultId: "kr", status: "todo", tasks: tasks(1, 4) });
    const ahead = makeItem({ keyResultId: "kr", status: "in_progress", tasks: tasks(3, 4) });
    expect(keyResultProgress(kr, objective, [behind, ahead])).toMatchObject({ progress: 75, item: ahead });
  });
});

describe("keyResultProgress: certification", () => {
  const kr = makeKeyResult({ id: "kr", type: "certification", materialId: "cert" });
  const objective = makeObjective({ keyResults: [kr] });

  it("is preparing (capped) until the card is Done and earned", () => {
    const preparing = makeItem({ keyResultId: "kr", status: "in_progress", tasks: tasks(2, 4) });
    expect(keyResultProgress(kr, objective, [preparing])).toMatchObject({ progress: 50, met: false, awaitingEarned: false });

    const doneNotEarned = makeItem({ keyResultId: "kr", status: "done", completedAt: at("2026-10-10"), tasks: tasks(4, 4) });
    expect(keyResultProgress(kr, objective, [doneNotEarned])).toMatchObject({ progress: 99, met: false, awaitingEarned: true });

    const earned = { ...doneNotEarned, earnedAt: at("2026-10-11") };
    expect(keyResultProgress(kr, objective, [earned])).toMatchObject({ progress: 100, met: true, awaitingEarned: false });
  });
});

describe("keyResultProgress: count", () => {
  const kr = makeKeyResult({ id: "kr", type: "count", count: 4, skillId: "roadmapping" });
  const objective = makeObjective({ quarter: "2026-Q4", keyResults: [kr] });
  const done = (day: string, skillIds = ["roadmapping"]) => makeItem({ status: "done", completedAt: at(day), skillIds });

  it("counts done items tagged with the skill in any position, inside the quarter, without links", () => {
    const items = [
      done("2026-10-01"),
      done("2026-12-31", ["communication", "roadmapping"]),
      done("2026-09-30"), // before the quarter
      done("2027-01-01"), // after it
      done("2026-11-15", ["communication"]), // other skill
      makeItem({ status: "in_progress", skillIds: ["roadmapping"] }),
    ];
    expect(keyResultProgress(kr, objective, items)).toEqual({ type: "count", progress: 50, met: false, done: 2, target: 4 });
  });

  it("is met at N and never shows more than 100%", () => {
    const items = Array.from({ length: 6 }, () => done("2026-11-02"));
    expect(keyResultProgress(kr, objective, items)).toMatchObject({ progress: 100, met: true, done: 6 });
  });

  it("for a moved objective, counts from the original quarter's start to the new quarter's end", () => {
    const moved = makeObjective({ quarter: "2027-Q1", movedFrom: "2026-Q4", keyResults: [kr] });
    expect(objectiveWindow(moved)).toEqual({ start: "2026-10-01", end: "2027-03-31" });
    const items = [done("2026-10-05"), done("2027-03-31"), done("2026-09-30"), done("2027-04-01")];
    expect(keyResultProgress(kr, moved, items)).toMatchObject({ done: 2 });
  });

  it("treats a missing or zero count as 1", () => {
    const loose = makeKeyResult({ type: "count", count: undefined, skillId: "roadmapping" });
    expect(keyResultProgress(loose, objective, [done("2026-10-02")])).toMatchObject({ target: 1, met: true });
  });
});

describe("objectiveProgress", () => {
  const material = makeKeyResult({ id: "m", type: "material", materialId: "book" });
  const count = makeKeyResult({ id: "c", type: "count", count: 3, skillId: "roadmapping" });
  const objective = makeObjective({ keyResults: [material, count] });

  it("is the rounded mean of its key results", () => {
    const items = [
      makeItem({ keyResultId: "m", status: "in_progress", tasks: tasks(1, 3) }), // 33
      makeItem({ status: "done", completedAt: at("2026-10-03"), skillIds: ["roadmapping"] }), // 1 of 3 → 33
    ];
    expect(objectiveProgress(objective, items)).toBe(33);
  });

  it("is 0 without key results, and a closed objective keeps its final score", () => {
    expect(objectiveProgress(makeObjective(), [])).toBe(0);
    expect(objectiveProgress({ ...objective, status: "closed", finalProgress: 64 }, [])).toBe(64);
  });

  it("derives the objective's skills from its key results", () => {
    const mixed = makeObjective({
      keyResults: [makeKeyResult({ skillId: "b" }), makeKeyResult({ skillId: "a" }), makeKeyResult({ skillId: "b" })],
    });
    expect(objectiveSkillIds(mixed)).toEqual(["b", "a"]);
  });
});

describe("objectivePace", () => {
  const objective = makeObjective({ quarter: "2026-Q4" });

  it("compares progress with the share of the quarter that has passed", () => {
    // 2026-11-15 is day 46 of 92 → 50% expected.
    expect(objectivePace(objective, 60, "2026-11-15")).toEqual({ kind: "ahead", expected: 50 });
    expect(objectivePace(objective, 59, "2026-11-15")).toEqual({ kind: "on", expected: 50 });
    expect(objectivePace(objective, 40, "2026-11-15")).toEqual({ kind: "on", expected: 50 });
    expect(objectivePace(objective, 39, "2026-11-15")).toEqual({ kind: "behind", expected: 50 });
  });

  it("says when a future quarter starts, and how a closed objective ended", () => {
    expect(objectivePace(makeObjective({ quarter: "2027-Q1" }), 0, "2026-11-15")).toEqual({ kind: "upcoming", startsOn: "2027-01-01" });
    expect(objectivePace({ ...objective, status: "closed", finalProgress: 64 }, 64, "2027-01-02")).toEqual({
      kind: "closed",
      finalProgress: 64,
      met: false,
    });
    expect(objectivePace({ ...objective, status: "closed", finalProgress: 100 }, 100, "2027-01-02")).toMatchObject({ met: true });
  });

  it("flags an active objective whose quarter ended (waiting for the review)", () => {
    expect(objectivePace(objective, 30, "2027-01-02")).toEqual({ kind: "ended" });
  });
});

describe("plannable window and caps (O-1)", () => {
  it("runs from the current quarter through Q4 of next year", () => {
    expect(plannableQuarters("2026-10-18")).toEqual(["2026-Q4", "2027-Q1", "2027-Q2", "2027-Q3", "2027-Q4"]);
    expect(plannableQuarters("2027-01-01")).toHaveLength(8);
    expect(isPlannable("2026-Q3", "2026-10-18")).toBe(false);
    expect(isPlannable("2028-Q1", "2026-10-18")).toBe(false);
  });

  it("counts active and closed objectives toward a year's cap of 4", () => {
    const objectives = [
      makeObjective({ quarter: "2027-Q1" }),
      makeObjective({ quarter: "2027-Q2", status: "closed", finalProgress: 50 }),
      makeObjective({ quarter: "2026-Q4" }),
    ];
    expect(objectivesInYear(objectives, 2027)).toBe(2);
    expect(roomInYear(objectives, 2027)).toBe(2);
    expect(roomInYear([...objectives, ...Array.from({ length: 5 }, () => makeObjective({ quarter: "2027-Q3" }))], 2027)).toBe(0);
  });
});

describe("wizardScope", () => {
  it("covers every empty quarter in the window", () => {
    expect(wizardScope([], "2026-10-18")).toEqual(["2026-Q4", "2027-Q1", "2027-Q2", "2027-Q3", "2027-Q4"]);
  });

  it("skips quarters with an active objective, but not ones whose objective closed", () => {
    const objectives = [makeObjective({ quarter: "2027-Q1" }), makeObjective({ quarter: "2027-Q2", status: "closed", finalProgress: 0 })];
    // 2027 already has 2 of its 4 objectives, so two of its three open quarters fit.
    expect(wizardScope(objectives, "2026-10-18")).toEqual(["2026-Q4", "2027-Q2", "2027-Q3"]);
  });

  it("skips the current quarter when fewer than 6 weeks remain", () => {
    // Nov 19: 43 days left (6.1 weeks); Nov 21: 41 days (5.9 weeks).
    expect(wizardScope([], "2026-11-19")[0]).toBe("2026-Q4");
    expect(wizardScope([], "2026-11-21")[0]).toBe("2027-Q1");
  });

  it("stops taking quarters once a year would exceed its cap", () => {
    const objectives = [
      makeObjective({ quarter: "2027-Q1", status: "closed", finalProgress: 10 }),
      makeObjective({ quarter: "2027-Q1", status: "closed", finalProgress: 20 }),
      makeObjective({ quarter: "2027-Q2" }),
    ];
    // 2027 has 3 of 4: only its first empty quarter fits.
    expect(wizardScope(objectives, "2026-10-18")).toEqual(["2026-Q4", "2027-Q1"]);
  });

  it("is empty when every quarter is taken", () => {
    const quarters = ["2026-Q4", "2027-Q1", "2027-Q2", "2027-Q3", "2027-Q4"];
    expect(wizardScope(quarters.map((quarter) => makeObjective({ quarter })), "2026-10-18")).toEqual([]);
  });
});

describe("quarter close and the one move (O-9)", () => {
  it("finds active objectives in ended quarters", () => {
    const ended = makeObjective({ quarter: "2026-Q3" });
    const closed = makeObjective({ quarter: "2026-Q3", status: "closed", finalProgress: 40 });
    const current = makeObjective({ quarter: "2026-Q4" });
    expect(endedActiveObjectives([ended, closed, current], "2026-10-01")).toEqual([ended]);
  });

  it("allows one move to the next quarter while it is in the window", () => {
    const objective = makeObjective({ quarter: "2026-Q3" });
    expect(checkMoveToNextQuarter(objective, [objective], "2026-10-01")).toEqual({ ok: true, to: "2026-Q4" });
    expect(checkMoveToNextQuarter({ ...objective, movedFrom: "2026-Q2" }, [objective], "2026-10-01")).toEqual({
      ok: false,
      reason: "already-moved",
      to: "2026-Q4",
    });
  });

  it("hides the move when the next quarter was missed entirely", () => {
    const old = makeObjective({ quarter: "2026-Q2" });
    expect(checkMoveToNextQuarter(old, [old], "2026-10-01")).toEqual({ ok: false, reason: "outside-window" });
  });

  it("blocks a move into a full year, but a move within the same year takes no new slot", () => {
    const q4 = makeObjective({ quarter: "2026-Q4" });
    const full2027 = Array.from({ length: 4 }, (_, i) => makeObjective({ quarter: `2027-Q${i + 1}` }));
    expect(checkMoveToNextQuarter(q4, [q4, ...full2027], "2027-01-05")).toEqual({ ok: false, reason: "year-full", to: "2027-Q1" });

    const q3 = makeObjective({ quarter: "2026-Q3" });
    const full2026 = [q3, ...Array.from({ length: 3 }, () => makeObjective({ quarter: "2026-Q4" }))];
    expect(checkMoveToNextQuarter(q3, full2026, "2026-10-05")).toEqual({ ok: true, to: "2026-Q4" });
  });
});

describe("links between cards and key results", () => {
  const material = makeKeyResult({ id: "m", type: "material", materialId: "book" });
  const cert = makeKeyResult({ id: "c", type: "certification", materialId: "cert" });
  const count = makeKeyResult({ id: "n", type: "count", skillId: "roadmapping" });

  it("auto-links a new card for a KR's target material, earliest quarter first", () => {
    const later = makeKeyResult({ id: "later", type: "material", materialId: "book" });
    const objectives = [
      makeObjective({ quarter: "2027-Q1", keyResults: [later] }),
      makeObjective({ quarter: "2026-Q4", keyResults: [material, cert, count] }),
    ];
    expect(autoLinkKeyResult("book", objectives, [])?.id).toBe("m");
    expect(autoLinkKeyResult("cert", objectives, [])?.id).toBe("c");
    expect(autoLinkKeyResult("other", objectives, [])).toBeUndefined();
    // The current-quarter KR already has its card, so the next one is linked.
    expect(autoLinkKeyResult("book", objectives, [makeItem({ keyResultId: "m" })])?.id).toBe("later");
  });

  it("never auto-links to closed objectives or archived years", () => {
    const closed = makeObjective({ quarter: "2026-Q4", status: "closed", finalProgress: 50, keyResults: [material] });
    expect(autoLinkKeyResult("book", [closed], [])).toBeUndefined();
    const archived = makeObjective({ quarter: "2025-Q4", keyResults: [material] });
    expect(autoLinkKeyResult("book", [archived], [], [2025])).toBeUndefined();
  });

  it("lists the quarter's count KRs a card counts toward by skill", () => {
    const objectives = [
      makeObjective({ quarter: "2026-Q4", keyResults: [material, count] }),
      makeObjective({ quarter: "2026-Q4", status: "closed", finalProgress: 0, keyResults: [makeKeyResult({ skillId: "roadmapping" })] }),
      makeObjective({ quarter: "2027-Q1", keyResults: [makeKeyResult({ skillId: "roadmapping" })] }),
    ];
    const result = countKeyResultsForItem({ skillIds: ["communication", "roadmapping"] }, objectives, "2026-Q4");
    expect(result.map((entry) => entry.keyResult.id)).toEqual(["n"]);
    expect(countKeyResultsForItem({ skillIds: ["communication"] }, objectives, "2026-Q4")).toEqual([]);
  });
});
