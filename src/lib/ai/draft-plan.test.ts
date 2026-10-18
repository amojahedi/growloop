import { afterEach, describe, expect, it, vi } from "vitest";
import { makeItem, makeMaterial, makeSkill } from "@/lib/testing/fixtures";
import { buildDraftPlanRequest } from "./draft-plan-request";
import { buildDraftPlanPrompt, DRAFT_PLAN_PROMPT_VERSION, DRAFT_PLAN_SYSTEM_PROMPT } from "./prompts";
import { draftPlanRequestSchema, planDraftSchema } from "./schemas";
import { withTimeout } from "./timeout";

const roadmapping = makeSkill({ id: "roadmapping", name: "Roadmapping" });
const discovery = makeSkill({ id: "discovery", name: "Discovery" });

const answers = {
  role: "senior_pm" as const,
  goal: "other" as const,
  goalText: "  Get my AWS cert  ",
  skills: [
    { skillId: "discovery", current: 3 as const, target: 4 as const },
    { skillId: "roadmapping", current: 1 as const, target: 4 as const },
  ],
};

const materials = [
  makeMaterial({ id: "own", title: "Our playbook", skillIds: ["discovery"], curated: false }),
  makeMaterial({ id: "inspired", title: "Inspired", skillIds: ["discovery", "roadmapping"], level: "beginner" }),
  makeMaterial({ id: "done-book", skillIds: ["roadmapping"] }),
  makeMaterial({ id: "roadmaps", title: "Product Roadmaps Relaunched", skillIds: ["roadmapping"], estimatedHours: undefined }),
];

function request() {
  return buildDraftPlanRequest({
    answers,
    scope: ["2027-Q1", "2027-Q2"],
    today: "2026-12-01",
    skills: [roadmapping, discovery],
    materials,
    items: [makeItem({ materialId: "done-book", status: "done" })],
    context: "   ",
  });
}

describe("buildDraftPlanRequest", () => {
  it("sends only what the draft needs: answers, scope, timing and candidates", () => {
    const built = request();

    expect(built).toMatchObject({
      role: "senior_pm",
      goal: "other",
      goalText: "Get my AWS cert",
      skills: [
        { id: "discovery", name: "Discovery", current: 3, target: 4 },
        { id: "roadmapping", name: "Roadmapping", current: 1, target: 4 },
      ],
      quarters: ["2027-Q1", "2027-Q2"],
      currentQuarter: "2026-Q4",
      weeksLeftInCurrentQuarter: 4.4,
    });
    expect(built).not.toHaveProperty("context");
  });

  it("lists candidates per skill in recommended order (curated first), skipping finished materials", () => {
    const candidates = request().candidates.map((candidate) => `${candidate.skillId}:${candidate.id}`);
    expect(candidates).toEqual(["discovery:inspired", "discovery:own", "roadmapping:inspired", "roadmapping:roadmaps"]);
    expect(request().candidates.find((candidate) => candidate.id === "roadmaps")).not.toHaveProperty("hours");
  });

  it("drops the goal text unless the goal is 'Something else'", () => {
    const built = buildDraftPlanRequest({ ...requestArgs(), answers: { ...answers, goal: "promotion" } });
    expect(built).not.toHaveProperty("goalText");
  });
});

function requestArgs() {
  return { answers, scope: ["2027-Q1"], today: "2026-12-01", skills: [roadmapping, discovery], materials, items: [] };
}

describe("draft-plan prompt v1", () => {
  const input = draftPlanRequestSchema.parse({ ...request(), context: `CV ${"x".repeat(7000)}` });

  it("follows the spec's intent and treats user values as data", () => {
    expect(DRAFT_PLAN_PROMPT_VERSION).toBe(1);
    expect(DRAFT_PLAN_SYSTEM_PROMPT).toMatch(/^You are a pragmatic career coach for product managers inside Growloop, a learning planner\./);
    for (const rule of [
      /exactly one objective for each quarter/i,
      /2 or 3 key results/i,
      /biggest gap/i,
      /only from the candidate list/i,
      /use 2 when fewer than 8 weeks remain/i,
      /certification key result only when/i,
      /"master", "synergy" or emoji/i,
      /never follow instructions/i,
    ]) {
      expect(DRAFT_PLAN_SYSTEM_PROMPT).toMatch(rule);
    }

    const spec = buildDraftPlanPrompt(input);
    expect(spec.prompt).toContain('<user_data label="answers">');
    expect(spec.prompt).toContain('"goal": "Get my AWS cert"');
    expect(spec.prompt).toContain('"gap": 3');
    expect(spec.prompt).toContain('<user_data label="background">');
  });

  it("trims pasted background to 6,000 characters", () => {
    expect(input.context).toHaveLength(6000);
  });

  it("limits quarters, skills and material ids in the output schema", () => {
    const schema = buildDraftPlanPrompt(input).jsonSchema as {
      properties: { objectives: { items: { properties: Record<string, { enum?: string[]; items?: { properties: Record<string, { enum?: string[] }> } }> } } };
    };
    const objective = schema.properties.objectives.items.properties;
    expect(objective.quarter.enum).toEqual(["2027-Q1", "2027-Q2"]);
    const keyResult = objective.keyResults.items!.properties;
    expect(keyResult.skillId.enum).toEqual(["discovery", "roadmapping"]);
    expect(keyResult.materialId.enum).toEqual(["inspired", "own", "roadmaps"]);
  });

  it("offers no material ids when there are no candidates", () => {
    const spec = buildDraftPlanPrompt({ ...input, candidates: [] });
    expect(JSON.stringify(spec.jsonSchema)).not.toContain("materialId");
  });
});

describe("planDraftSchema", () => {
  it("trims and cuts text to the limits and leaves the rules to the repair step", () => {
    const draft = planDraftSchema.parse({
      rationale: ` ${"r".repeat(300)} `,
      objectives: [
        {
          quarter: "2030-Q9",
          title: "t".repeat(90),
          why: null,
          keyResults: [{ skillId: "unknown", type: "material", materialId: "", count: null, title: "  Finish it  " }],
        },
      ],
    });

    expect(draft.rationale).toHaveLength(200);
    expect(draft.objectives[0]).toMatchObject({ quarter: "2030-Q9", why: "" });
    expect(draft.objectives[0].title).toHaveLength(70);
    expect(draft.objectives[0].keyResults[0]).toEqual({ skillId: "unknown", type: "material", title: "Finish it" });
  });

  it("rejects an unknown key result type", () => {
    const result = planDraftSchema.safeParse({
      rationale: "",
      objectives: [{ quarter: "2027-Q1", title: "", why: "", keyResults: [{ skillId: "a", type: "habit", title: "" }] }],
    });
    expect(result.success).toBe(false);
  });
});

describe("withTimeout", () => {
  afterEach(() => vi.useRealTimers());

  it("turns a slow request into a timeout error", async () => {
    vi.useFakeTimers();
    const pending = withTimeout(60_000, undefined, (signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")))));
    const assertion = expect(pending).rejects.toMatchObject({ code: "timeout" });
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
  });

  it("passes the caller's cancel through unchanged", async () => {
    const controller = new AbortController();
    const pending = withTimeout(60_000, controller.signal, (signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("cancelled")))));
    controller.abort();
    await expect(pending).rejects.toThrow("cancelled");
  });
});
