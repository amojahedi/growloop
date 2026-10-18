import { describe, expect, it } from "vitest";
import { SKILL_COLORS } from "@/lib/domain/types";
import type { DeletedSkill } from "@/lib/store/app-store";
import { makeItem, makeKeyResult, makeNote, makeObjective, makeSkill } from "@/lib/testing/fixtures";
import {
  canHideMore,
  canShowMore,
  colorName,
  deleteWouldBreakMinimum,
  firstUnusedColor,
  restorableSkill,
  skillSheetSummary,
  uniqueSkillName,
  validSkillName,
} from "./skill-rules";

const skills = (count: number, hidden = 0) =>
  Array.from({ length: count + hidden }, (_, index) => makeSkill({ name: `Skill ${index}`, hidden: index >= count }));

describe("visible skill limits", () => {
  it("keeps at least 3 visible", () => {
    expect(canHideMore(skills(4))).toBe(true);
    expect(canHideMore(skills(3, 5))).toBe(false);
  });

  it("allows at most 16 visible", () => {
    expect(canShowMore(skills(15, 2))).toBe(true);
    expect(canShowMore(skills(16, 2))).toBe(false);
  });
});

describe("validSkillName", () => {
  const list = [makeSkill({ id: "a", name: "Roadmapping" }), makeSkill({ id: "b", name: "Negotiation", hidden: true })];

  it("trims and accepts a new name", () => {
    expect(validSkillName("  Storytelling ", list)).toBe("Storytelling");
  });

  it("rejects empty, too long and duplicate names, case-insensitively and including hidden skills", () => {
    expect(validSkillName("   ", list)).toBeUndefined();
    expect(validSkillName("x".repeat(41), list)).toBeUndefined();
    expect(validSkillName("roadmapping", list)).toBeUndefined();
    expect(validSkillName("NEGOTIATION ", list)).toBeUndefined();
  });

  it("lets a skill keep (or recase) its own name", () => {
    expect(validSkillName("ROADMAPPING", list, "a")).toBe("ROADMAPPING");
  });
});

describe("deleting and undoing", () => {
  it("blocks deleting a visible skill at 3 visible, but not a hidden one", () => {
    const list = skills(3, 1);
    expect(deleteWouldBreakMinimum(list[0], list)).toBe(true);
    expect(deleteWouldBreakMinimum(list[3], list)).toBe(false);
    expect(deleteWouldBreakMinimum(list[0], skills(4))).toBe(false);
  });

  it("suffixes a taken name, within 40 characters", () => {
    const list = [makeSkill({ name: "Negotiation" }), makeSkill({ name: "Negotiation 2" })];
    expect(uniqueSkillName("Storytelling", list)).toBe("Storytelling");
    expect(uniqueSkillName("negotiation", list)).toBe("negotiation 3");
    const long = "x".repeat(40);
    expect(uniqueSkillName(long, [makeSkill({ name: long })])).toBe(`${"x".repeat(38)} 2`);
  });

  it("restores as it was when the rules still allow it", () => {
    const deleted: DeletedSkill = { skill: makeSkill({ id: "neg", name: "Negotiation", builtIn: false }), index: 3, items: [], materials: [], notes: [] };
    expect(restorableSkill(deleted, skills(5))).toBe(deleted);
  });

  it("restores hidden at 16 visible, and renamed when the name was reused", () => {
    const deleted: DeletedSkill = { skill: makeSkill({ id: "neg", name: "Negotiation", builtIn: false }), index: 3, items: [], materials: [], notes: [] };
    const full = [...skills(15), makeSkill({ name: "Negotiation" })];
    expect(restorableSkill(deleted, full).skill).toMatchObject({ id: "neg", name: "Negotiation 2", hidden: true });
  });
});

describe("colors", () => {
  it("picks the first color not in use", () => {
    expect(firstUnusedColor([makeSkill({ color: "slate" }), makeSkill({ color: "orange" })])).toBe("red");
    expect(firstUnusedColor(SKILL_COLORS.map((color) => makeSkill({ color })))).toBe("slate");
  });

  it("names colors for people", () => {
    expect(colorName("fuchsia")).toBe("Fuchsia");
  });
});

describe("skillSheetSummary", () => {
  const today = "2026-10-18";

  it("lists this year's and next year's objectives with a KR on the skill, upcoming ones by quarter", () => {
    const current = makeObjective({ quarter: "2026-Q4", keyResults: [makeKeyResult({ skillId: "road", type: "count", count: 2 })] });
    const closed = makeObjective({ quarter: "2026-Q3", status: "closed", finalProgress: 80, keyResults: [makeKeyResult({ skillId: "road" })] });
    const next = makeObjective({ quarter: "2027-Q3", keyResults: [makeKeyResult({ skillId: "road" })] });
    const otherSkill = makeObjective({ quarter: "2026-Q4", keyResults: [makeKeyResult({ skillId: "other" })] });
    const lastYear = makeObjective({ quarter: "2025-Q4", keyResults: [makeKeyResult({ skillId: "road" })] });
    const tooFar = makeObjective({ quarter: "2028-Q1", keyResults: [makeKeyResult({ skillId: "road" })] });
    const done = makeItem({ status: "done", skillIds: ["road"], completedAt: "2026-10-05T10:00:00.000Z" });

    const summary = skillSheetSummary(
      { objectives: [next, current, otherSkill, lastYear, tooFar, closed], planItems: [done], notes: [] },
      "road",
      today,
    );

    expect(summary.objectives.map((entry) => entry.objective.id)).toEqual([closed.id, current.id, next.id]);
    expect(summary.objectives.map((entry) => entry.measure)).toEqual([
      { kind: "progress", percent: 80 },
      { kind: "progress", percent: 50 },
      { kind: "quarter", quarter: "2027-Q3" },
    ]);
    expect(summary.objectives.map((entry) => entry.year)).toEqual([2026, 2026, 2027]);
  });

  it("shows this month's cards and the rolling Backlog, moving ones first, and counts this year's finished cards", () => {
    const inProgress = makeItem({ status: "in_progress", skillIds: ["x", "road"] });
    const todo = makeItem({ status: "todo", skillIds: ["road"] });
    const doneNow = makeItem({ status: "done", skillIds: ["road"], completedAt: "2026-10-02T10:00:00.000Z" });
    const oldBacklog = makeItem({ status: "backlog", month: "2026-08", skillIds: ["road"] });
    const lastMonth = makeItem({ status: "done", month: "2026-09", skillIds: ["road"], completedAt: "2026-09-20T10:00:00.000Z" });
    const lastYear = makeItem({ status: "done", month: "2025-11", skillIds: ["road"], completedAt: "2025-11-20T10:00:00.000Z" });
    const untagged = makeItem({ status: "todo", skillIds: ["x"] });
    const nextMonth = makeItem({ status: "todo", month: "2026-11", skillIds: ["road"] });

    const summary = skillSheetSummary(
      { objectives: [], planItems: [doneNow, oldBacklog, todo, lastMonth, lastYear, untagged, inProgress, nextMonth], notes: [] },
      "road",
      today,
    );

    expect(summary.cards.map((item) => item.id)).toEqual([inProgress.id, todo.id, oldBacklog.id, doneNow.id]);
    expect(summary.finishedThisYear).toBe(2);
  });

  it("counts notes with text on the skill", () => {
    const summary = skillSheetSummary(
      {
        objectives: [],
        planItems: [],
        notes: [
          makeNote({ skillIds: ["road"] }),
          makeNote({ skillIds: ["road", "x"], kind: "summary", body: "Mine" }),
          makeNote({ skillIds: ["road"], kind: "item_note", body: "  " }),
          makeNote({ skillIds: ["x"] }),
        ],
      },
      "road",
      today,
    );
    expect(summary.noteCount).toBe(2);
  });

  it("is empty for a skill with no data", () => {
    expect(skillSheetSummary({ objectives: [], planItems: [], notes: [] }, "road", today)).toEqual({
      objectives: [],
      cards: [],
      finishedThisYear: 0,
      noteCount: 0,
    });
  });
});
