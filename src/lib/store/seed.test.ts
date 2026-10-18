import { afterAll, describe, expect, it } from "vitest";
import { CURATED_MATERIALS, DEMO_DATA } from "@/lib/catalog";
import { addDays, addMonths, addQuarters, dayKey, monthKey, quarterOf, yearOf } from "@/lib/domain/dates";
import { pendingReview } from "@/lib/domain/month-review";
import { dueNotes } from "@/lib/domain/notes";
import { keyResultProgress, MAX_OBJECTIVES_PER_YEAR } from "@/lib/domain/okrs";
import type { Workspace } from "@/lib/domain/types";
import { makeItem, makeNote, makeObjective } from "@/lib/testing/fixtures";
import { validateWorkspace } from "./schema";
import { emptyWorkspace, rebuildActivity, sampleWorkspace, shiftSeed } from "./seed";

const WRITTEN_FOR = DEMO_DATA.writtenFor;

/** Every timestamp and past day in a workspace that must not lie after `today`. */
function pastMoments(workspace: Workspace): string[] {
  return [
    ...workspace.planItems.flatMap((item) => [
      item.createdAt,
      item.completedAt,
      item.earnedAt,
      item.summaryNudgedAt,
      ...item.tasks.map((task) => task.completedAt),
      ...item.timeLogs.map((log) => log.date),
    ]),
    ...workspace.notes.flatMap((note) => [note.createdAt, note.updatedAt, note.refinedAt, note.lastReviewedAt]),
    ...workspace.objectives.flatMap((objective) => [objective.createdAt, objective.closedAt]),
    ...workspace.rollovers.map((record) => record.completedAt),
    ...workspace.activity.map((entry) => entry.at),
  ].filter((value): value is string => value !== undefined);
}

/** A day key is compared as a local day, a timestamp as a moment. */
const notAfter = (moment: string, today: Date) => (moment.length === 10 ? moment <= dayKey(today) : new Date(moment) <= today);

describe("sampleWorkspace on the day it was written for", () => {
  const today = new Date(`${WRITTEN_FOR}T12:00:00`);
  const sample = sampleWorkspace(today);
  const month = monthKey(today);
  const quarter = quarterOf(month);
  const board = sample.planItems.filter((item) => item.month === month);
  const count = (status: string) => board.filter((item) => item.status === status).length;

  it("validates against the current schema", () => {
    expect(validateWorkspace(sample).ok).toBe(true);
    expect(sample.version).toBe(4);
  });

  it("keeps the authored dates (shifting is the identity on that day)", () => {
    const { writtenFor: _day, activity: _activity, ...authored } = DEMO_DATA;
    const { activity, ...rest } = sample;
    expect(rest).toEqual(JSON.parse(JSON.stringify(authored)));
    expect(activity.length).toBeGreaterThan(0);
  });

  it("has a profile for a PM working toward a promotion, without a name", () => {
    expect(sample.profile).toMatchObject({ role: "pm", goal: "promotion" });
    expect(sample.profile.name).toBeUndefined();
    expect(sample.profile.skillLevels.map(({ skillId, current, target }) => [skillId, current, target])).toEqual([
      ["roadmapping", 2, 4],
      ["stakeholder-management", 2, 4],
      ["product-discovery", 3, 4],
    ]);
  });

  it("fills this month's board: Backlog 2 · To do 2 · In progress 2 · Done 7, one card carried over", () => {
    expect([count("backlog"), count("todo"), count("in_progress"), count("done")]).toEqual([2, 2, 2, 7]);
    expect(board.filter((item) => item.carriedFrom?.length)).toHaveLength(1);
  });

  it("has no certification card on this month's board, and an earned one in history", () => {
    const type = (id: string) => CURATED_MATERIALS.find((material) => material.id === id)?.type;
    expect(board.some((item) => type(item.materialId) === "certification")).toBe(false);
    const earned = sample.planItems.filter((item) => type(item.materialId) === "certification" && item.earnedAt);
    expect(earned).toHaveLength(1);
    expect(earned[0].status).toBe("done");
  });

  it("has three finished, reviewed months before this one and nothing pending", () => {
    const history = [1, 2, 3].map((back) => addMonths(month, -back));
    for (const past of history) {
      const items = sample.planItems.filter((item) => item.month === past);
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((item) => item.status === "done")).toBe(true);
    }
    expect(sample.rollovers.map((record) => record.toMonth)).toEqual([history[1], history[0], month]);
    expect(pendingReview(sample, WRITTEN_FOR)).toBeNull();
  });

  it("has one objective per quarter: last quarter closed at 80%, this one in progress, four ahead", () => {
    const byQuarter = (offset: number) => sample.objectives.filter((objective) => objective.quarter === addQuarters(quarter, offset));
    expect(byQuarter(-1)).toEqual([expect.objectContaining({ status: "closed", finalProgress: 80 })]);
    for (const offset of [0, 1, 2, 3, 4]) {
      const [objective] = byQuarter(offset);
      expect(objective.status).toBe("active");
      expect(objective.keyResults).toHaveLength(2);
    }
    expect(byQuarter(0)[0].title).toBe("Lead roadmap conversations with confidence");
  });

  it("shows the current objective's count KR at 2 of 3 and its book in progress", () => {
    const current = sample.objectives.find((objective) => objective.quarter === quarter)!;
    const [book, countKr] = current.keyResults.map((kr) => keyResultProgress(kr, current, sample.planItems));
    expect(countKr).toMatchObject({ type: "count", done: 2, target: 3 });
    expect(book).toMatchObject({ type: "material", met: false });
    expect(book.type !== "count" && book.item?.status).toBe("in_progress");
  });

  it("covers every key result type across this quarter and next year", () => {
    const types = new Set(sample.objectives.flatMap((objective) => objective.keyResults.map((kr) => kr.type)));
    expect(types).toEqual(new Set(["material", "certification", "count"]));
  });

  it("has 5 summaries (2 refined), 2 card notes and 2 free notes", () => {
    const summaries = sample.notes.filter((note) => note.kind === "summary");
    expect(summaries).toHaveLength(5);
    expect(summaries.filter((note) => note.refinedAt)).toHaveLength(2);
    expect(sample.notes.filter((note) => note.kind === "item_note")).toHaveLength(2);
    expect(sample.notes.filter((note) => note.kind === "free").map((note) => note.title)).toEqual([
      "Questions for my 1:1",
      "Roadmap review prep",
    ]);
  });

  it("has one note due today and one due in 3 days", () => {
    expect(dueNotes(sample.notes, WRITTEN_FOR)).toHaveLength(1);
    expect(sample.notes.filter((note) => note.reviewAt === addDays(WRITTEN_FOR, 3))).toHaveLength(1);
  });

  it("has 3 reminders in the next two weeks", () => {
    const reminders = sample.planItems.map((item) => item.reminder?.date).filter((date) => date !== undefined);
    expect(reminders).toHaveLength(3);
    expect(reminders.every((date) => date >= WRITTEN_FOR && date <= addDays(WRITTEN_FOR, 14))).toBe(true);
  });

  it("saves 6 catalog items and keeps the team's own playbook", () => {
    expect(sample.savedMaterialIds).toHaveLength(6);
    expect(sample.customMaterials.map((material) => material.id)).toEqual(["custom-team-interview-playbook"]);
    expect(sample.dashboardLayout).toBeNull();
  });

  it("only references things that exist", () => {
    const materials = new Map([...CURATED_MATERIALS, ...sample.customMaterials].map((material) => [material.id, material]));
    const skills = new Set(sample.skills.map((skill) => skill.id));
    const keyResults = new Map(sample.objectives.flatMap((objective) => objective.keyResults).map((kr) => [kr.id, kr]));
    const items = new Set(sample.planItems.map((item) => item.id));

    for (const item of sample.planItems) {
      expect(materials.has(item.materialId), item.materialId).toBe(true);
      expect(item.skillIds.every((id) => skills.has(id))).toBe(true);
      if (item.keyResultId) expect(keyResults.has(item.keyResultId), item.keyResultId).toBe(true);
    }
    for (const kr of keyResults.values()) {
      expect(skills.has(kr.skillId)).toBe(true);
      if (kr.type === "count") expect(kr.count).toBeGreaterThan(0);
      else expect(materials.get(kr.materialId!)?.type === "certification").toBe(kr.type === "certification");
    }
    for (const note of sample.notes) {
      if (note.planItemId) expect(items.has(note.planItemId)).toBe(true);
      expect(note.skillIds.every((id) => skills.has(id))).toBe(true);
    }
    expect(sample.savedMaterialIds.every((id) => materials.get(id)?.curated)).toBe(true);
  });

  it("ticks a card's summary task only when it has a summary", () => {
    const summarized = new Set(sample.notes.filter((note) => note.kind === "summary").map((note) => note.planItemId));
    for (const item of sample.planItems) {
      const task = item.tasks.find((candidate) => candidate.kind === "suggested");
      expect(task?.done ?? false, item.id).toBe(summarized.has(item.id));
    }
  });

  it("starts with the built-in skills and stores no static skill data", () => {
    expect(sample.skills.length).toBe(12);
    expect(sample.skills.some((skill) => "objectivePhrases" in skill)).toBe(false);
    expect(emptyWorkspace().skills.some((skill) => "objectivePhrases" in skill)).toBe(false);
  });
});

describe("sampleWorkspace on any day", () => {
  // Month starts and ends, quarter and year boundaries, leap day, and the day before the authored one.
  const days = [
    "2026-10-01", "2026-10-17", "2026-10-31", "2026-11-01", "2026-11-30", "2026-12-31",
    "2027-01-01", "2027-01-15", "2027-02-28", "2027-03-31", "2027-04-01", "2027-06-30",
    "2027-07-01", "2027-09-30", "2028-02-29", "2026-09-01", "2026-03-15",
  ];

  it.each(days)("reads as current on %s", (day) => {
    const today = new Date(`${day}T08:30:00`);
    const sample = sampleWorkspace(today);
    const month = monthKey(today);
    const quarter = quarterOf(month);
    const year = yearOf(day);

    expect(validateWorkspace(sample).ok).toBe(true);
    // This month's board and this quarter's objective.
    expect(sample.planItems.filter((item) => item.month === month)).toHaveLength(13);
    const current = sample.objectives.filter((objective) => objective.quarter === quarter);
    expect(current).toEqual([expect.objectContaining({ status: "active", title: "Lead roadmap conversations with confidence" })]);
    const countKr = current[0].keyResults.find((kr) => kr.type === "count")!;
    expect(keyResultProgress(countKr, current[0], sample.planItems)).toMatchObject({ done: 2, target: 3 });
    // One note due today; the review and the year wrap aren't pending.
    expect(dueNotes(sample.notes, day)).toHaveLength(1);
    expect(sample.notes.some((note) => note.reviewAt === day)).toBe(true);
    expect(pendingReview(sample, day)).toBeNull();
    // Nothing happened in the future.
    expect(pastMoments(sample).every((moment) => notAfter(moment, today))).toBe(true);
    // Reminders in the next two weeks.
    const reminders = sample.planItems.flatMap((item) => (item.reminder ? [item.reminder.date] : []));
    expect(reminders.every((date) => date > day && date <= addDays(day, 14))).toBe(true);
    // Last quarter's year is archived when it ended; no year holds more than the cap.
    const lastQuarterYear = yearOf(addQuarters(quarter, -1));
    expect(sample.archivedYears).toEqual(lastQuarterYear < year ? [lastQuarterYear] : []);
    const perYear = new Map<number, number>();
    sample.objectives.forEach((objective) => perYear.set(yearOf(objective.quarter), (perYear.get(yearOf(objective.quarter)) ?? 0) + 1));
    expect(Math.max(...perYear.values())).toBeLessThanOrEqual(MAX_OBJECTIVES_PER_YEAR);
  });

  it("starts from a fresh copy every time", () => {
    const today = new Date(2027, 1, 10, 9);
    const first = sampleWorkspace(today);
    first.planItems.length = 0;
    expect(sampleWorkspace(today).planItems).toHaveLength(DEMO_DATA.planItems.length);
  });
});

describe("shiftSeed", () => {
  const seed = (): Workspace => ({
    ...emptyWorkspace(),
    planItems: [
      makeItem({
        id: "carried",
        month: "2026-10",
        status: "done",
        carriedFrom: ["2026-09"],
        createdAt: "2026-09-05T09:00:00",
        completedAt: "2026-10-12T15:00:00",
        reminder: { date: "2026-10-24", note: "Finish" },
        timeLogs: [{ id: "log", date: "2026-10-03", hours: 1 }],
        tasks: [{ id: "t", title: "Read", done: true, kind: "custom", completedAt: "2026-10-02T10:00:00" }],
      }),
      makeItem({ id: "august", month: "2026-08", createdAt: "2026-08-31T10:00:00" }),
    ],
    notes: [makeNote({ id: "due", reviewAt: "2026-10-18", createdAt: "2026-10-18T07:00:00", updatedAt: "2026-10-18T07:00:00" })],
    objectives: [
      makeObjective({ id: "last", quarter: "2026-Q3", status: "closed", finalProgress: 80, closedAt: "2026-10-01T07:00:00" }),
      makeObjective({ id: "now", quarter: "2026-Q4", movedFrom: "2026-Q3", createdAt: "2026-10-01T07:00:00" }),
    ],
    rollovers: [{ fromMonth: "2026-09", toMonth: "2026-10", completedAt: "2026-10-01T07:20:00" }],
  });
  const local = (iso: string | undefined) => (iso ? `${dayKey(new Date(iso))} ${new Date(iso).toTimeString().slice(0, 5)}` : iso);

  it("moves months and quarters by whole steps", () => {
    const shifted = shiftSeed(seed(), "2026-10-18", new Date(2027, 0, 20, 12));
    const [carried, august] = shifted.planItems;
    expect(carried).toMatchObject({ month: "2027-01", carriedFrom: ["2026-12"] });
    expect(august.month).toBe("2026-11");
    expect(shifted.objectives.map((objective) => [objective.quarter, objective.movedFrom])).toEqual([
      ["2026-Q4", undefined],
      ["2027-Q1", "2026-Q4"],
    ]);
    expect(shifted.rollovers[0]).toMatchObject({ fromMonth: "2026-12", toMonth: "2027-01" });
  });

  it("keeps review days and reminders at the same distance from today", () => {
    const shifted = shiftSeed(seed(), "2026-10-18", new Date(2027, 0, 20, 12));
    expect(shifted.notes[0].reviewAt).toBe("2027-01-20");
    expect(shifted.planItems[0].reminder?.date).toBe("2027-01-26");
  });

  it("stretches this month's past over the days so far, and earlier months onto their target month", () => {
    const shifted = shiftSeed(seed(), "2026-10-18", new Date(2026, 11, 5, 23));
    const [carried, august] = shifted.planItems;
    // Day 12 15:00 of 18 days → about two thirds into Dec 1–5; day 2 10:00 → early on Dec 1.
    expect(local(carried.completedAt)).toBe("2026-12-04 05:30");
    expect(local(carried.tasks[0].completedAt)).toBe("2026-12-01 09:26");
    expect(carried.timeLogs[0].date).toBe("2026-12-01");
    // Earlier months keep their place in the month: Sep 5 09:00 → Nov 5, Aug 31 10:00 → late Oct 31.
    expect(local(carried.createdAt)?.slice(0, 10)).toBe("2026-11-05");
    expect(local(august.createdAt)?.slice(0, 10)).toBe("2026-10-31");
  });

  it("keeps the order of any two moments, even ones that land on the same day", () => {
    const input = seed();
    // Created late on the 1st, completed early on the 2nd: both land on today's day 1.
    input.planItems[0] = { ...input.planItems[0], createdAt: "2026-10-01T22:00:00", completedAt: "2026-10-02T06:00:00" };
    input.notes[0] = { ...input.notes[0], createdAt: "2026-09-30T23:30:00", updatedAt: "2026-10-01T00:10:00" };
    const shifted = shiftSeed(input, "2026-10-18", new Date(2026, 11, 1, 23));
    const [item] = shifted.planItems;
    expect(new Date(item.createdAt) <= new Date(item.completedAt!)).toBe(true);
    expect(new Date(shifted.notes[0].createdAt) <= new Date(shifted.notes[0].updatedAt)).toBe(true);
  });

  it("never moves a past moment after today", () => {
    const today = new Date(2026, 11, 1, 6);
    const shifted = shiftSeed(seed(), "2026-10-18", today);
    expect(new Date(shifted.planItems[0].completedAt!).getTime()).toBe(today.getTime());
    expect(new Date(shifted.notes[0].createdAt).getTime()).toBe(today.getTime());
  });

  it("archives earlier years that hold only closed objectives", () => {
    expect(shiftSeed(seed(), "2026-10-18", new Date(2026, 11, 5)).archivedYears).toEqual([]);
    expect(shiftSeed(seed(), "2026-10-18", new Date(2027, 0, 5)).archivedYears).toEqual([2026]);
    const active = seed();
    active.objectives[0].status = "active";
    expect(shiftSeed(active, "2026-10-18", new Date(2027, 0, 5)).archivedYears).toEqual([]);
  });

  it("leaves its input untouched", () => {
    const input = seed();
    const snapshot = structuredClone(input);
    shiftSeed(input, "2026-10-18", new Date(2027, 5, 1));
    expect(input).toEqual(snapshot);
  });
});

describe("sampleWorkspace in every time zone", () => {
  const zones = ["UTC", "America/Los_Angeles", "Pacific/Honolulu", "Pacific/Kiritimati", "Asia/Kolkata", "Australia/Lord_Howe"];
  const days = ["2026-10-01", "2026-10-18", "2026-12-31", "2027-01-01", "2027-03-31", "2027-04-01", "2027-06-30", "2027-10-05"];
  const originalZone = process.env.TZ;
  /** getTimezoneOffset() in January, to prove each zone took effect. */
  const JANUARY_OFFSETS: Record<string, number> = { UTC: 0, "America/Los_Angeles": 480, "Pacific/Honolulu": 600, "Pacific/Kiritimati": -840, "Asia/Kolkata": -330, "Australia/Lord_Howe": -660 };
  afterAll(() => {
    process.env.TZ = originalZone;
  });

  const before = (a: string | undefined, b: string | undefined) => a === undefined || b === undefined || new Date(a) <= new Date(b);

  it.each(zones)("keeps the story in order and current in %s", (zone) => {
    process.env.TZ = zone;
    expect(new Date(2027, 0, 15).getTimezoneOffset()).toBe(JANUARY_OFFSETS[zone]);
    for (const day of days) {
      const today = new Date(`${day}T00:05:00`);
      expect(dayKey(today), `${zone} ${day}`).toBe(day);
      const sample = sampleWorkspace(today);
      const label = `${zone} ${day}`;
      expect(validateWorkspace(sample).ok, label).toBe(true);
      for (const item of sample.planItems) {
        expect(before(item.createdAt, item.completedAt), `${label} ${item.id} created ≤ completed`).toBe(true);
        expect(before(item.completedAt, item.earnedAt), `${label} ${item.id} completed ≤ earned`).toBe(true);
        for (const task of item.tasks) expect(before(task.completedAt, item.completedAt ?? task.completedAt), `${label} ${task.id}`).toBe(true);
      }
      for (const note of sample.notes) {
        expect(before(note.createdAt, note.updatedAt), `${label} ${note.id} created ≤ updated`).toBe(true);
        expect(before(note.createdAt, note.refinedAt), `${label} ${note.id} created ≤ refined`).toBe(true);
      }
      for (const objective of sample.objectives) expect(before(objective.createdAt, objective.closedAt), label).toBe(true);
      expect(pastMoments(sample).every((moment) => notAfter(moment, today)), `${label} nothing in the future`).toBe(true);
      expect(dueNotes(sample.notes, day), label).toHaveLength(1);
      expect(pendingReview(sample, day), label).toBeNull();
      const current = sample.objectives.find((objective) => objective.quarter === quarterOf(monthKey(today)))!;
      const countKr = current.keyResults.find((kr) => kr.type === "count")!;
      expect(keyResultProgress(countKr, current, sample.planItems), label).toMatchObject({ done: 2, target: 3 });
    }
  });
});

describe("rebuildActivity", () => {
  it("records completions, ticked tasks, logged time and card writing on the days they happened", () => {
    const item = makeItem({
      id: "card",
      status: "done",
      completedAt: "2026-10-12T15:00:00",
      tasks: [{ id: "t", title: "Read", done: true, kind: "custom", completedAt: "2026-10-10T10:00:00" }],
      timeLogs: [{ id: "log", date: "2026-10-09", hours: 1.5 }],
    });
    const notes = [
      makeNote({ kind: "summary", planItemId: "card", materialId: item.materialId, updatedAt: "2026-10-13T08:00:00" }),
      makeNote({ kind: "free", updatedAt: "2026-10-14T08:00:00" }),
    ];
    const activity = rebuildActivity({ planItems: [item], notes });
    expect(activity.map((entry) => [entry.kind, entry.day])).toEqual([
      ["time_logged", "2026-10-09"],
      ["task_completed", "2026-10-10"],
      ["item_completed", "2026-10-12"],
      ["summary_edited", "2026-10-13"],
    ]);
  });
});
