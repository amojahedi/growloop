import { describe, expect, it } from "vitest";
import { makeItem, makeKeyResult, makeObjective } from "@/lib/testing/fixtures";
import { findKeyResult, keyResultProgress, objectiveProgress, objectivesForQuarter } from "./okrs";

describe("keyResultProgress", () => {
  it("auto mode: done / total of linked items", () => {
    const kr = makeKeyResult({ id: "kr" });
    const items = [
      makeItem({ keyResultId: "kr", status: "done" }),
      makeItem({ keyResultId: "kr", status: "in_progress" }),
      makeItem({ keyResultId: "kr", status: "todo" }),
      makeItem({ keyResultId: "kr", status: "done" }),
      makeItem({ keyResultId: "other", status: "done" }),
    ];

    expect(keyResultProgress(kr, items)).toEqual({ progress: 50, linked: 4, done: 2 });
  });

  it("auto mode with no linked items is 0", () => {
    expect(keyResultProgress(makeKeyResult(), []).progress).toBe(0);
  });

  it("manual mode uses manualProgress, clamped to 0–100", () => {
    const items = [makeItem({ keyResultId: "kr", status: "done" })];

    expect(keyResultProgress(makeKeyResult({ id: "kr", progressMode: "manual", manualProgress: 30 }), items)).toEqual({
      progress: 30,
      linked: 1,
      done: 1,
    });
    expect(keyResultProgress(makeKeyResult({ progressMode: "manual", manualProgress: 140 }), []).progress).toBe(100);
    expect(keyResultProgress(makeKeyResult({ progressMode: "manual" }), []).progress).toBe(0);
  });
});

describe("objectiveProgress", () => {
  it("is the mean of its key results", () => {
    const objective = makeObjective({
      keyResults: [
        makeKeyResult({ id: "auto" }),
        makeKeyResult({ progressMode: "manual", manualProgress: 20 }),
      ],
    });
    const items = [makeItem({ keyResultId: "auto", status: "done" })];

    expect(objectiveProgress(objective, items)).toBe(60);
  });

  it("is 0 without key results", () => {
    expect(objectiveProgress(makeObjective(), [])).toBe(0);
  });
});

describe("lookups", () => {
  it("filters objectives by quarter", () => {
    const q4 = makeObjective({ quarter: "2026-Q4" });
    const q1 = makeObjective({ quarter: "2027-Q1" });
    expect(objectivesForQuarter([q4, q1], "2026-Q4")).toEqual([q4]);
  });

  it("finds a key result with its objective", () => {
    const kr = makeKeyResult({ id: "target" });
    const objective = makeObjective({ keyResults: [makeKeyResult(), kr] });

    expect(findKeyResult([makeObjective(), objective], "target")).toEqual({ objective, keyResult: kr });
    expect(findKeyResult([objective], "missing")).toBeUndefined();
  });
});
