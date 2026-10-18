import { describe, expect, it } from "vitest";
import { DEMO_DATA } from "@/lib/catalog";
import { compareMonths } from "@/lib/domain/dates";
import { makeDataV1, makeLegacyItem, makeLegacyObjective } from "@/lib/testing/fixtures";
import { validateWorkspace } from "./schema";
import { emptyWorkspace, sampleWorkspace, seedBaseMonth, shiftSeed } from "./seed";

const seed = () =>
  makeDataV1({
    planItems: [
      makeLegacyItem({
        id: "carried",
        month: "2026-10",
        carriedFrom: ["2026-09"],
        createdAt: "2026-09-05T09:00:00.000Z",
        completedAt: "2026-10-12T15:00:00.000Z",
        status: "done",
        reminder: { date: "2026-10-24", note: "Finish" },
        timeLogs: [{ id: "log", date: "2026-10-03", hours: 1 }],
        tasks: [{ id: "t", title: "Read", done: true, kind: "custom", completedAt: "2026-10-02T10:00:00.000Z" }],
      }),
      makeLegacyItem({ id: "september", month: "2026-09" }),
    ],
    objectives: [makeLegacyObjective({ quarter: "2026-Q4", createdAt: "2026-10-01T07:00:00.000Z" })],
    rollovers: [{ fromMonth: "2026-09", toMonth: "2026-10", completedAt: "2026-10-01T07:20:00.000Z" }],
  });

describe("shiftSeed", () => {
  it("uses the seed's latest month as its base", () => {
    expect(seedBaseMonth(seed())).toBe("2026-10");
  });

  it("moves months, quarters, timestamps and plain dates by the same offset", () => {
    const shifted = shiftSeed(seed(), "2027-01");
    const [carried, september] = shifted.planItems;

    expect(carried).toMatchObject({
      month: "2027-01",
      carriedFrom: ["2026-12"],
      reminder: { date: "2027-01-24", note: "Finish" },
      timeLogs: [{ date: "2027-01-03" }],
    });
    expect(carried.createdAt.slice(0, 7)).toBe("2026-12");
    expect(carried.completedAt?.slice(0, 7)).toBe("2027-01");
    expect(carried.tasks[0].completedAt?.slice(0, 7)).toBe("2027-01");
    expect(september.month).toBe("2026-12");
    expect(shifted.objectives[0].quarter).toBe("2027-Q1");
    expect(shifted.rollovers[0]).toMatchObject({ fromMonth: "2026-12", toMonth: "2027-01" });
  });

  it("keeps objectives in the current quarter when the shift stays inside it", () => {
    expect(shiftSeed(seed(), "2026-11").objectives[0].quarter).toBe("2026-Q4");
    expect(shiftSeed(seed(), "2027-03").objectives[0].quarter).toBe("2027-Q1");
  });

  it("clamps day-of-month overflow and leaves the input untouched", () => {
    const input = makeDataV1({ planItems: [makeLegacyItem({ month: "2026-10", reminder: { date: "2026-10-31", note: "" } })] });
    const snapshot = structuredClone(input);

    expect(shiftSeed(input, "2026-11").planItems[0].reminder?.date).toBe("2026-11-30");
    expect(input).toEqual(snapshot);
  });

  it("is an identity copy when already in the base month", () => {
    const original = seed();
    expect(shiftSeed(original, "2026-10")).toEqual(original);
  });
});

describe("sampleWorkspace", () => {
  it("seeds the authored sample around the current month, as valid current-schema data", () => {
    const workspace = sampleWorkspace(new Date(2027, 1, 10));

    expect(validateWorkspace(workspace).ok).toBe(true);
    expect(workspace.planItems.map((item) => item.month).sort(compareMonths).at(-1)).toBe("2027-02");
    expect(new Set(workspace.objectives.map((objective) => objective.quarter))).toEqual(new Set(["2027-Q1"]));
    expect(workspace.activity.length).toBeGreaterThan(0);
  });

  it("matches the authored data in its own base month, with summaries and notes as Note records", () => {
    const base = seedBaseMonth(DEMO_DATA);
    const [year, month] = base.split("-").map(Number);
    const workspace = sampleWorkspace(new Date(year, month - 1, 15));

    expect(workspace.planItems.map((item) => item.id)).toEqual(DEMO_DATA.planItems.map((item) => item.id));
    const written = DEMO_DATA.planItems.flatMap((item) => [item.summary, item.notes]).filter((text) => text.trim());
    expect(workspace.notes.map((note) => note.body).sort()).toEqual(written.sort());
  });

  it("starts with the built-in skills and stores no static skill data", () => {
    const workspace = sampleWorkspace(new Date(2026, 9, 18));
    expect(workspace.skills.length).toBe(12);
    expect(workspace.skills.some((skill) => "objectivePhrases" in skill)).toBe(false);
    expect(emptyWorkspace().skills.some((skill) => "objectivePhrases" in skill)).toBe(false);
  });
});
