import { describe, expect, it } from "vitest";
import { makeItem } from "@/lib/testing/fixtures";
import {
  addTask,
  addTimeLog,
  loggedHours,
  removeTask,
  removeTimeLog,
  renameTask,
  setNotes,
  setReminder,
  setSummary,
  setTaskDone,
  taskProgress,
  withStatus,
} from "./plan-items";

const NOW = "2026-10-17T10:00:00.000Z";

describe("withStatus", () => {
  it("stamps completedAt when entering done and clears it when leaving", () => {
    const done = withStatus(makeItem({ status: "in_progress" }), "done", NOW);
    expect(done).toMatchObject({ status: "done", completedAt: NOW });

    const reopened = withStatus(done, "todo", NOW);
    expect(reopened.status).toBe("todo");
    expect(reopened).not.toHaveProperty("completedAt");
  });

  it("returns the same object when the status does not change", () => {
    const item = makeItem({ status: "done", completedAt: "2026-10-01T00:00:00Z" });
    expect(withStatus(item, "done", NOW)).toBe(item);
  });
});

describe("tasks", () => {
  it("adds, renames and removes custom tasks", () => {
    let item = addTask(makeItem(), "  Write a one-pager  ");
    const [task] = item.tasks;
    expect(task).toMatchObject({ title: "Write a one-pager", done: false, kind: "custom" });

    item = renameTask(item, task.id, "Share the one-pager");
    expect(item.tasks[0].title).toBe("Share the one-pager");

    item = removeTask(item, task.id);
    expect(item.tasks).toEqual([]);
  });

  it("records when a task is completed and clears it when unchecked", () => {
    let item = addTask(makeItem(), "Summarize in my words");
    const taskId = item.tasks[0].id;

    item = setTaskDone(item, taskId, true, NOW);
    expect(item.tasks[0]).toMatchObject({ done: true, completedAt: NOW });
    expect(taskProgress(item)).toEqual({ done: 1, total: 1 });

    item = setTaskDone(item, taskId, false, NOW);
    expect(item.tasks[0].done).toBe(false);
    expect(item.tasks[0]).not.toHaveProperty("completedAt");
  });
});

describe("reflection", () => {
  it("tracks when notes and summary change", () => {
    const item = setSummary(setNotes(makeItem(), "Notes", NOW), "Summary", NOW);
    expect(item).toMatchObject({ notes: "Notes", notesUpdatedAt: NOW, summary: "Summary", summaryUpdatedAt: NOW });
  });

  it("does not bump timestamps when nothing changed", () => {
    const item = makeItem({ summary: "Same", summaryUpdatedAt: "2026-10-01T00:00:00Z" });
    expect(setSummary(item, "Same", NOW)).toBe(item);
  });
});

describe("reminder", () => {
  it("sets and clears a reminder", () => {
    const withReminder = setReminder(makeItem(), { date: "2026-10-24", note: "Finish chapter 3" });
    expect(withReminder.reminder).toEqual({ date: "2026-10-24", note: "Finish chapter 3" });
    expect(setReminder(withReminder, undefined)).not.toHaveProperty("reminder");
  });
});

describe("time logs", () => {
  it("adds and removes logs and totals hours", () => {
    let item = addTimeLog(makeItem(), { date: "2026-10-17", hours: 1.5 });
    item = addTimeLog(item, { date: "2026-10-18", hours: 0.5 });
    expect(loggedHours(item)).toBe(2);

    item = removeTimeLog(item, item.timeLogs[0].id);
    expect(loggedHours(item)).toBe(0.5);
  });

  it("rejects non-positive hours", () => {
    expect(() => addTimeLog(makeItem(), { date: "2026-10-17", hours: 0 })).toThrow();
    expect(() => addTimeLog(makeItem(), { date: "2026-10-17", hours: Number.NaN })).toThrow();
  });
});
