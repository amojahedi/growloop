import { describe, expect, it } from "vitest";
import { makeItem, makeKeyResult, makeMaterial, makeObjective, makeSkill } from "@/lib/testing/fixtures";
import type { DraftKeyResult, DraftObjective, PlanDraft, WizardAnswers } from "./plan-draft";
import { repairDraft, type RepairContext } from "./plan-repair";

const skills = [
  makeSkill({ id: "road", name: "Roadmapping" }),
  makeSkill({ id: "disc", name: "Discovery" }),
  makeSkill({ id: "other", name: "Other" }),
];
const materials = [
  makeMaterial({ id: "book", title: "Roadmaps: A Guide", skillIds: ["road"] }),
  makeMaterial({ id: "disc-book", title: "Discovery Book", skillIds: ["disc"] }),
  makeMaterial({ id: "cert", type: "certification", title: "Roadmap Pro", skillIds: ["road"] }),
];
const answers: WizardAnswers = {
  role: "pm",
  goal: "leadership",
  skills: [
    { skillId: "road", current: 1, target: 4 },
    { skillId: "disc", current: 3, target: 4 },
  ],
};
const context: RepairContext = {
  scope: ["2027-Q1", "2027-Q2", "2027-Q3"],
  answers,
  skills,
  materials,
  objectives: [],
  items: [],
  today: "2026-10-18",
};

const count = (overrides: Partial<DraftKeyResult> = {}): DraftKeyResult => ({
  skillId: "road",
  type: "count",
  count: 3,
  title: "Complete 3 Roadmapping items",
  ...overrides,
});
const material = (overrides: Partial<DraftKeyResult> = {}): DraftKeyResult => ({
  skillId: "road",
  type: "material",
  materialId: "book",
  title: "Finish Roadmaps",
  ...overrides,
});
const objective = (overrides: Partial<DraftObjective> = {}): DraftObjective => ({
  quarter: "2027-Q1",
  title: "Lead roadmap talks",
  why: "Prepares you to lead.",
  keyResults: [material(), count()],
  ...overrides,
});
const repair = (objectives: DraftObjective[], extra: Partial<RepairContext> = {}, rationale = "Roadmaps first.") =>
  repairDraft({ rationale, objectives } satisfies PlanDraft, { ...context, ...extra });
const repaired = (...args: Parameters<typeof repair>) => {
  const result = repair(...args);
  if (!result.ok) throw new Error("expected a repaired draft");
  return result.draft;
};

describe("repairDraft", () => {
  it("keeps a valid draft as it is", () => {
    const draft = { rationale: "Roadmaps first.", objectives: [objective()] };
    expect(repairDraft(draft, context)).toEqual({ ok: true, draft });
  });

  it("drops objectives outside the scope and beyond one per quarter, and sorts by quarter", () => {
    const draft = repaired([
      objective({ quarter: "2027-Q3", title: "Third" }),
      objective({ quarter: "2026-Q4", title: "Outside" }),
      objective({ quarter: "2027-Q1", title: "First" }),
      objective({ quarter: "2027-Q1", title: "Second for Q1" }),
    ]);
    expect(draft.objectives.map((o) => o.title)).toEqual(["First", "Third"]);
  });

  it("drops objectives beyond the year's cap, counting saved objectives", () => {
    const saved = ["2027-Q1", "2027-Q2", "2027-Q4"].map((quarter) => makeObjective({ quarter, status: "closed" }));
    const draft = repaired([objective({ quarter: "2027-Q2" }), objective({ quarter: "2027-Q3" })], { objectives: saved });
    expect(draft.objectives.map((o) => o.quarter)).toEqual(["2027-Q2"]);
  });

  it("drops KRs on skills outside the focus skills, and certifications that don't point at a certification", () => {
    const draft = repaired([
      objective({
        keyResults: [
          count({ skillId: "other" }),
          count({ skillId: "unknown" }),
          material({ type: "certification", materialId: "book" }),
          material({ type: "certification", materialId: "missing" }),
          material({ type: "certification", materialId: "cert", title: "Earn Roadmap Pro" }),
          count(),
        ],
      }),
    ]);
    expect(draft.objectives[0].keyResults).toEqual([
      { skillId: "road", type: "certification", materialId: "cert", title: "Earn Roadmap Pro" },
      count(),
    ]);
  });

  it("turns a material KR with a bad id into a count KR on the same skill, once", () => {
    const draft = repaired([
      objective({
        keyResults: [material({ materialId: "invented" }), material({ materialId: "disc-book" }), material({ materialId: undefined })],
      }),
    ]);
    // Roadmapping's gap is 3 → 4 items. The other two would count the same items again, so a material fills the second slot.
    expect(draft.objectives[0].keyResults).toEqual([
      { skillId: "road", type: "count", count: 4, title: "Complete 4 Roadmapping items" },
      { skillId: "road", type: "material", materialId: "book", title: "Finish Roadmaps" },
    ]);
  });

  it("uses each material once across the draft: a repeat becomes a count KR, or goes if one exists", () => {
    const draft = repaired([
      objective({ keyResults: [material(), count({ skillId: "disc", count: 2, title: "Complete 2 Discovery items" })] }),
      objective({ quarter: "2027-Q2", keyResults: [material(), count()] }),
      objective({ quarter: "2027-Q3", keyResults: [material(), material({ type: "certification", materialId: "cert", title: "Earn it" })] }),
    ]);
    expect(draft.objectives[1].keyResults).toEqual([
      count(),
      // The repeat went (the objective already counts Roadmapping); Discovery fills the second slot.
      { skillId: "disc", type: "count", count: 2, title: "Complete 2 Discovery items" },
    ]);
    expect(draft.objectives[2].keyResults).toEqual([
      { skillId: "road", type: "count", count: 4, title: "Complete 4 Roadmapping items" },
      { skillId: "road", type: "certification", materialId: "cert", title: "Earn it" },
    ]);
  });

  it("never targets finished materials or ones active objectives already target", () => {
    const done = [makeItem({ materialId: "book", status: "done" })];
    expect(repaired([objective()], { items: done }).objectives[0].keyResults.map((kr) => kr.type)).toEqual(["count", "count"]);

    const saved = [makeObjective({ quarter: "2026-Q4", keyResults: [makeKeyResult({ type: "certification", materialId: "cert" })] })];
    const draft = repaired([objective({ keyResults: [material(), material({ type: "certification", materialId: "cert" })] })], { objectives: saved });
    expect(draft.objectives[0].keyResults.map((kr) => kr.type)).toEqual(["material", "count"]);
  });

  it("keeps one count KR per skill in an objective", () => {
    const draft = repaired([objective({ keyResults: [count(), count({ count: 2 }), count({ skillId: "disc", count: 2 })] })]);
    expect(draft.objectives[0].keyResults.map((kr) => [kr.skillId, kr.count])).toEqual([
      ["road", 3],
      ["disc", 2],
    ]);
  });

  it("clamps counts to 1–10 and fixes titles that named the old count", () => {
    const draft = repaired([
      objective({ keyResults: [count({ count: 15, title: "Complete 15 items" }), count({ skillId: "disc", count: 0 })] }),
      objective({ quarter: "2027-Q2", keyResults: [material({ skillId: "disc", materialId: "disc-book" }), count({ count: 2.6 })] }),
    ]);
    expect(draft.objectives.flatMap((o) => o.keyResults).filter((kr) => kr.type === "count").map((kr) => [kr.count, kr.title])).toEqual([
      [10, "Complete 10 Roadmapping items"],
      [1, "Complete 1 Discovery item"],
      [3, "Complete 3 Roadmapping items"],
    ]);
  });

  it("sizes a count KR without a count from the gap", () => {
    const draft = repaired([objective({ keyResults: [material(), count({ skillId: "disc", count: undefined, title: "" })] })]);
    expect(draft.objectives[0].keyResults[1]).toEqual({ skillId: "disc", type: "count", count: 2, title: "Complete 2 Discovery items" });
  });

  it("adds a count KR to an objective left with one, and truncates to three", () => {
    const single = repaired([objective({ keyResults: [material()] })]);
    expect(single.objectives[0].keyResults).toEqual([material(), { skillId: "road", type: "count", count: 4, title: "Complete 4 Roadmapping items" }]);

    const many = repaired([
      objective({ keyResults: [material(), count(), count({ skillId: "disc", count: 2 }), material({ type: "certification", materialId: "cert" })] }),
    ]);
    expect(many.objectives[0].keyResults).toHaveLength(3);
  });

  it("drops an objective with no usable KR, and fails when nothing survives", () => {
    expect(repair([objective({ keyResults: [count({ skillId: "other" })] })])).toEqual({ ok: false, reason: "empty" });
    expect(repair([])).toEqual({ ok: false, reason: "empty" });
    expect(repair([objective({ quarter: "2030-Q1" })])).toEqual({ ok: false, reason: "empty" });
  });

  it("regenerates empty titles, whys and the rationale with the quick-draft templates", () => {
    const draft = repaired(
      [
        objective({ title: "", why: " ", keyResults: [material({ title: "" }), count({ title: "" })] }),
        objective({ quarter: "2027-Q2", title: "", keyResults: [material({ skillId: "disc", materialId: "disc-book", title: "" }), count({ skillId: "disc" })] }),
        objective({ quarter: "2027-Q3", title: "", keyResults: [count(), count()] }),
      ],
      {},
      "",
    );
    expect(draft.rationale).toBe("Biggest gaps first: Roadmapping, then Discovery.");
    expect(draft.objectives.map((o) => o.title)).toEqual([
      // Test skills aren't built in: the custom-skill phrases apply.
      "Get stronger at Roadmapping",
      "Get stronger at Discovery",
      "Go deeper in Roadmapping",
    ]);
    expect(draft.objectives[0].why).toBe("Prepares you to lead.");
    expect(draft.objectives[0].keyResults.map((kr) => kr.title)).toEqual(["Finish Roadmaps", "Complete 3 Roadmapping items"]);
    expect(draft.objectives[1].keyResults[0].title).toBe("Finish Discovery Book");
  });

  it("truncates text to the schema limits", () => {
    const draft = repaired([objective({ title: "t".repeat(90), why: "w".repeat(150) })], {}, "r".repeat(250));
    expect(draft.objectives[0].title).toHaveLength(70);
    expect(draft.objectives[0].why).toHaveLength(120);
    expect(draft.rationale).toHaveLength(200);
  });

  it("never lets a KR keep a target that doesn't fit its type", () => {
    const draft = repaired([objective({ keyResults: [{ ...material(), count: 4 }, { ...count(), materialId: "book" }] })]);
    expect(draft.objectives[0].keyResults[0]).not.toHaveProperty("count");
    expect(draft.objectives[0].keyResults[1]).not.toHaveProperty("materialId");
  });

  it("keeps saved objectives untouched (they only count toward the cap)", () => {
    const saved = makeObjective({ quarter: "2027-Q1", keyResults: [makeKeyResult()] });
    const draft = repaired([objective({ quarter: "2027-Q2" })], { objectives: [saved] });
    expect(draft.objectives).toHaveLength(1);
  });
});
