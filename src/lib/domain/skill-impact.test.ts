import { describe, expect, it } from "vitest";
import { at, makeItem, makeMaterial, makeSkill } from "@/lib/testing/fixtures";
import { effortFactor, MAX_SKILL_WEIGHT, radarSeries, skillImpact } from "./skill-impact";

const skills = [
  makeSkill({ id: "roadmapping", name: "Roadmapping", color: "violet" }),
  makeSkill({ id: "discovery", name: "Discovery", color: "teal" }),
  makeSkill({ id: "strategy", name: "Strategy", color: "amber" }),
  makeSkill({ id: "hidden", name: "Hidden", hidden: true }),
];

describe("effortFactor", () => {
  it.each([
    [undefined, 1],
    [0, 0.5],
    [0.5, 0.5],
    [1, 1],
    [4.9, 1],
    [5, 1.5],
    [19, 1.5],
    [20, 2],
    [80, 2],
  ])("%s hours → %s", (hours, factor) => {
    expect(effortFactor(hours)).toBe(factor);
  });
});

describe("skillImpact", () => {
  it("weights the primary skill 1 and others 0.5, scaled by effort", () => {
    const material = makeMaterial({ skillIds: ["discovery", "roadmapping"], estimatedHours: 6 });
    expect(skillImpact(material, skills)).toEqual([
      { skillId: "discovery", weight: 1.5 },
      { skillId: "roadmapping", weight: 0.75 },
    ]);
  });

  it("uses an effort factor of 1 when hours are unknown", () => {
    expect(skillImpact({ skillIds: ["strategy"] }, skills)).toEqual([{ skillId: "strategy", weight: 1 }]);
  });

  it("skips unknown skills and duplicate tags without promoting a secondary skill", () => {
    const source = { skillIds: ["deleted", "roadmapping", "roadmapping"], estimatedHours: 2 };
    expect(skillImpact(source, skills)).toEqual([{ skillId: "roadmapping", weight: 0.5 }]);
  });

  it("returns nothing for untagged materials", () => {
    expect(skillImpact({ skillIds: [] }, skills)).toEqual([]);
  });

  it("never exceeds the maximum weight", () => {
    expect(skillImpact({ skillIds: ["strategy"], estimatedHours: 500 }, skills)[0].weight).toBe(MAX_SKILL_WEIGHT);
  });
});

describe("radarSeries", () => {
  const month = "2026-10";

  it("returns one axis per visible skill, with zeros when nothing happened", () => {
    expect(radarSeries({ skills, planItems: [] }, month)).toEqual([
      { skillId: "roadmapping", name: "Roadmapping", color: "violet", completed: 0, projected: 0 },
      { skillId: "discovery", name: "Discovery", color: "teal", completed: 0, projected: 0 },
      { skillId: "strategy", name: "Strategy", color: "amber", completed: 0, projected: 0 },
    ]);
  });

  it("sums completed impact and adds open items this month to the projection", () => {
    const planItems = [
      // Done this month (planned last month): counts as completed.
      makeItem({ month: "2026-09", status: "done", completedAt: at("2026-10-05"), skillIds: ["roadmapping"], estimatedHours: 6 }),
      // Done last month: ignored.
      makeItem({ status: "done", completedAt: at("2026-09-28"), skillIds: ["roadmapping"], estimatedHours: 6 }),
      // Open this month: projected only.
      makeItem({ status: "todo", skillIds: ["roadmapping", "discovery"], estimatedHours: 2 }),
      makeItem({ status: "in_progress", skillIds: ["discovery"], estimatedHours: 30 }),
      // Not committed, or another month: ignored.
      makeItem({ status: "backlog", skillIds: ["strategy"] }),
      makeItem({ month: "2026-11", status: "todo", skillIds: ["strategy"] }),
    ];

    const series = radarSeries({ skills, planItems }, month);
    const byId = Object.fromEntries(series.map((axis) => [axis.skillId, axis]));

    expect(byId.roadmapping).toMatchObject({ completed: 1.5, projected: 2.5 });
    expect(byId.discovery).toMatchObject({ completed: 0, projected: 2.5 });
    expect(byId.strategy).toMatchObject({ completed: 0, projected: 0 });
    expect(byId.hidden).toBeUndefined();
  });

  it("uses each plan item's own skill tags", () => {
    const planItems = [makeItem({ status: "todo", skillIds: ["strategy"], estimatedHours: 1 })];
    expect(radarSeries({ skills, planItems }, month).find((axis) => axis.skillId === "strategy")?.projected).toBe(1);
  });
});
