import { GOAL_LABELS, PLAN_DRAFT_LIMITS, ROLE_LABELS } from "@/lib/domain/plan-draft";
import { KEY_RESULT_TYPES } from "@/lib/domain/types";
import type { DraftPlanInput } from "../schemas";
import { DATA_NOTICE, userData, type PromptSpec } from "./shared";

/**
 * "Draft my plan" in the OKR wizard (AI-2, docs/product/specs/okrs-and-wizard.md
 * §Claude prompt intent). The answer goes through the same repair step as the
 * quick draft, so the prompt aims for a good plan and the repair guarantees a
 * valid one. Bump the version when the instructions change meaningfully.
 */

export const DRAFT_PLAN_PROMPT_VERSION = 1;

export const DRAFT_PLAN_SYSTEM_PROMPT = [
  "You are a pragmatic career coach for product managers inside Growloop, a learning planner.",
  "Draft a learning plan of quarterly objectives from the user's answers.",
  "Write exactly one objective for each quarter in `quarters`, in that order, and no others.",
  "Give each objective 2 or 3 key results. Each key result works on exactly one of the focus skills (`skillId`).",
  "Key result types: `material` (finish one specific item: set `materialId`), `certification` (finish a certification and earn it: set `materialId` to a certification) and `count` (finish `count` items tagged with the skill during the quarter).",
  "Use `materialId` only from the candidate list, and only with the skill it is listed under. Never invent ids.",
  "A certification key result must point at a candidate whose type is `certification`. Never use the same material in two key results.",
  "Put the skills with the biggest gap (goal minus now) in the earliest quarters.",
  "For the same skill, move from foundational to more advanced materials over the year, matching the user's current level (now 1–2: beginner, 3: intermediate, 4–5: advanced).",
  "Size count key results at 2 to 4 items per quarter. In the current quarter, use 2 when fewer than 8 weeks remain.",
  "Propose a certification key result only when the pasted background or the goal text asks for a certification.",
  `Objective titles are outcome-phrased, concrete and in plain English, at most ${PLAN_DRAFT_LIMITS.objectiveTitle} characters. Don't use "master", "synergy" or emoji.`,
  `Key result titles are short and concrete, at most ${PLAN_DRAFT_LIMITS.keyResultTitle} characters, e.g. "Finish Inspired" or "Complete 3 Roadmapping items".`,
  `\`why\` links the objective to the user's goal in one short sentence (at most ${PLAN_DRAFT_LIMITS.why} characters).`,
  `\`rationale\` is one sentence in second person explaining the order of the plan (at most ${PLAN_DRAFT_LIMITS.rationale} characters).`,
  DATA_NOTICE,
  "Respond only with JSON matching the provided schema.",
].join("\n");

/** The output schema, with quarters, skills and materials limited to the ones in the request. */
export function draftPlanJsonSchema(input: Pick<DraftPlanInput, "quarters" | "skills" | "candidates">): Record<string, unknown> {
  const materialIds = [...new Set(input.candidates.map((candidate) => candidate.id))];
  return {
    type: "object",
    properties: {
      rationale: { type: "string", description: "One sentence in second person." },
      objectives: {
        type: "array",
        description: "Exactly one objective per quarter in scope, in order.",
        items: {
          type: "object",
          properties: {
            quarter: { type: "string", enum: [...input.quarters] },
            title: { type: "string" },
            why: { type: "string" },
            keyResults: {
              type: "array",
              description: "Two or three key results.",
              items: {
                type: "object",
                properties: {
                  skillId: { type: "string", enum: input.skills.map((skill) => skill.id) },
                  type: { type: "string", enum: [...KEY_RESULT_TYPES] },
                  // Without candidates, material and certification key results are impossible.
                  ...(materialIds.length > 0
                    ? { materialId: { type: "string", enum: materialIds, description: "Material and certification key results only." } }
                    : {}),
                  count: { type: "integer", description: "Count key results only: 1 to 10." },
                  title: { type: "string" },
                },
                required: ["skillId", "type", "title"],
                additionalProperties: false,
              },
            },
          },
          required: ["quarter", "title", "why", "keyResults"],
          additionalProperties: false,
        },
      },
    },
    required: ["rationale", "objectives"],
    additionalProperties: false,
  };
}

export function buildDraftPlanPrompt(input: DraftPlanInput): PromptSpec {
  const answers = {
    role: ROLE_LABELS[input.role],
    goal: input.goal === "other" && input.goalText ? input.goalText : GOAL_LABELS[input.goal],
    focusSkills: input.skills.map((skill) => ({
      id: skill.id,
      name: skill.name,
      now: skill.current,
      goal: skill.target,
      gap: skill.target - skill.current,
    })),
    levels: "1 New to it, 2 Learning, 3 Capable, 4 Strong, 5 Expert",
    quarters: input.quarters,
    currentQuarter: input.currentQuarter,
    weeksLeftInCurrentQuarter: input.weeksLeftInCurrentQuarter,
    candidates: Object.fromEntries(
      input.skills.map((skill) => [
        skill.id,
        input.candidates
          .filter((candidate) => candidate.skillId === skill.id)
          .map(({ id, title, type, level, hours }) => ({ id, title, type, level, ...(hours ? { hours } : {}) })),
      ]),
    ),
  };

  const background = input.context
    ? ["The user's LinkedIn or CV, for background only:", userData("background", input.context)]
    : [];

  return {
    systemPrompt: DRAFT_PLAN_SYSTEM_PROMPT,
    prompt: ["Draft my plan from these answers.", userData("answers", JSON.stringify(answers, null, 2)), ...background].join(
      "\n\n",
    ),
    jsonSchema: draftPlanJsonSchema(input),
  };
}
