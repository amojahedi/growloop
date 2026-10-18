import { describe, expect, it } from "vitest";
import { at, makeEvent, makeItem, makeSkill } from "@/lib/testing/fixtures";
import {
  activityCounts,
  completedInMonth,
  completionStats,
  currentStreak,
  hoursLoggedInMonth,
  monthActivity,
  skillInvestment,
  upcomingReminders,
} from "./dashboard";

describe("completed items (core metric)", () => {
  const items = [
    makeItem({ id: "oct-1", status: "done", completedAt: at("2026-10-02") }),
    makeItem({ id: "oct-2", status: "done", completedAt: at("2026-10-30"), month: "2026-09" }),
    makeItem({ id: "sep-1", status: "done", completedAt: at("2026-09-15") }),
    makeItem({ id: "open", status: "in_progress" }),
  ];

  it("counts items by the month they were completed in", () => {
    expect(completedInMonth(items, "2026-10").map((item) => item.id)).toEqual(["oct-1", "oct-2"]);
  });

  it("reports the delta vs the previous month", () => {
    expect(completionStats(items, "2026-10")).toEqual({ count: 2, previousCount: 1, delta: 1 });
    expect(completionStats(items, "2026-11")).toEqual({ count: 0, previousCount: 2, delta: -2 });
  });

  it("ignores stale completedAt on items no longer done", () => {
    const stale = [makeItem({ status: "todo", completedAt: at("2026-10-02") })];
    expect(completedInMonth(stale, "2026-10")).toEqual([]);
  });
});

describe("hoursLoggedInMonth", () => {
  it("sums logged hours in the month from the activity log", () => {
    const activity = [
      makeEvent({ kind: "time_logged", day: "2026-10-01", hours: 1.5 }),
      makeEvent({ kind: "time_logged", day: "2026-09-30", hours: 9 }),
      makeEvent({ kind: "time_logged", day: "2026-10-20", hours: 2 }),
      makeEvent({ kind: "task_completed", day: "2026-10-20" }),
    ];
    expect(hoursLoggedInMonth(activity, "2026-10")).toBe(3.5);
  });

  it("returns null when nothing is logged, since hours are optional", () => {
    expect(hoursLoggedInMonth([], "2026-10")).toBeNull();
    expect(hoursLoggedInMonth([makeEvent({ kind: "time_logged", day: "2026-09-01", hours: 1 })], "2026-10")).toBeNull();
  });
});

describe("skillInvestment", () => {
  const roadmapping = makeSkill({ id: "roadmapping", name: "Roadmapping" });
  const discovery = makeSkill({ id: "discovery", name: "Discovery" });
  const hidden = makeSkill({ id: "hidden", name: "Hidden", hidden: true });

  const items = [
    makeItem({ skillIds: ["roadmapping", "discovery"], status: "done", completedAt: at("2026-10-05") }),
    makeItem({ skillIds: ["roadmapping"], status: "todo" }),
    makeItem({ skillIds: ["roadmapping"], month: "2026-11" }),
    makeItem({ skillIds: ["hidden"] }),
  ];
  const activity = [
    makeEvent({ kind: "time_logged", day: "2026-10-04", hours: 2, skillIds: ["roadmapping", "discovery"] }),
    makeEvent({ kind: "time_logged", day: "2026-11-02", hours: 4, skillIds: ["roadmapping"] }),
  ];

  it("reports planned, completed and hours per visible skill for a month", () => {
    expect(skillInvestment(items, activity, [roadmapping, discovery, hidden], "2026-10")).toEqual([
      { skillId: "roadmapping", name: "Roadmapping", planned: 2, completed: 1, hours: 2 },
      { skillId: "discovery", name: "Discovery", planned: 1, completed: 1, hours: 2 },
    ]);
  });

  it("aggregates over several months (e.g. a quarter)", () => {
    const [first] = skillInvestment(items, activity, [roadmapping], ["2026-10", "2026-11", "2026-12"]);
    expect(first).toEqual({ skillId: "roadmapping", name: "Roadmapping", planned: 3, completed: 1, hours: 6 });
  });

  it("keeps hours logged on items that were later deleted", () => {
    const [first] = skillInvestment([], activity, [roadmapping], "2026-11");
    expect(first.hours).toBe(4);
  });

  it("keeps skills with no activity so radar axes stay stable", () => {
    expect(skillInvestment([], [], [roadmapping], "2026-10")).toEqual([
      { skillId: "roadmapping", name: "Roadmapping", planned: 0, completed: 0, hours: 0 },
    ]);
  });
});

describe("activity & streaks", () => {
  const activity = ["2026-10-02", "2026-10-03", "2026-10-03", "2026-10-04", "2026-10-09", "2026-10-10"].map((day) =>
    makeEvent({ day }),
  );

  it("counts events per day", () => {
    expect(Object.fromEntries(activityCounts(activity))).toEqual({
      "2026-10-02": 1,
      "2026-10-03": 2,
      "2026-10-04": 1,
      "2026-10-09": 1,
      "2026-10-10": 1,
    });
  });

  it("summarizes a month's activity calendar", () => {
    const month = monthActivity(activity, "2026-10");
    expect(month.days).toHaveLength(31);
    expect(month.days[2]).toEqual({ date: "2026-10-03", count: 2 });
    expect(month.activeDays).toBe(5);
    expect(month.longestStreak).toBe(3);
  });

  it("computes the current streak ending today or yesterday", () => {
    expect(currentStreak(activity, "2026-10-10")).toBe(2);
    expect(currentStreak(activity, "2026-10-11")).toBe(2);
    expect(currentStreak(activity, "2026-10-05")).toBe(3);
    expect(currentStreak(activity, "2026-10-12")).toBe(0);
  });
});

describe("upcomingReminders", () => {
  const items = [
    makeItem({ id: "later", reminder: { date: "2026-10-30", note: "Finish" } }),
    makeItem({ id: "soon", reminder: { date: "2026-10-18", note: "Chapter 3" } }),
    makeItem({ id: "overdue", reminder: { date: "2026-10-01", note: "Missed" } }),
    makeItem({ id: "dismissed", reminder: { date: "2026-10-19", note: "x", dismissed: true } }),
    makeItem({ id: "done", status: "done", reminder: { date: "2026-10-19", note: "x" } }),
    makeItem({ id: "none" }),
  ];

  it("returns active reminders on open items, soonest first, flagging overdue ones", () => {
    expect(upcomingReminders(items, "2026-10-17").map((r) => [r.itemId, r.overdue])).toEqual([
      ["overdue", true],
      ["soon", false],
      ["later", false],
    ]);
  });

  it("supports a horizon and a limit", () => {
    expect(upcomingReminders(items, "2026-10-17", { withinDays: 7 }).map((r) => r.itemId)).toEqual(["overdue", "soon"]);
    expect(upcomingReminders(items, "2026-10-17", { limit: 1 }).map((r) => r.itemId)).toEqual(["overdue"]);
  });
});
