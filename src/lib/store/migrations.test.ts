import { describe, expect, it } from "vitest";
import type { WorkspaceV3 } from "@/lib/domain/legacy-types";
import type { Workspace } from "@/lib/domain/types";
import { at, makeDataV1, makeDataV2, makeEvent, makeLegacyItem, makeLegacyKeyResult, makeLegacyObjective, makeSkill } from "@/lib/testing/fixtures";
import v3Export from "./__fixtures__/growloop-v3-export.json";
import { backfillActivity, migrateAppData, MigrationError } from "./migrations";
import { validateWorkspace } from "./schema";
import { parseImportedData } from "./serialization";

const v3 = () => structuredClone(v3Export.data) as WorkspaceV3;

function importV3(): Workspace {
  const result = parseImportedData(JSON.stringify(v3Export));
  if (!result.ok) throw new Error(result.error);
  return result.data;
}

describe("v3 → v4: a realistic export migrates with zero data loss", () => {
  it("imports and validates as v4", () => {
    const data = importV3();
    expect(data.version).toBe(4);
    expect(validateWorkspace(data).ok).toBe(true);
  });

  it("keeps skills, own materials, saved materials, rollovers, activity and the layout unchanged", () => {
    const before = v3();
    const after = importV3();
    expect(after.skills).toEqual(before.skills);
    expect(after.customMaterials).toEqual(before.customMaterials);
    expect(after.savedMaterialIds).toEqual(before.savedMaterialIds);
    expect(after.rollovers).toEqual(before.rollovers);
    expect(after.activity).toEqual(before.activity);
    expect(after.dashboardLayout).toEqual(before.dashboardLayout);
  });

  it("moves every written summary and note into Note records linked to the card and its material", () => {
    const notes = importV3().notes;
    expect(notes).toEqual([
      {
        id: "pi-roadmaps:summary",
        kind: "summary",
        planItemId: "pi-roadmaps",
        materialId: "book-product-roadmaps-relaunched",
        body: "A roadmap is a statement of intent, not a delivery schedule. Themes tied to outcomes let the team decide how.",
        skillIds: ["roadmapping", "a1b2c3d4-negotiation"],
        createdAt: "2026-10-12T18:30:00.000Z",
        updatedAt: "2026-10-12T18:30:00.000Z",
      },
      {
        id: "pi-roadmaps:item_note",
        kind: "item_note",
        planItemId: "pi-roadmaps",
        materialId: "book-product-roadmaps-relaunched",
        body: "Page 42: themes > features.\nAsk Dana about the Q1 bets.",
        skillIds: ["roadmapping", "a1b2c3d4-negotiation"],
        createdAt: "2026-10-04T21:15:00.000Z",
        updatedAt: "2026-10-04T21:15:00.000Z",
      },
      // Written before edit times were recorded: dated from the card's creation.
      expect.objectContaining({ id: "pi-alt-roadmaps:summary", kind: "summary", createdAt: "2026-09-02T09:00:00.000Z" }),
      expect.objectContaining({ id: "pi-cert-open:item_note", body: "Exam voucher expires in March." }),
    ]);

    // Every non-blank text from v3 is somewhere in v4.
    const written = v3().planItems.flatMap((item) => [item.summary, item.notes]).filter((text) => text.trim());
    expect(notes.map((note) => note.body).sort()).toEqual(written.sort());
  });

  it("strips the old text fields from cards and keeps everything else", () => {
    const before = v3().planItems;
    const after = importV3().planItems;
    expect(after.map((item) => item.id)).toEqual(before.map((item) => item.id));
    for (const item of after) {
      expect(item).not.toHaveProperty("notes");
      expect(item).not.toHaveProperty("summary");
      expect(item).not.toHaveProperty("notesUpdatedAt");
      expect(item).not.toHaveProperty("summaryUpdatedAt");
      expect(item).not.toHaveProperty("summaryNudgedAt");
    }
    const roadmaps = after.find((item) => item.id === "pi-roadmaps")!;
    const { notes: _n, notesUpdatedAt: _na, summary: _s, summaryUpdatedAt: _sa, ...rest } = before[0];
    expect(roadmaps).toEqual(rest);
  });

  it("marks Done certifications as earned on their completion day; open ones stay unearned", () => {
    const items = importV3().planItems;
    expect(items.find((item) => item.id === "pi-cert")?.earnedAt).toBe("2026-08-28T16:00:00.000Z");
    expect(items.find((item) => item.id === "pi-cert-open")).not.toHaveProperty("earnedAt");
    expect(items.find((item) => item.id === "pi-alt-roadmaps")).not.toHaveProperty("earnedAt");
  });

  it("turns key results into count KRs on the objective's first skill, counting max(1, linked cards)", () => {
    const [roadmaps, noSkills, empty] = importV3().objectives;

    expect(roadmaps).toEqual({
      id: "obj-roadmaps",
      quarter: "2026-Q4",
      title: "Lead roadmap conversations with confidence",
      why: "Move our team from a feature list to an outcome-based roadmap.",
      status: "active",
      source: "manual",
      keyResults: [
        { id: "kr-roadmap-materials", title: "Finish 3 roadmapping materials", skillId: "roadmapping", type: "count", count: 2 },
        {
          id: "kr-present-roadmap",
          title: "Present a Now / Next / Later roadmap at the December review",
          skillId: "roadmapping",
          type: "count",
          count: 1,
        },
      ],
      createdAt: "2026-10-01T07:00:00.000Z",
    });
    // No skills on the objective: the first visible skill (Stakeholder Management is hidden).
    expect(noSkills.keyResults).toEqual([
      { id: "kr-interviews", title: "Run 12 customer interviews", skillId: "roadmapping", type: "count", count: 1 },
    ]);
    expect(empty).toMatchObject({ id: "obj-empty", keyResults: [], status: "active" });
    expect(empty).not.toHaveProperty("why");
  });

  it("keeps card links to key results", () => {
    const links = Object.fromEntries(importV3().planItems.map((item) => [item.id, item.keyResultId]));
    expect(links).toMatchObject({ "pi-roadmaps": "kr-roadmap-materials", "pi-alt-roadmaps": "kr-roadmap-materials", "pi-playbook": "kr-interviews" });
  });

  it("adds an empty profile and no archived years", () => {
    const data = importV3();
    expect(data.profile).toEqual({ skillLevels: [] });
    expect(data.archivedYears).toEqual([]);
  });

  it("is deterministic, so two tabs migrating the same save agree", () => {
    expect(importV3()).toEqual(importV3());
  });

  it("refuses key results when the workspace has no skills at all", () => {
    const broken = {
      ...v3(),
      skills: [],
      objectives: [makeLegacyObjective({ keyResults: [makeLegacyKeyResult()] })],
    };
    expect(() => migrateAppData(broken, 3)).toThrow(MigrationError);
  });
});

describe("older saves reach v4 through every step", () => {
  it("upgrades v1 data, backfilling the activity log and extracting notes", () => {
    const v1 = makeDataV1({
      skills: [makeSkill({ id: "roadmapping" })],
      planItems: [makeLegacyItem({ id: "done", status: "done", completedAt: at("2026-10-03"), summary: "Kept", summaryUpdatedAt: at("2026-10-04") })],
    });
    const result = validateWorkspace(migrateAppData(v1, 1));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.version).toBe(4);
      expect(result.data.activity.map((event) => event.kind)).toEqual(["item_completed", "summary_edited"]);
      expect(result.data.notes).toEqual([expect.objectContaining({ planItemId: "done", body: "Kept" })]);
    }
  });

  it("upgrades v2 data to the default dashboard layout", () => {
    const v2 = makeDataV2({ skills: [makeSkill({ id: "roadmapping" })], activity: [makeEvent()] });
    expect(migrateAppData(v2, 2)).toMatchObject({ version: 4, dashboardLayout: null, activity: v2.activity });
  });
});

describe("backfillActivity (v1 → v2)", () => {
  it("rebuilds a log from the timestamps on v1 items", () => {
    const task = (id: string, done: boolean) => ({ id, title: id, done, kind: "custom" as const });
    const items = [
      makeLegacyItem({
        status: "done",
        completedAt: at("2026-10-03"),
        summary: "s",
        summaryUpdatedAt: at("2026-10-04"),
        tasks: [{ ...task("t1", true), completedAt: at("2026-10-02") }, task("t2", false)],
        timeLogs: [{ id: "l1", date: "2026-10-03", hours: 1 }],
      }),
      makeLegacyItem({ notes: "n", notesUpdatedAt: at("2026-10-10") }),
      // A summary timestamp with an empty summary is not activity.
      makeLegacyItem({ summary: "", summaryUpdatedAt: at("2026-10-11") }),
    ];
    const log = backfillActivity(items);

    expect(log.map((event) => [event.day, event.kind])).toEqual([
      ["2026-10-02", "task_completed"],
      ["2026-10-03", "time_logged"],
      ["2026-10-03", "item_completed"],
      ["2026-10-04", "summary_edited"],
      ["2026-10-10", "notes_edited"],
    ]);
    expect(new Set(log.map((event) => event.id)).size).toBe(log.length);
  });
});
