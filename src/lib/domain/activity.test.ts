import { describe, expect, it } from "vitest";
import { at, makeItem } from "@/lib/testing/fixtures";
import { activityFromChange, appendActivity, backfillActivity, syncActivity } from "./activity";
import { currentStreak, hoursLoggedInMonth, monthActivity } from "./dashboard";
import type { ActivityEvent, PlanItem } from "./types";

/** Local midday on a day, as a Date. */
const on = (day: string) => new Date(at(day));

const kinds = (events: Pick<ActivityEvent, "kind">[]) => events.map((event) => event.kind);

const task = (id: string, done: boolean) => ({ id, title: id, done, kind: "custom" as const });

describe("activityFromChange", () => {
  const base = makeItem({ id: "item", materialId: "book", skillIds: ["roadmapping"], tasks: [task("t1", false)] });

  it("records completions, checked tasks, edits and time logs", () => {
    const after: PlanItem = {
      ...base,
      status: "done",
      tasks: [task("t1", true)],
      notes: "n",
      summary: "s",
      timeLogs: [{ id: "log", date: "2026-10-01", hours: 2 }],
    };
    const events = activityFromChange(base, after, on("2026-10-05"));

    expect(kinds(events)).toEqual(["item_completed", "task_completed", "notes_edited", "summary_edited", "time_logged"]);
    expect(events[0]).toMatchObject({ day: "2026-10-05", itemId: "item", materialId: "book", skillIds: ["roadmapping"] });
    expect(events[1].refId).toBe("t1");
    // Time counts on the day studied, not the day it was entered.
    expect(events[4]).toMatchObject({ day: "2026-10-01", hours: 2, refId: "log" });
  });

  it("records nothing for changes that aren't learning activity", () => {
    const moved = { ...base, status: "in_progress" as const, order: 3, notes: "   " };
    expect(activityFromChange(base, moved, on("2026-10-05"))).toEqual([]);
  });

  it("records a new item created as done", () => {
    expect(kinds(activityFromChange(undefined, { ...base, status: "done" }, on("2026-10-05")))).toEqual(["item_completed"]);
  });
});

describe("appendActivity", () => {
  const edit = (day: string) => ({ ...activityFromChange(makeItem({ id: "i" }), makeItem({ id: "i", notes: day }), on(day))[0] });

  it("collapses repeat edits on the same day but counts each day", () => {
    let log = appendActivity([], [edit("2026-10-02"), edit("2026-10-02")]);
    expect(log).toHaveLength(1);

    log = appendActivity(log, [edit("2026-10-03"), edit("2026-10-05")]);
    expect(log.map((event) => event.day)).toEqual(["2026-10-02", "2026-10-03", "2026-10-05"]);
    expect(monthActivity(log, "2026-10").activeDays).toBe(3);
  });
});

describe("syncActivity", () => {
  const start = makeItem({ id: "item", tasks: [task("t1", false)] });

  it("keeps history when a task is unchecked again", () => {
    const checked = { ...start, tasks: [task("t1", true)] };
    let log = syncActivity([], [start], [checked], on("2026-10-02"));
    log = syncActivity(log, [checked], [start], on("2026-10-03"));

    expect(kinds(log)).toEqual(["task_completed"]);
    expect(currentStreak(log, "2026-10-03")).toBe(1);
  });

  it("keeps history (including hours) when an item is deleted or dropped", () => {
    const logged = { ...start, timeLogs: [{ id: "log", date: "2026-09-20", hours: 3 }] };
    let log = syncActivity([], [start], [logged], on("2026-09-20"));
    log = syncActivity(log, [logged], [], on("2026-10-01"));

    expect(hoursLoggedInMonth(log, "2026-09")).toBe(3);
  });

  it("removes the event when a time log entry itself is deleted", () => {
    const logged = { ...start, timeLogs: [{ id: "log", date: "2026-10-02", hours: 1 }] };
    let log = syncActivity([], [start], [logged], on("2026-10-02"));
    log = syncActivity(log, [logged], [start], on("2026-10-02"));

    expect(log).toEqual([]);
  });

  it("ignores unchanged items", () => {
    const other = makeItem({ id: "other", status: "done", completedAt: at("2026-10-01") });
    expect(syncActivity([], [other], [other], on("2026-10-02"))).toEqual([]);
  });
});

describe("backfillActivity", () => {
  it("rebuilds a log from the timestamps on v1 items", () => {
    const items = [
      makeItem({
        status: "done",
        completedAt: at("2026-10-03"),
        summary: "s",
        summaryUpdatedAt: at("2026-10-04"),
        tasks: [{ ...task("t1", true), completedAt: at("2026-10-02") }, task("t2", false)],
        timeLogs: [{ id: "l1", date: "2026-10-03", hours: 1 }],
      }),
      makeItem({ notes: "n", notesUpdatedAt: at("2026-10-10") }),
      // A summary timestamp with an empty summary is not activity.
      makeItem({ summary: "", summaryUpdatedAt: at("2026-10-11") }),
    ];
    const log = backfillActivity(items);

    expect(log.map((event) => [event.day, event.kind])).toEqual([
      ["2026-10-02", "task_completed"],
      ["2026-10-03", "time_logged"],
      ["2026-10-03", "item_completed"],
      ["2026-10-04", "summary_edited"],
      ["2026-10-10", "notes_edited"],
    ]);
    expect(new Set(log.map((event) => event.id)).size).toBe(log.length);
  });
});
