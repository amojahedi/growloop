import { describe, expect, it } from "vitest";
import {
  makeData,
  makeDataV1,
  makeDataV2,
  makeEvent,
  makeItem,
  makeKeyResult,
  makeNote,
  makeObjective,
  makeSkill,
} from "@/lib/testing/fixtures";
import { migrateAppData, MigrationError } from "./migrations";
import { validateWorkspace } from "./schema";
import { exportFileName, parseImportedData, serializeWorkspace } from "./serialization";

const sample = () =>
  makeData({
    profile: { name: "Aisan", role: "pm", goal: "promotion", skillLevels: [{ skillId: "roadmapping", current: 2, target: 4, updatedAt: "2026-10-01T00:00:00Z" }] },
    skills: [makeSkill({ id: "roadmapping" })],
    objectives: [
      makeObjective({ why: "Builds your case.", keyResults: [makeKeyResult({ type: "material", materialId: "book", count: undefined })] }),
      makeObjective({ quarter: "2026-Q3", status: "closed", finalProgress: 64, closedAt: "2026-10-01T08:00:00Z", source: "quick" }),
    ],
    planItems: [
      makeItem({
        skillIds: ["roadmapping"],
        reminder: { date: "2026-10-24", note: "Finish" },
        timeLogs: [{ id: "log", date: "2026-10-03", hours: 1 }],
        tasks: [{ id: "t", title: "Summarize", done: true, kind: "suggested", completedAt: "2026-10-03T10:00:00Z" }],
        earnedAt: "2026-10-04T10:00:00Z",
        summaryNudgedAt: "2026-10-04T10:00:00Z",
      }),
    ],
    notes: [makeNote({ kind: "summary", planItemId: "item-1", materialId: "book", reviewAt: "2026-10-25", refinedAt: "2026-10-04T10:00:00Z" })],
    rollovers: [
      {
        fromMonth: "2026-09",
        toMonth: "2026-10",
        completedAt: "2026-10-01T08:00:00Z",
        counts: { carry_over: 1, backlog: 0, drop: 2 },
        closedObjectiveIds: ["o"],
        movedObjectiveIds: [],
        yearsOffered: [2025],
      },
    ],
    activity: [makeEvent({ kind: "time_logged", hours: 1, refId: "log" })],
    archivedYears: [2025],
    dashboardLayout: [
      { widgetId: "skill-radar", size: "large" },
      { widgetId: "reminders", size: "small" },
    ],
  });

describe("validateWorkspace", () => {
  it("accepts valid data", () => {
    const data = sample();
    expect(validateWorkspace(data)).toEqual({ ok: true, data });
  });

  it("rejects invalid data with a readable error", () => {
    const data = sample();
    const broken = { ...data, planItems: [{ ...data.planItems[0], month: "October", status: "blocked" }] };
    const result = validateWorkspace(broken);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/month/);
      expect(result.error).toMatch(/status/);
    }
  });

  it("rejects malformed notes, key results, profile levels and review days", () => {
    const data = sample();
    expect(validateWorkspace({ ...data, notes: [{ ...data.notes[0], kind: "tag" }] }).ok).toBe(false);
    expect(validateWorkspace({ ...data, notes: [{ ...data.notes[0], reviewAt: "next week" }] }).ok).toBe(false);
    expect(validateWorkspace({ ...data, objectives: [{ ...data.objectives[0], keyResults: [{ id: "k", title: "", type: "count" }] }] }).ok).toBe(false);
    expect(validateWorkspace({ ...data, objectives: [{ ...data.objectives[0], status: "paused" }] }).ok).toBe(false);
    expect(validateWorkspace({ ...data, profile: { skillLevels: [{ skillId: "r", current: 6, target: 4, updatedAt: "2026-10-01T00:00:00Z" }] } }).ok).toBe(false);
  });

  it("keeps saved material ids and rejects malformed ones", () => {
    const data = sample();
    expect(validateWorkspace({ ...data, savedMaterialIds: ["book-inspired"] })).toMatchObject({
      ok: true,
      data: { savedMaterialIds: ["book-inspired"] },
    });
    expect(validateWorkspace({ ...data, savedMaterialIds: [""] }).ok).toBe(false);
    expect(validateWorkspace({ ...data, savedMaterialIds: "book-inspired" }).ok).toBe(false);
  });

  it("rejects other versions and missing collections", () => {
    expect(validateWorkspace({ ...sample(), version: 3 }).ok).toBe(false);
    expect(validateWorkspace({ ...sample(), version: 5 }).ok).toBe(false);
    for (const key of ["activity", "notes", "profile", "archivedYears", "savedMaterialIds"] as const) {
      const { [key]: _removed, ...without } = sample();
      expect(validateWorkspace(without).ok).toBe(false);
    }
  });

  it("validates the dashboard layout", () => {
    const withLayout = (dashboardLayout: unknown) => validateWorkspace({ ...sample(), dashboardLayout }).ok;
    expect(withLayout(null)).toBe(true);
    // Unknown widget ids are allowed (skipped when rendering); malformed placements are not.
    expect(withLayout([{ widgetId: "from-the-future", size: "small" }])).toBe(true);
    expect(withLayout([{ widgetId: "reminders", size: "huge" }])).toBe(false);
    expect(withLayout([{ size: "small" }])).toBe(false);
    const { dashboardLayout: _layout, ...withoutLayout } = sample();
    expect(validateWorkspace(withoutLayout).ok).toBe(false);
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
    expect(migrateAppData(data, 4)).toBe(data);
  });

  it("upgrades v2 data saved before `savedMaterialIds` existed", () => {
    const { savedMaterialIds: _saved, ...olderV2 } = makeDataV2();
    const result = validateWorkspace(migrateAppData(olderV2, 2));
    expect(result).toMatchObject({ ok: true, data: { version: 4, savedMaterialIds: [], dashboardLayout: null } });
  });

  it("refuses to migrate invalid v3, v2 and v1 data", () => {
    expect(() => migrateAppData({ version: 3, skills: "nope" }, 3)).toThrow(/v3/);
    expect(() => migrateAppData({ ...makeDataV2(), activity: "nope" }, 2)).toThrow(/v2/);
    expect(() => migrateAppData({ ...makeDataV1(), skills: "nope" }, 1)).toThrow(MigrationError);
  });

  it("refuses data from a newer version and missing steps", () => {
    expect(() => migrateAppData({}, 5)).toThrow(MigrationError);
    expect(() => migrateAppData({}, 1, {}, 2)).toThrow(/No migration from v1/);
  });
});

describe("export / import", () => {
  it("round-trips through the export format", () => {
    const data = sample();
    const json = serializeWorkspace(data, "2026-10-17T10:00:00.000Z");

    expect(JSON.parse(json)).toMatchObject({ app: "growloop", exportedAt: "2026-10-17T10:00:00.000Z" });
    expect(parseImportedData(json)).toEqual({ ok: true, data });
  });

  it("accepts bare workspace data", () => {
    const data = sample();
    expect(parseImportedData(JSON.stringify(data))).toEqual({ ok: true, data });
  });

  it("imports v1 exports by upgrading them", () => {
    const v1 = makeDataV1({ skills: [makeSkill({ id: "roadmapping" })] });
    const result = parseImportedData(JSON.stringify({ app: "growloop", exportedAt: "2026-09-01T00:00:00Z", data: v1 }));

    expect(result).toMatchObject({
      ok: true,
      data: { version: 4, activity: [], notes: [], savedMaterialIds: [], skills: v1.skills, dashboardLayout: null },
    });
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
    expect(exportFileName(new Date(2026, 9, 17, 23, 30), { sample: true })).toBe("growloop-sample-2026-10-17.json");
  });
});
