import { describe, expect, it } from "vitest";
import { makeData, makeItem, makeObjective, makeKeyResult, makeSkill } from "@/lib/testing/fixtures";
import { migrateAppData, MigrationError } from "./migrations";
import { validateAppData } from "./schema";
import { exportFileName, parseImportedData, serializeAppData } from "./serialization";

const sample = () =>
  makeData({
    skills: [makeSkill({ id: "roadmapping" })],
    objectives: [makeObjective({ keyResults: [makeKeyResult({ progressMode: "manual", manualProgress: 40 })] })],
    planItems: [
      makeItem({
        skillIds: ["roadmapping"],
        reminder: { date: "2026-10-24", note: "Finish" },
        timeLogs: [{ id: "log", date: "2026-10-03", hours: 1 }],
        tasks: [{ id: "t", title: "Summarize", done: true, kind: "suggested", completedAt: "2026-10-03T10:00:00Z" }],
      }),
    ],
    rollovers: [
      { fromMonth: "2026-09", toMonth: "2026-10", completedAt: "2026-10-01T08:00:00Z", counts: { carry_over: 1, backlog: 0, drop: 2 } },
    ],
  });

describe("validateAppData", () => {
  it("accepts valid data", () => {
    const data = sample();
    expect(validateAppData(data)).toEqual({ ok: true, data });
  });

  it("rejects invalid data with a readable error", () => {
    const data = sample();
    const broken = { ...data, planItems: [{ ...data.planItems[0], month: "October", status: "blocked" }] };
    const result = validateAppData(broken);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/month/);
      expect(result.error).toMatch(/status/);
    }
  });

  it("rejects an unknown version", () => {
    expect(validateAppData({ ...sample(), version: 2 }).ok).toBe(false);
  });
});

describe("migrateAppData", () => {
  it("runs each step from the stored version up to the target", () => {
    const steps = {
      1: (data: Record<string, unknown>) => ({ ...data, version: 2, tags: [] }),
      2: (data: Record<string, unknown>) => ({ ...data, version: 3, renamed: true }),
    };
    expect(migrateAppData({ version: 1 }, 1, steps, 3)).toEqual({ version: 3, tags: [], renamed: true });
  });

  it("is a no-op at the current version", () => {
    const data = sample();
    expect(migrateAppData(data, 1)).toBe(data);
  });

  it("refuses data from a newer version and missing steps", () => {
    expect(() => migrateAppData({}, 5)).toThrow(MigrationError);
    expect(() => migrateAppData({}, 1, {}, 2)).toThrow(/No migration from v1/);
  });
});

describe("export / import", () => {
  it("round-trips through the export format", () => {
    const data = sample();
    const json = serializeAppData(data, "2026-10-17T10:00:00.000Z");

    expect(JSON.parse(json)).toMatchObject({ app: "growloop", exportedAt: "2026-10-17T10:00:00.000Z" });
    expect(parseImportedData(json)).toEqual({ ok: true, data });
  });

  it("accepts a bare AppData object", () => {
    const data = sample();
    expect(parseImportedData(JSON.stringify(data))).toEqual({ ok: true, data });
  });

  it("explains why an import failed", () => {
    expect(parseImportedData("{not json")).toEqual({ ok: false, error: "The file is not valid JSON." });
    expect(parseImportedData("42")).toMatchObject({ ok: false });
    expect(parseImportedData(JSON.stringify({ skills: [] }))).toEqual({
      ok: false,
      error: "The file is missing a data version.",
    });
    expect(parseImportedData(JSON.stringify({ ...sample(), version: 9 }))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/newer version/),
    });
    expect(parseImportedData(JSON.stringify({ ...sample(), skills: "nope" }))).toMatchObject({ ok: false });
  });

  it("suggests a file name with the local date", () => {
    expect(exportFileName(new Date(2026, 9, 17, 23, 30))).toBe("growloop-2026-10-17.json");
  });
});
