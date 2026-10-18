import { describe, expect, it } from "vitest";
import { makeData, makeItem, makeMaterial, makeNote } from "@/lib/testing/fixtures";
import { isEmptyWorkspace } from "./app-data";
import { doneMaterialIds, draftCandidates, goalDescription } from "./plan-draft";

describe("draftCandidates", () => {
  const materials = [
    makeMaterial({ id: "own-1", skillIds: ["roadmapping"], curated: false }),
    makeMaterial({ id: "a", skillIds: ["roadmapping"] }),
    makeMaterial({ id: "b", skillIds: ["communication", "roadmapping"] }),
    makeMaterial({ id: "c", skillIds: ["communication"] }),
    makeMaterial({ id: "d", skillIds: ["roadmapping"] }),
  ];

  it("lists materials tagged with the skill, curated first in catalog order, skipping finished ones", () => {
    const done = doneMaterialIds([makeItem({ materialId: "d", status: "done" }), makeItem({ materialId: "a", status: "todo" })]);
    expect(draftCandidates(materials, "roadmapping", done).map((m) => m.id)).toEqual(["a", "b", "own-1"]);
  });

  it("stops at the limit", () => {
    expect(draftCandidates(materials, "roadmapping", new Set(), 2).map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("goalDescription", () => {
  it("uses the label, or the user's words for 'Something else'", () => {
    expect(goalDescription({ goal: "promotion" })).toBe("A promotion");
    expect(goalDescription({ goal: "other", goalText: " Lead a platform team " })).toBe("Lead a platform team");
    expect(goalDescription({ goal: "other", goalText: "  " })).toBe("Something else");
  });
});

describe("isEmptyWorkspace", () => {
  it("is empty until the user creates something; skills and layout don't count", () => {
    expect(isEmptyWorkspace(makeData({ dashboardLayout: [] }))).toBe(true);
    expect(isEmptyWorkspace(makeData({ notes: [makeNote()] }))).toBe(false);
    expect(isEmptyWorkspace(makeData({ savedMaterialIds: ["inspired"] }))).toBe(false);
    expect(isEmptyWorkspace(makeData({ planItems: [makeItem()] }))).toBe(false);
  });
});
