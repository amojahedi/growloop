import { describe, expect, it, vi } from "vitest";
import { makeMaterial } from "@/lib/testing/fixtures";
import { createPlanItem } from "./create-plan-item";

vi.mock("@/lib/catalog", () => ({
  SUMMARIZE_TASK_TITLE: "Summarize in my words",
  suggestedTasksFor: () => [{ title: "Part 1", done: false, kind: "milestone" }, { title: "Summarize in my words" }, "Apply one idea at work"],
}));

const NOW = "2026-10-17T10:00:00.000Z";

describe("createPlanItem", () => {
  const material = makeMaterial({ id: "inspired", skillIds: ["discovery", "strategy"], estimatedHours: 8 });

  it("creates a to-do item with the catalog's suggested tasks, keeping their kinds", () => {
    const item = createPlanItem(material, "2026-10", { now: NOW });

    expect(item).toMatchObject({
      materialId: "inspired",
      month: "2026-10",
      status: "todo",
      order: 0,
      skillIds: ["discovery", "strategy"],
      estimatedHours: 8,
      timeLogs: [],
      createdAt: NOW,
    });
    expect(item.tasks.map(({ title, kind, done }) => ({ title, kind, done }))).toEqual([
      { title: "Part 1", kind: "milestone", done: false },
      { title: "Summarize in my words", kind: "suggested", done: false },
      { title: "Apply one idea at work", kind: "suggested", done: false },
    ]);
    expect(new Set(item.tasks.map((task) => task.id)).size).toBe(3);
    expect(item).not.toHaveProperty("completedAt");
    expect(item).not.toHaveProperty("keyResultId");
  });

  it("applies options", () => {
    const item = createPlanItem(material, "2026-11", {
      status: "backlog",
      order: 4,
      keyResultId: "kr-1",
      skillIds: ["discovery"],
      suggestTasks: () => [],
      now: NOW,
    });

    expect(item).toMatchObject({ status: "backlog", order: 4, keyResultId: "kr-1", skillIds: ["discovery"], tasks: [] });
  });

  it("stamps completedAt when created directly as done", () => {
    expect(createPlanItem(material, "2026-10", { status: "done", now: NOW }).completedAt).toBe(NOW);
  });

  it("does not share the material's skill array", () => {
    const item = createPlanItem(material, "2026-10", { now: NOW });
    item.skillIds.push("mutated");
    expect(material.skillIds).toEqual(["discovery", "strategy"]);
  });
});
