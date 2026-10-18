import { describe, expect, it } from "vitest";
import { at, makeItem, makeNote } from "@/lib/testing/fixtures";
import { activityFromChange, activityFromNoteChange, appendActivity, syncActivity, syncNoteActivity } from "./activity";
import { currentStreak, hoursLoggedInMonth, monthActivity } from "./dashboard";
import type { ActivityEvent, PlanItem } from "./types";

/** Local midday on a day, as a Date. */
const on = (day: string) => new Date(at(day));

const kinds = (events: Pick<ActivityEvent, "kind">[]) => events.map((event) => event.kind);

const task = (id: string, done: boolean) => ({ id, title: id, done, kind: "custom" as const });

describe("activityFromChange", () => {
  const base = makeItem({ id: "item", materialId: "book", skillIds: ["roadmapping"], tasks: [task("t1", false)] });

  it("records completions, checked tasks and time logs", () => {
    const after: PlanItem = {
      ...base,
      status: "done",
      tasks: [task("t1", true)],
      timeLogs: [{ id: "log", date: "2026-10-01", hours: 2 }],
    };
    const events = activityFromChange(base, after, on("2026-10-05"));

    expect(kinds(events)).toEqual(["item_completed", "task_completed", "time_logged"]);
    expect(events[0]).toMatchObject({ day: "2026-10-05", itemId: "item", materialId: "book", skillIds: ["roadmapping"] });
    expect(events[1].refId).toBe("t1");
    // Time counts on the day studied, not the day it was entered.
    expect(events[2]).toMatchObject({ day: "2026-10-01", hours: 2, refId: "log" });
  });

  it("records nothing for changes that aren't learning activity", () => {
    const moved = { ...base, status: "in_progress" as const, order: 3 };
    expect(activityFromChange(base, moved, on("2026-10-05"))).toEqual([]);
  });

  it("records a new item created as done", () => {
    expect(kinds(activityFromChange(undefined, { ...base, status: "done" }, on("2026-10-05")))).toEqual(["item_completed"]);
  });
});

describe("activityFromNoteChange", () => {
  const summary = makeNote({ id: "s", kind: "summary", planItemId: "item", materialId: "book", skillIds: ["roadmapping"], body: "" });

  it("records writing a card's summary or notes, on the card's material and skills", () => {
    const [event] = activityFromNoteChange(summary, { ...summary, body: "One idea" }, on("2026-10-05"));
    expect(event).toMatchObject({ kind: "summary_edited", day: "2026-10-05", itemId: "item", materialId: "book", skillIds: ["roadmapping"] });

    const note = { ...summary, id: "n", kind: "item_note" as const };
    expect(kinds(activityFromNoteChange(undefined, { ...note, body: "Quote" }, on("2026-10-05")))).toEqual(["notes_edited"]);
  });

  it("ignores free notes, cleared or unchanged text and review dates", () => {
    const written = { ...summary, body: "One idea" };
    expect(activityFromNoteChange(undefined, makeNote({ body: "Free" }), on("2026-10-05"))).toEqual([]);
    expect(activityFromNoteChange(written, { ...written, body: "  " }, on("2026-10-05"))).toEqual([]);
    expect(activityFromNoteChange(written, { ...written, reviewAt: "2026-10-09" }, on("2026-10-05"))).toEqual([]);
  });

  it("keeps history when a note is cleared or deleted", () => {
    const written = { ...summary, body: "One idea" };
    let log = syncNoteActivity([], [summary], [written], on("2026-10-02"));
    log = syncNoteActivity(log, [written], [], on("2026-10-03"));
    expect(kinds(log)).toEqual(["summary_edited"]);
    expect(currentStreak(log, "2026-10-03")).toBe(1);
  });
});

describe("appendActivity", () => {
  const note = makeNote({ id: "n", kind: "item_note", planItemId: "i", materialId: "m", body: "" });
  const edit = (day: string) => ({ ...activityFromNoteChange(note, { ...note, body: day }, on(day))[0] });

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
