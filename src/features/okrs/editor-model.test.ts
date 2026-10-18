import { describe, expect, it } from "vitest";
import { makeKeyResult, makeMaterial, makeObjective, makeSkill } from "@/lib/testing/fixtures";
import {
  allProblems,
  blankObjective,
  changeKeyResult,
  draftFromForms,
  fieldIds,
  fixLabel,
  formFromDraft,
  formFromObjective,
  objectiveProblems,
  reviewDraftFrom,
  yearCapProblems,
  type EditorLookup,
  type KeyResultForm,
  type ObjectiveForm,
} from "./editor-model";

const road = makeSkill({ id: "road", name: "Roadmapping" });
const disc = makeSkill({ id: "disc", name: "Discovery" });
const book = makeMaterial({ id: "book", title: "Roadmaps: A Guide", skillIds: ["road"] });
const discBook = makeMaterial({ id: "disc-book", title: "Discovery Book", skillIds: ["disc"] });
const cert = makeMaterial({ id: "cert", type: "certification", title: "Roadmap Pro", skillIds: ["road", "disc"] });
const lookup: EditorLookup = {
  materials: new Map([book, discBook, cert].map((m) => [m.id, m])),
  skills: new Map([road, disc].map((s) => [s.id, s])),
};

const kr = (overrides: Partial<KeyResultForm> = {}): KeyResultForm => ({
  key: "k1",
  skillId: "road",
  type: "material",
  materialId: "book",
  title: "Finish Roadmaps",
  titleEdited: false,
  ...overrides,
});
const form = (overrides: Partial<ObjectiveForm> = {}): ObjectiveForm => ({
  key: "o1",
  quarter: "2027-Q1",
  title: "Lead roadmap talks",
  why: "",
  keyResults: [kr(), kr({ key: "k2", type: "count", materialId: undefined, count: 3, title: "Complete 3 Roadmapping items" })],
  ...overrides,
});

describe("changeKeyResult", () => {
  it("keeps the title following the target until the user edits it", () => {
    const retargeted = changeKeyResult(kr({ skillId: "disc", materialId: "disc-book" }), { materialId: "disc-book" }, lookup);
    expect(retargeted.title).toBe("Finish Discovery Book");

    const edited = changeKeyResult(kr(), { title: "Read it and share 3 ideas" }, lookup);
    expect(edited).toMatchObject({ title: "Read it and share 3 ideas", titleEdited: true });
    expect(changeKeyResult(edited, { materialId: "cert" }, lookup).title).toBe("Read it and share 3 ideas");
  });

  it("hands an emptied title back to the target when the field is left", () => {
    const emptied = changeKeyResult(kr(), { title: "" }, lookup);
    expect(emptied.title).toBe("");
    expect(changeKeyResult(emptied, { resetTitle: true }, lookup)).toMatchObject({ title: "Finish Roadmaps", titleEdited: false });
  });

  it("clears the target when the type changes, defaulting counts to 3", () => {
    const counted = changeKeyResult(kr(), { type: "count" }, lookup);
    expect(counted).toMatchObject({ type: "count", count: 3, materialId: undefined, title: "Complete 3 Roadmapping items" });
    const certification = changeKeyResult(counted, { type: "certification" }, lookup);
    expect(certification).toMatchObject({ type: "certification", count: undefined, materialId: undefined, title: "" });
  });

  it("drops a material that doesn't fit a new skill, and keeps one that does", () => {
    expect(changeKeyResult(kr(), { skillId: "disc" }, lookup).materialId).toBeUndefined();
    const certKr = kr({ type: "certification", materialId: "cert" });
    expect(changeKeyResult(certKr, { skillId: "disc" }, lookup).materialId).toBe("cert");
  });

  it("re-titles a count KR when the count changes", () => {
    const counted = kr({ type: "count", materialId: undefined, count: 3 });
    expect(changeKeyResult(counted, { count: 5 }, lookup).title).toBe("Complete 5 Roadmapping items");
  });
});

describe("objectiveProblems", () => {
  it("accepts a complete objective", () => {
    expect(objectiveProblems(form(), lookup)).toEqual([]);
  });

  it("asks for a title, a skill and a target per KR, with the spec's copy", () => {
    const blank = blankObjective("2027-Q1");
    const problems = objectiveProblems(blank, lookup);
    expect(problems.map((p) => p.message)).toEqual(["Give it a title.", "Pick a skill.", "Pick a material.", "Pick a skill."]);
    expect(problems[0].fieldId).toBe(fieldIds.title(blank));
    expect(problems[2].fieldId).toBe(fieldIds.target(blank, blank.keyResults[0]));
  });

  it("asks for a certification on certification KRs, and treats a missing material as no target", () => {
    const problems = objectiveProblems(
      form({ keyResults: [kr({ type: "certification", materialId: "book" }), kr({ key: "k2", materialId: "gone" })] }),
      lookup,
    );
    expect(problems.map((p) => p.message)).toEqual(["Pick a certification.", "Pick a material."]);
  });
});

describe("yearCapProblems", () => {
  it("flags objectives past the yearly cap, counting saved objectives, latest first", () => {
    const saved = ["2027-Q1", "2027-Q2"].map((quarter) => makeObjective({ quarter }));
    const forms = [form({ key: "a", quarter: "2027-Q3" }), form({ key: "b", quarter: "2027-Q4" }), form({ key: "c", quarter: "2027-Q4" })];
    const problems = yearCapProblems(forms, saved);
    expect(problems).toEqual([{ fieldId: fieldIds.menu({ key: "c" }), message: "2027 already has 4 objectives." }]);
    expect(yearCapProblems(forms.slice(0, 2), saved)).toEqual([]);
  });

  it("orders all problems column by column and counts them for the button", () => {
    const forms = [form({ key: "late", quarter: "2027-Q2", title: "" }), form({ key: "early", title: "" })];
    expect(allProblems(forms, [], lookup).map((p) => p.fieldId)).toEqual([fieldIds.title({ key: "early" }), fieldIds.title({ key: "late" })]);
    expect(fixLabel(2)).toBe("Fix 2 things to accept");
    expect(fixLabel(1)).toBe("Fix 1 thing to accept");
  });
});

describe("conversions", () => {
  it("turns a draft into editor values and back, generating empty KR titles", () => {
    const value = formFromDraft({
      quarter: "2027-Q1",
      title: " Lead roadmap talks ",
      why: "Prepares you to lead.",
      keyResults: [
        { skillId: "road", type: "material", materialId: "book", title: "" },
        { skillId: "road", type: "count", count: 4, title: "Complete 4 Roadmapping items" },
      ],
    });
    expect(value.keyResults.every((k) => !k.titleEdited)).toBe(true);
    expect(draftFromForms("Because.", [value], lookup)).toEqual({
      rationale: "Because.",
      objectives: [
        {
          quarter: "2027-Q1",
          title: "Lead roadmap talks",
          why: "Prepares you to lead.",
          keyResults: [
            { skillId: "road", type: "material", materialId: "book", title: "Finish Roadmaps" },
            { skillId: "road", type: "count", count: 4, title: "Complete 4 Roadmapping items" },
          ],
        },
      ],
    });
  });

  it("edits a saved objective keeping KR ids, and treats custom titles as the user's own", () => {
    const saved = makeObjective({
      id: "obj",
      keyResults: [
        makeKeyResult({ id: "kr-a", type: "material", materialId: "book", skillId: "road", title: "Finish Roadmaps" }),
        makeKeyResult({ id: "kr-b", type: "count", count: 2, skillId: "road", title: "Ship two roadmap reviews" }),
      ],
    });
    const value = formFromObjective(saved, lookup);
    expect(value.key).toBe("obj");
    expect(value.keyResults.map((k) => [k.id, k.titleEdited])).toEqual([
      ["kr-a", false],
      ["kr-b", true],
    ]);
  });

  it("reads a review draft back from the session defensively", () => {
    expect(reviewDraftFrom(undefined)).toBeUndefined();
    const restored = reviewDraftFrom({
      rationale: "R",
      objectives: [
        { quarter: "2027-Q1", title: "T", why: "W", keyResults: [{ skillId: "road", type: "count", count: 2, title: "C" }, { type: "bogus" }] },
        null,
        { title: "no quarter" },
      ],
    } as never);
    expect(restored?.objectives).toHaveLength(1);
    expect(restored?.objectives[0].keyResults).toHaveLength(1);
    expect(restored?.objectives[0].key).toEqual(expect.any(String));
  });
});
