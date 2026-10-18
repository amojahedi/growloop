import { describe, expect, it } from "vitest";
import { BUILT_IN_SKILLS, CURATED_MATERIALS, storedSkill } from "@/lib/catalog";
import { makeItem, makeKeyResult, makeMaterial, makeObjective, makeSkill } from "@/lib/testing/fixtures";
import { wizardScope } from "./okrs";
import type { WizardAnswers } from "./plan-draft";
import {
  countForGap,
  keyResultAutoTitle,
  objectiveTitle,
  orderSkillsByGap,
  pickMaterial,
  quickDraft,
  rationaleLine,
  shortTitle,
  whyLine,
} from "./plan-drafter";
import { repairDraft } from "./plan-repair";

const skills = BUILT_IN_SKILLS.map(storedSkill);
const TODAY = "2026-10-18";

const answers: WizardAnswers = {
  role: "pm",
  goal: "promotion",
  skills: [
    { skillId: "product-discovery", current: 2, target: 4 },
    { skillId: "roadmapping", current: 1, target: 4 },
    { skillId: "stakeholder-management", current: 3, target: 4 },
  ],
};

const draft = (overrides: Partial<Parameters<typeof quickDraft>[0]> = {}) =>
  quickDraft({
    answers,
    scope: wizardScope([], TODAY),
    today: TODAY,
    skills,
    materials: CURATED_MATERIALS,
    items: [],
    ...overrides,
  });

describe("quickDraft", () => {
  it("drafts the rest of 2026 and 2027 from the catalog (snapshot)", () => {
    expect(draft()).toMatchSnapshot();
  });

  it("is deterministic: the same answers and data give the same plan", () => {
    expect(draft()).toEqual(draft());
  });

  it("drafts one objective per quarter in scope, biggest gap first, cycling the skills", () => {
    const { objectives } = draft();
    expect(objectives.map((o) => o.quarter)).toEqual(["2026-Q4", "2027-Q1", "2027-Q2", "2027-Q3", "2027-Q4"]);
    expect(objectives.map((o) => o.keyResults[0].skillId)).toEqual([
      "roadmapping",
      "product-discovery",
      "stakeholder-management",
      "roadmapping",
      "product-discovery",
    ]);
    // Every KR works on the objective's skill.
    for (const objective of objectives) {
      expect(new Set(objective.keyResults.map((kr) => kr.skillId)).size).toBe(1);
    }
  });

  it("titles objectives from the phrase table in data: phrase A, phrase B, then 'Keep growing'", () => {
    const { objectives } = quickDraft({
      answers: { ...answers, skills: answers.skills.slice(1, 2).concat({ skillId: "prioritization", current: 4, target: 5 }) },
      scope: ["2027-Q1", "2027-Q2", "2027-Q3", "2027-Q4"],
      today: TODAY,
      skills,
      materials: CURATED_MATERIALS,
      items: [],
    });
    expect(objectives.map((o) => o.title)).toEqual([
      "Lead roadmap conversations with confidence",
      "Say no with clear reasons",
      "Run an outcome-based roadmap",
      "Make trade-offs the team trusts",
    ]);
    expect(objectiveTitle({ id: "roadmapping", name: "Roadmapping" }, 3)).toBe("Keep growing in Roadmapping");
  });

  it("gives every objective a material KR and a count KR sized by the gap, and nothing else", () => {
    const { objectives } = draft();
    for (const objective of objectives) {
      expect(objective.keyResults).toHaveLength(2);
      expect(objective.keyResults[0].type).toBe("material");
      expect(objective.keyResults[1].type).toBe("count");
    }
    // Roadmapping gap 3 → 4, Discovery gap 2 → 3, Stakeholders gap 1 → 2.
    expect(objectives.map((o) => o.keyResults[1].count)).toEqual([4, 3, 2, 4, 3]);
    expect(objectives[0].keyResults[1].title).toBe("Complete 4 Roadmapping items");
    expect(objectives.flatMap((o) => o.keyResults).some((kr) => kr.type === "certification")).toBe(false);
  });

  it("skips materials active objectives already target", () => {
    const first = draft().objectives[0].keyResults[0].materialId!;
    const saved = [makeObjective({ quarter: "2027-Q1", keyResults: [makeKeyResult({ type: "material", materialId: first })] })];
    expect(draft({ objectives: saved }).objectives.map((o) => o.keyResults[0].materialId)).not.toContain(first);
  });

  it("never reuses a material and skips finished ones", () => {
    const first = draft();
    const ids = first.objectives.map((o) => o.keyResults[0].materialId);
    expect(new Set(ids).size).toBe(ids.length);

    const doneId = first.objectives[0].keyResults[0].materialId!;
    const again = draft({ items: [makeItem({ materialId: doneId, status: "done" })] });
    expect(again.objectives.map((o) => o.keyResults[0].materialId)).not.toContain(doneId);
  });

  it("caps counts at 2 when the current quarter has fewer than 8 weeks left", () => {
    const late = quickDraft({ answers, scope: ["2026-Q4"], today: "2026-11-20", skills, materials: CURATED_MATERIALS, items: [] });
    expect(late.objectives[0].keyResults[1].count).toBe(2);
  });

  it("writes the why from the goal", () => {
    expect(draft().objectives[0].why).toBe("Builds your case for promotion.");
    expect(whyLine({ goal: "move_into_product" })).toBe("Gets you ready for a product role.");
    expect(whyLine({ goal: "stronger" })).toBe("Makes you stronger in your current role.");
    expect(whyLine({ goal: "leadership" })).toBe("Prepares you to lead.");
    expect(whyLine({ goal: "other", goalText: "Lead a platform team." })).toBe("Moves you toward lead a platform team.");
    expect(whyLine({ goal: "other", goalText: "AWS certification" })).toBe("Moves you toward AWS certification.");
    expect(whyLine({ goal: "other", goalText: "x".repeat(90) })).toBe(`Moves you toward ${"x".repeat(60)}.`);
  });

  it("explains the order in the rationale", () => {
    expect(draft().rationale).toBe("Biggest gaps first: Roadmapping, Product Discovery, then Stakeholder Management.");
    expect(rationaleLine(["Roadmapping", "Roadmapping"])).toBe("Biggest gap first: Roadmapping.");
    expect(rationaleLine(["A", "B"])).toBe("Biggest gaps first: A, then B.");
  });

  it("falls back to count KRs and generic titles for a custom skill without materials", () => {
    const custom = makeSkill({ id: "negotiation", name: "Negotiation", builtIn: false });
    const result = quickDraft({
      answers: { ...answers, skills: [{ skillId: "negotiation", current: 1, target: 2 }, answers.skills[0]] },
      scope: ["2027-Q1", "2027-Q2", "2027-Q3"],
      today: TODAY,
      skills: [...skills, custom],
      materials: CURATED_MATERIALS,
      items: [],
    });
    const [first, , third] = result.objectives;
    expect(first.keyResults[0].skillId).toBe("product-discovery");
    expect(result.objectives[1]).toMatchObject({
      title: "Get stronger at Negotiation",
      // Its own count, plus one on the next skill by gap, so no two KRs count the same items.
      keyResults: [
        { skillId: "negotiation", type: "count", count: 2, title: "Complete 2 Negotiation items" },
        { skillId: "product-discovery", type: "count", count: 3, title: "Complete 3 Product Discovery items" },
      ],
    });
    expect(third.title).toBe("Test ideas before they cost engineering time");
  });

  it("passes the repair step unchanged", () => {
    const plan = draft();
    const repaired = repairDraft(plan, {
      scope: wizardScope([], TODAY),
      answers,
      skills,
      materials: CURATED_MATERIALS,
      objectives: [],
      items: [],
      today: TODAY,
    });
    expect(repaired).toEqual({ ok: true, draft: plan });
  });
});

describe("orderSkillsByGap", () => {
  it("sorts by gap, ties in pick order", () => {
    const ordered = orderSkillsByGap([
      { skillId: "a", current: 2, target: 3 },
      { skillId: "b", current: 1, target: 4 },
      { skillId: "c", current: 3, target: 4 },
    ]);
    expect(ordered.map((s) => s.skillId)).toEqual(["b", "a", "c"]);
  });
});

describe("countForGap", () => {
  it("maps gaps 1, 2, 3+ to 2, 3, 4 and caps short quarters at 2", () => {
    expect([0, 1, 2, 3, 4].map((gap) => countForGap(gap, 13))).toEqual([2, 2, 3, 4, 4]);
    expect(countForGap(4, 7.9)).toBe(2);
  });
});

describe("pickMaterial", () => {
  const book = (id: string, level: "beginner" | "intermediate" | "advanced", extra = {}) =>
    makeMaterial({ id, level, type: "book", skillIds: ["s"], ...extra });

  it("takes the first book or course at the wanted level whose first skill matches", () => {
    const materials = [
      book("secondary", "beginner", { skillIds: ["other", "s"] }),
      makeMaterial({ id: "article", type: "article", level: "beginner", skillIds: ["s"] }),
      book("adv", "advanced"),
      book("beg", "beginner"),
      book("beg-2", "beginner"),
    ];
    expect(pickMaterial({ skillId: "s", level: 0, materials, exclude: new Set() })?.id).toBe("beg");
    expect(pickMaterial({ skillId: "s", level: 0, materials, exclude: new Set(["beg"]) })?.id).toBe("beg-2");
  });

  it("falls back to the nearest level, then to other non-certification types", () => {
    const materials = [book("adv", "advanced"), book("int", "intermediate")];
    expect(pickMaterial({ skillId: "s", level: 0, materials, exclude: new Set() })?.id).toBe("int");

    const others = [
      makeMaterial({ id: "cert", type: "certification", level: "beginner", skillIds: ["s"] }),
      makeMaterial({ id: "pod", type: "podcast", level: "advanced", skillIds: ["s"] }),
    ];
    expect(pickMaterial({ skillId: "s", level: 0, materials: others, exclude: new Set() })?.id).toBe("pod");
  });

  it("prefers curated items over the user's own, and finds nothing for an unknown skill", () => {
    const materials = [book("own", "beginner", { curated: false }), book("curated", "beginner")];
    expect(pickMaterial({ skillId: "s", level: 0, materials, exclude: new Set() })?.id).toBe("curated");
    expect(pickMaterial({ skillId: "none", level: 0, materials, exclude: new Set() })).toBeUndefined();
  });
});

describe("titles", () => {
  it("cuts material titles at the first colon", () => {
    expect(shortTitle("Inspired: How to Create Tech Products Customers Love")).toBe("Inspired");
    expect(shortTitle("High Output Management")).toBe("High Output Management");
  });

  it("generates KR titles from the target", () => {
    const lookup = {
      material: (id: string) => (id === "m" ? { title: "Lean Analytics: Use Data" } : undefined),
      skillName: (id: string) => (id === "s" ? "Analytics" : undefined),
    };
    expect(keyResultAutoTitle({ type: "material", materialId: "m", skillId: "s" }, lookup)).toBe("Finish Lean Analytics");
    expect(keyResultAutoTitle({ type: "certification", materialId: "m", skillId: "s" }, lookup)).toBe("Earn Lean Analytics");
    expect(keyResultAutoTitle({ type: "count", count: 3, skillId: "s" }, lookup)).toBe("Complete 3 Analytics items");
    expect(keyResultAutoTitle({ type: "material", skillId: "s" }, lookup)).toBe("");
  });
});
