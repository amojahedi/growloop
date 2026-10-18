// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PlanDraft, WizardAnswers } from "@/lib/domain/plan-draft";
import type { Workspace } from "@/lib/domain/types";

vi.mock("@/lib/catalog", async () => {
  const { makeDataV1, makeLegacyItem, makeMaterial, makeSkill } = await import("@/lib/testing/fixtures");
  const BUILT_IN_SKILLS = [makeSkill({ id: "roadmapping" }), makeSkill({ id: "discovery", name: "Discovery" })];
  const CURATED_MATERIALS = [
    makeMaterial({ id: "inspired", skillIds: ["discovery"] }),
    makeMaterial({ id: "roadmaps", skillIds: ["roadmapping"] }),
    makeMaterial({ id: "pspo", type: "certification", skillIds: ["discovery"] }),
  ];
  const getMaterialById = (id: string) => CURATED_MATERIALS.find((m) => m.id === id);
  return {
    BUILT_IN_SKILLS,
    CURATED_MATERIALS,
    DEMO_DATA: makeDataV1({
      skills: BUILT_IN_SKILLS,
      planItems: [makeLegacyItem({ id: "sample-card", materialId: "inspired", month: "2026-10", summary: "Sample summary" })],
    }),
    SUMMARIZE_TASK_TITLE: "Summarize in my words",
    getMaterialById,
    storedSkill: (skill: object) => skill,
    suggestedTasksFor: () => [{ title: "Part 1", done: false, kind: "milestone" }, { title: "Summarize in my words" }],
    findMaterial: (id: string, custom: { id: string }[]) => getMaterialById(id) ?? custom.find((m) => m.id === id),
  };
});

const { SAMPLE_STORAGE_KEY, STORAGE_KEY, useAppStore } = await import("./app-store");
const { emptyWorkspace } = await import("./seed");
const { currentStreak, hoursLoggedInMonth, monthActivity } = await import("@/lib/domain/dashboard");
const { readBackup, readBackups, saveBackup } = await import("./backup");
const { readStorageHealth, resetStorageHealth } = await import("./storage-health");
const { useUIStore } = await import("./ui-store");
const { handleStorageEvent, resetNewerVersionFlag, useNewerVersionInAnotherTab } = await import("./hydration");
const { act, renderHook } = await import("@testing-library/react");
const { clearDevicePreferences, DEVICE_STORAGE_KEY, readDevicePreferences, updateDevicePreferences } = await import("./device");
const { rehydrateWorkspace } = await import("./hydration");
const { API_KEY_STORAGE_KEY, readApiKey, saveApiKey } = await import("@/lib/ai/providers/key-storage");

const store = () => useAppStore.getState();
const data = () => useAppStore.getState().data;
const item = (id: string | undefined) => data().planItems.find((candidate) => candidate.id === id);
const note = (id: string | undefined) => data().notes.find((candidate) => candidate.id === id);

beforeEach(() => {
  localStorage.clear();
  // Also forgets preferences kept in memory by a test with blocked storage.
  clearDevicePreferences();
  resetStorageHealth();
  resetNewerVersionFlag();
  useAppStore.persist.setOptions({ name: STORAGE_KEY });
  useAppStore.setState({ data: emptyWorkspace() });
  // Mid-October 2026: the current quarter is 2026-Q4.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 18, 12));
});

afterEach(() => vi.useRealTimers());

/** Makes every localStorage access throw, as in a browser that blocks storage. */
function blockStorage() {
  // jsdom's Storage keeps methods on the prototype; the Node 25 test stand-in on the instance.
  const target: Storage = localStorage instanceof Storage ? Storage.prototype : localStorage;
  const blocked = () => {
    throw new DOMException("Blocked", "SecurityError");
  };
  for (const method of ["getItem", "setItem", "removeItem"] as const) vi.spyOn(target, method).mockImplementation(blocked);
}

describe("initial state", () => {
  it("starts with the built-in skills and an empty v4 workspace", () => {
    expect(data().skills.map((skill) => skill.id)).toEqual(["roadmapping", "discovery"]);
    expect(data()).toMatchObject({
      version: 4,
      profile: { skillLevels: [] },
      planItems: [],
      notes: [],
      archivedYears: [],
      activity: [],
      dashboardLayout: null,
    });
  });
});

describe("profile and skill levels", () => {
  it("sets and clears profile fields", () => {
    store().updateProfile({ name: "Aisan", role: "pm" });
    expect(data().profile).toMatchObject({ name: "Aisan", role: "pm" });

    store().updateProfile({ name: undefined });
    expect(data().profile).not.toHaveProperty("name");
    expect(data().profile.role).toBe("pm");
  });

  it("upserts Now and Goal per skill", () => {
    store().setSkillLevel("roadmapping", { current: 2, target: 4 });
    store().setSkillLevel("discovery", { current: 3, target: 4 });
    store().setSkillLevel("roadmapping", { current: 3, target: 5 });

    expect(data().profile.skillLevels.map(({ skillId, current, target }) => [skillId, current, target])).toEqual([
      ["roadmapping", 3, 5],
      ["discovery", 3, 4],
    ]);
  });
});

describe("skills", () => {
  it("adds, renames and hides skills", () => {
    const id = store().addSkill({ name: " Negotiation " });
    store().updateSkill(id, { name: "Negotiation & influence" });
    store().setSkillHidden("roadmapping", true);

    expect(data().skills.find((skill) => skill.id === id)).toMatchObject({ name: "Negotiation & influence", builtIn: false });
    expect(data().skills.find((skill) => skill.id === "roadmapping")?.hidden).toBe(true);
  });

  it("deletes only custom skills that no key result uses", () => {
    const used = store().addSkill({ name: "Negotiation" });
    store().addObjective({ quarter: "2026-Q4", title: "O", keyResults: [{ title: "KR", skillId: used, type: "count", count: 2 }] });

    expect(store().deleteSkill("roadmapping")).toEqual({ ok: false, reason: "built-in" });
    expect(store().deleteSkill(used)).toEqual({ ok: false, reason: "used-by-key-result" });
    expect(store().deleteSkill("missing")).toEqual({ ok: false, reason: "not-found" });
    expect(data().skills).toHaveLength(3);
  });

  it("untags a deleted skill everywhere and puts it back in place on undo", () => {
    const id = store().addSkill({ name: "Negotiation" });
    const itemId = store().addPlanItem("inspired", "2026-10", { skillIds: [id, "discovery"] })!;
    store().setCardNote(itemId, "summary", "My summary");
    const materialId = store().addCustomMaterial({ title: "Wiki", type: "article", skillIds: ["discovery", id] });
    store().setSkillLevel(id, { current: 1, target: 3 });

    const result = store().deleteSkill(id);
    expect(result).toMatchObject({ ok: true, removedFromItems: 1 });
    expect(item(itemId)?.skillIds).toEqual(["discovery"]);
    expect(data().notes[0].skillIds).toEqual(["discovery"]);
    expect(data().customMaterials[0].skillIds).toEqual(["discovery"]);
    expect(data().profile.skillLevels).toEqual([]);

    if (!result.ok) throw new Error("expected a deletion");
    store().restoreSkill(result.deleted);
    expect(data().skills.map((skill) => skill.id)).toEqual(["roadmapping", "discovery", id]);
    // The primary (first) skill is primary again.
    expect(item(itemId)?.skillIds).toEqual([id, "discovery"]);
    expect(data().notes[0].skillIds).toEqual([id, "discovery"]);
    expect(data().customMaterials.find((m) => m.id === materialId)?.skillIds).toEqual(["discovery", id]);
    expect(data().profile.skillLevels).toHaveLength(1);
  });
});

describe("plan items", () => {
  it("adds a material to a month with suggested tasks, appending to the column", () => {
    const first = store().addPlanItem("inspired", "2026-10");
    const second = store().addPlanItem("inspired", "2026-10");

    expect(item(first)).toMatchObject({ month: "2026-10", status: "todo", order: 0, skillIds: ["discovery"] });
    expect(item(first)?.tasks.map((task) => task.title)).toEqual(["Part 1", "Summarize in my words"]);
    expect(item(second)?.order).toBe(1);
  });

  it("ignores unknown materials", () => {
    expect(store().addPlanItem("missing", "2026-10")).toBeUndefined();
    expect(data().planItems).toEqual([]);
  });

  it("deletes a custom material with its cards, keeping notes about it", () => {
    const materialId = store().addCustomMaterial({ title: "Team wiki", type: "article", skillIds: [] });
    const itemId = store().addPlanItem(materialId, "2026-10")!;
    store().setCardNote(itemId, "item_note", "Worth rereading");

    store().deleteCustomMaterial(materialId);
    expect(data().customMaterials).toEqual([]);
    expect(item(itemId)).toBeUndefined();
    expect(data().notes).toEqual([expect.objectContaining({ materialId, body: "Worth rereading" })]);
  });

  it("moves items and keeps completedAt in sync", () => {
    const id = store().addPlanItem("inspired", "2026-10");
    store().movePlanItem(id!, { status: "done", index: 0 });
    expect(item(id)?.completedAt).toEqual(expect.any(String));

    store().movePlanItem(id!, { status: "in_progress" });
    expect(item(id)).not.toHaveProperty("completedAt");
  });

  it("re-slots an item when its month changes and can unlink a key result", () => {
    store().addPlanItem("inspired", "2026-11");
    const id = store().addPlanItem("inspired", "2026-10", { keyResultId: "kr" });

    store().updatePlanItem(id!, { month: "2026-11", keyResultId: undefined });
    expect(item(id)).toMatchObject({ month: "2026-11", order: 1 });
    expect(item(id)).not.toHaveProperty("keyResultId");
  });

  it("links a KR's target material automatically, unless told otherwise", () => {
    store().addObjective({
      quarter: "2026-Q4",
      title: "Discovery",
      keyResults: [
        { title: "Finish Inspired", skillId: "discovery", type: "material", materialId: "inspired" },
        { title: "Complete 3", skillId: "discovery", type: "count", count: 3 },
      ],
    });
    const [material] = data().objectives[0].keyResults;

    const linked = store().addPlanItem("inspired", "2026-10");
    expect(item(linked)?.keyResultId).toBe(material.id);
    // The KR has its card now; another copy isn't linked again.
    expect(item(store().addPlanItem("inspired", "2026-10"))).not.toHaveProperty("keyResultId");
    expect(item(store().addPlanItem("roadmaps", "2026-10"))).not.toHaveProperty("keyResultId");

    store().removePlanItem(linked!);
    expect(item(store().addPlanItem("inspired", "2026-10", { autoLink: false }))).not.toHaveProperty("keyResultId");
    expect(item(store().addPlanItem("inspired", "2026-10", { keyResultId: "chosen" }))?.keyResultId).toBe("chosen");
  });

  it("sets a card's own skills, and its notes follow", () => {
    const id = store().addPlanItem("inspired", "2026-10")!;
    store().setCardNote(id, "summary", "Summary");
    store().setCardNote(id, "item_note", "Notes");
    const free = store().createNote({ title: "Free", skillIds: ["discovery"] });

    store().setPlanItemSkills(id, ["roadmapping", "discovery"]);
    expect(item(id)?.skillIds).toEqual(["roadmapping", "discovery"]);
    expect(data().notes.filter((n) => n.planItemId === id).map((n) => n.skillIds)).toEqual([
      ["roadmapping", "discovery"],
      ["roadmapping", "discovery"],
    ]);
    expect(note(free)?.skillIds).toEqual(["discovery"]);
  });

  it("removes a card but keeps its notes and history, and undo puts it back without new activity", () => {
    const id = store().addPlanItem("inspired", "2026-10")!;
    store().movePlanItem(id, { status: "done" });
    store().setCardNote(id, "summary", "Kept");
    const activity = data().activity;

    const removed = store().removePlanItem(id)!;
    expect(item(id)).toBeUndefined();
    expect(data().notes).toHaveLength(1);
    expect(data().activity).toEqual(activity);

    vi.setSystemTime(new Date(2026, 9, 20, 12));
    store().restorePlanItem(removed);
    expect(item(id)).toEqual(removed.item);
    expect(data().activity).toEqual(activity);
    expect(store().removePlanItem("missing")).toBeUndefined();
  });

  it("marks certifications earned and the summary nudge as shown (once)", () => {
    const id = store().addPlanItem("pspo", "2026-10")!;
    store().setItemEarned(id, true);
    expect(item(id)?.earnedAt).toEqual(expect.any(String));
    store().setItemEarned(id, false);
    expect(item(id)).not.toHaveProperty("earnedAt");

    store().markSummaryNudged(id);
    const first = item(id)?.summaryNudgedAt;
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    store().markSummaryNudged(id);
    expect(item(id)?.summaryNudgedAt).toBe(first);
  });

  it("updates card details", () => {
    const id = store().addPlanItem("inspired", "2026-10")!;
    const taskId = item(id)!.tasks[0].id;

    store().setTaskDone(id, taskId, true);
    store().addTask(id, "Teach it to a colleague");
    store().setReminder(id, { date: "2026-10-24", note: "Finish" });
    store().dismissReminder(id);
    store().logTime(id, { date: "2026-10-17", hours: 1 });

    const updated = item(id)!;
    expect(updated.tasks.map((task) => [task.title, task.done])).toEqual([
      ["Part 1", true],
      ["Summarize in my words", false],
      ["Teach it to a colleague", false],
    ]);
    expect(updated.reminder).toEqual({ date: "2026-10-24", note: "Finish", dismissed: true });
    expect(updated.timeLogs).toHaveLength(1);
  });
});

describe("notes", () => {
  it("creates a card's summary on its first text and ticks 'Summarize in my words'", () => {
    const id = store().addPlanItem("inspired", "2026-10")!;
    expect(store().setCardNote(id, "summary", "   ")).toBeUndefined();
    expect(data().notes).toEqual([]);

    const noteId = store().setCardNote(id, "summary", "One idea I'll use");
    expect(note(noteId)).toMatchObject({ kind: "summary", planItemId: id, materialId: "inspired", skillIds: ["discovery"] });
    expect(item(id)?.tasks.find((task) => task.title === "Summarize in my words")?.done).toBe(true);
  });

  it("edits the same record each time, and clearing hides it without losing its id", () => {
    const id = store().addPlanItem("inspired", "2026-10")!;
    const noteId = store().setCardNote(id, "item_note", "First");
    store().setNoteReview(noteId!, "2026-10-25");

    expect(store().setCardNote(id, "item_note", "Second")).toBe(noteId);
    expect(store().setCardNote(id, "item_note", "")).toBe(noteId);
    expect(data().notes).toHaveLength(1);
    expect(note(noteId)).toMatchObject({ body: "", reviewAt: "2026-10-25" });

    expect(store().setCardNote(id, "item_note", "Back")).toBe(noteId);
  });

  it("marks a summary refined when a Claude suggestion replaces it, and undo restores the earlier version", () => {
    const id = store().addPlanItem("inspired", "2026-10")!;
    const noteId = store().setCardNote(id, "summary", "Mine")!;
    const before = note(noteId)!;

    store().setCardNote(id, "summary", "Tighter", { refined: true });
    expect(note(noteId)).toMatchObject({ body: "Tighter", refinedAt: expect.any(String) });

    store().restoreNote(before);
    expect(note(noteId)).toEqual(before);
  });

  it("creates, edits, deletes and restores free notes", () => {
    const id = store().createNote({ title: "Questions for my 1:1" });
    store().updateNote(id, { body: "Ask about scope", skillIds: ["roadmapping"] });
    expect(note(id)).toMatchObject({ kind: "free", title: "Questions for my 1:1", body: "Ask about scope", skillIds: ["roadmapping"] });

    const deleted = store().deleteNote(id)!;
    expect(data().notes).toEqual([]);
    store().restoreNote(deleted);
    expect(note(id)).toEqual(deleted);
  });

  it("only lets card notes change their text", () => {
    const itemId = store().addPlanItem("inspired", "2026-10")!;
    const id = store().setCardNote(itemId, "summary", "Text")!;
    store().updateNote(id, { title: "Nope", skillIds: ["roadmapping"], body: "New text" });
    expect(note(id)).toMatchObject({ body: "New text", skillIds: ["discovery"] });
    expect(note(id)).not.toHaveProperty("title");
  });

  it("doesn't bump updatedAt when nothing changed", () => {
    const id = store().createNote({ title: "Same" });
    const before = note(id)!;
    vi.setSystemTime(new Date(2026, 9, 25, 12));
    store().updateNote(id, { title: "Same" });
    expect(note(id)).toBe(before);
  });

  it("schedules a review and marks it reviewed", () => {
    const id = store().createNote({ body: "Revisit" });
    store().setNoteReview(id, "2026-10-25");
    expect(note(id)?.reviewAt).toBe("2026-10-25");

    store().markNoteReviewed(id);
    expect(note(id)).not.toHaveProperty("reviewAt");
    expect(note(id)?.lastReviewedAt).toEqual(expect.any(String));

    store().setNoteReview(id, "2026-11-01");
    store().setNoteReview(id, null);
    expect(note(id)).not.toHaveProperty("reviewAt");
  });

  it("records writing on cards as activity on the day it happens; free notes don't count", () => {
    const id = store().addPlanItem("inspired", "2026-10")!;
    for (const [day, text] of [[3, "a"], [4, "b"], [4, "c"], [6, "d"]] as const) {
      vi.setSystemTime(new Date(2026, 9, day, 12));
      store().setCardNote(id, "item_note", text);
    }
    store().createNote({ body: "Free" });
    expect(monthActivity(data().activity, "2026-10").activeDays).toBe(3);
    expect(currentStreak(data().activity, "2026-10-06")).toBe(1);
  });
});

describe("objectives", () => {
  it("creates objectives with typed key results", () => {
    const id = store().addObjective({
      quarter: "2026-Q4",
      title: " Lead roadmap discussions ",
      why: "For the promotion.",
      keyResults: [{ title: "Finish Roadmaps", skillId: "roadmapping", type: "material", materialId: "roadmaps", count: 5 }],
    });
    expect(data().objectives[0]).toMatchObject({
      id,
      title: "Lead roadmap discussions",
      why: "For the promotion.",
      status: "active",
      source: "manual",
      keyResults: [{ title: "Finish Roadmaps", skillId: "roadmapping", type: "material", materialId: "roadmaps" }],
    });
    // A material KR keeps no stray count.
    expect(data().objectives[0].keyResults[0]).not.toHaveProperty("count");
  });

  it("edits title, why and quarter, and replaces key results, unlinking cards from removed ones", () => {
    const id = store().addObjective({
      quarter: "2026-Q4",
      title: "O",
      why: "Why",
      keyResults: [
        { title: "Keep", skillId: "discovery", type: "count", count: 2 },
        { title: "Drop", skillId: "discovery", type: "material", materialId: "inspired" },
      ],
    });
    const [keep, drop] = data().objectives[0].keyResults;
    const keptCard = store().addPlanItem("roadmaps", "2026-10", { keyResultId: keep.id });
    const droppedCard = store().addPlanItem("inspired", "2026-10", { keyResultId: drop.id });

    store().updateObjective(id, {
      title: "Renamed",
      why: "  ",
      quarter: "2027-Q1",
      keyResults: [{ ...keep, title: "Kept, renamed" }, { title: "New", skillId: "roadmapping", type: "count", count: 3 }],
    });

    const objective = data().objectives[0];
    expect(objective).toMatchObject({ title: "Renamed", quarter: "2027-Q1" });
    expect(objective).not.toHaveProperty("why");
    expect(objective.keyResults.map((kr) => kr.title)).toEqual(["Kept, renamed", "New"]);
    expect(objective.keyResults[0].id).toBe(keep.id);
    expect(item(keptCard)?.keyResultId).toBe(keep.id);
    expect(item(droppedCard)).not.toHaveProperty("keyResultId");
  });

  it("deletes an objective, unlinking (never deleting) its cards, and undo relinks them", () => {
    store().addObjective({ quarter: "2026-Q4", title: "First" });
    const id = store().addObjective({ quarter: "2026-Q4", title: "Second", keyResults: [{ title: "KR", skillId: "discovery", type: "count", count: 2 }] });
    const krId = data().objectives[1].keyResults[0].id;
    const itemId = store().addPlanItem("inspired", "2026-10", { keyResultId: krId });

    const deleted = store().deleteObjective(id)!;
    expect(data().objectives.map((o) => o.title)).toEqual(["First"]);
    expect(item(itemId)).not.toHaveProperty("keyResultId");

    store().restoreObjective(deleted);
    expect(data().objectives.map((o) => o.title)).toEqual(["First", "Second"]);
    expect(item(itemId)?.keyResultId).toBe(krId);
    expect(store().deleteObjective("missing")).toBeUndefined();
  });

  it("adds, edits and deletes single key results", () => {
    const objectiveId = store().addObjective({ quarter: "2026-Q4", title: "O" });
    const krId = store().addKeyResult(objectiveId, { title: "Count", skillId: "discovery", type: "count", count: 2 });
    const itemId = store().addPlanItem("inspired", "2026-10", { keyResultId: krId });

    store().updateKeyResult(objectiveId, krId, { type: "material", materialId: "inspired" });
    expect(data().objectives[0].keyResults[0]).toEqual({ id: krId, title: "Count", skillId: "discovery", type: "material", materialId: "inspired" });

    store().deleteKeyResult(objectiveId, krId);
    expect(data().objectives[0].keyResults).toEqual([]);
    expect(item(itemId)).not.toHaveProperty("keyResultId");
  });

  it("archives an earlier year once, never the current or a later one", () => {
    store().archiveYear(2025);
    store().archiveYear(2025);
    store().archiveYear(2026);
    store().archiveYear(2027);
    expect(data().archivedYears).toEqual([2025]);
  });

  it("closes active objectives left in a year it archives, at their current score", () => {
    vi.setSystemTime(new Date(2027, 0, 5, 12));
    const open = store().addObjective({
      quarter: "2026-Q4",
      title: "Open",
      keyResults: [{ title: "One", skillId: "discovery", type: "count", count: 2 }],
    });
    const later = store().addObjective({ quarter: "2027-Q1", title: "Later" });
    const card = store().addPlanItem("inspired", "2026-12")!;
    useAppStore.setState({
      data: { ...data(), planItems: data().planItems.map((p) => (p.id === card ? { ...p, status: "done", completedAt: "2026-12-10T12:00:00.000Z" } : p)) },
    });

    store().archiveYear(2026);
    expect(data().objectives.find((o) => o.id === open)).toMatchObject({ status: "closed", finalProgress: 50, closedAt: expect.any(String) });
    expect(data().objectives.find((o) => o.id === later)).toMatchObject({ status: "active" });
    expect(data().archivedYears).toEqual([2026]);
  });

  it("starts the counting window afresh when an objective is moved by hand", () => {
    const id = store().addObjective({ quarter: "2027-Q1", title: "Moved at quarter end" });
    useAppStore.setState({ data: { ...data(), objectives: data().objectives.map((o) => ({ ...o, movedFrom: "2026-Q4" })) } });

    store().updateObjective(id, { title: "Renamed" });
    expect(data().objectives[0].movedFrom).toBe("2026-Q4");
    store().updateObjective(id, { quarter: "2027-Q2" });
    expect(data().objectives[0]).not.toHaveProperty("movedFrom");
  });
});

describe("acceptPlan", () => {
  const answers: WizardAnswers = {
    role: "senior_pm",
    goal: "promotion",
    goalText: "ignored unless Something else",
    skills: [
      { skillId: "roadmapping", current: 2, target: 4 },
      { skillId: "discovery", current: 3, target: 4 },
    ],
  };
  const draft: PlanDraft = {
    rationale: "Biggest gaps first: Roadmapping, then Discovery.",
    objectives: [
      {
        quarter: "2026-Q4",
        title: "Lead roadmap conversations with confidence",
        why: "Builds your case for promotion.",
        keyResults: [
          { skillId: "roadmapping", type: "material", materialId: "roadmaps", title: "Finish Roadmaps" },
          { skillId: "discovery", type: "material", materialId: "inspired", title: "Finish Inspired" },
          { skillId: "roadmapping", type: "count", count: 3, title: "Complete 3 Roadmapping items" },
        ],
      },
      {
        quarter: "2027-Q1",
        title: "Make customer discovery a weekly habit",
        why: "Builds your case for promotion.",
        keyResults: [
          { skillId: "discovery", type: "certification", materialId: "pspo", title: "Earn PSPO" },
          { skillId: "discovery", type: "count", count: 2, title: "Complete 2 Discovery items" },
        ],
      },
    ],
  };

  it("saves objectives, profile, library targets and current-quarter cards, and undo removes them all", () => {
    store().setSkillLevel("discovery", { current: 1, target: 2 });
    const ownBefore = store().addPlanItem("inspired", "2026-10", { autoLink: false })!;
    const before = data();

    const accepted = store().acceptPlan({ draft, source: "quick", answers });

    const objectives = data().objectives;
    expect(objectives.map((o) => [o.quarter, o.source, o.status])).toEqual([
      ["2026-Q4", "quick", "active"],
      ["2027-Q1", "quick", "active"],
    ]);
    expect(accepted.objectiveIds).toEqual(objectives.map((o) => o.id));

    expect(data().profile).toMatchObject({ role: "senior_pm", goal: "promotion" });
    expect(data().profile).not.toHaveProperty("goalText");
    expect(data().profile.skillLevels.map(({ skillId, current, target }) => [skillId, current, target])).toEqual([
      ["discovery", 3, 4],
      ["roadmapping", 2, 4],
    ]);

    // Curated targets (all years) are saved to the library.
    expect(data().savedMaterialIds).toEqual(["roadmaps", "inspired", "pspo"]);

    // Current quarter: a new Backlog card for Roadmaps, and the Inspired card already on the board is linked.
    const [roadmapsKr, inspiredKr] = objectives[0].keyResults;
    const created = data().planItems.find((candidate) => candidate.materialId === "roadmaps")!;
    expect(created).toMatchObject({ status: "backlog", month: "2026-10", keyResultId: roadmapsKr.id });
    expect(accepted.createdItemIds).toEqual([created.id]);
    expect(item(ownBefore)?.keyResultId).toBe(inspiredKr.id);
    expect(accepted.linkedItems).toEqual([{ itemId: ownBefore, previousKeyResultId: undefined }]);
    // Later quarters get cards when the user adds them.
    expect(data().planItems.some((candidate) => candidate.materialId === "pspo")).toBe(false);

    store().undoAcceptPlan(accepted);
    expect(data()).toEqual({ ...before, activity: data().activity });
  });

  it("keeps the user's words only for 'Something else'", () => {
    store().acceptPlan({ draft: { ...draft, objectives: [] }, source: "claude", answers: { ...answers, goal: "other", goalText: "  Lead a platform team " } });
    expect(data().profile).toMatchObject({ goal: "other", goalText: "Lead a platform team" });
  });
});

describe("month-end review", () => {
  it("applies the defaults when called without decisions, and keeps hours of dropped cards", () => {
    vi.setSystemTime(new Date(2026, 8, 20, 12));
    const carry = store().addPlanItem("inspired", "2026-09")!;
    store().movePlanItem(carry, { status: "in_progress" });
    const drop = store().addPlanItem("roadmaps", "2026-09")!;
    store().logTime(drop, { date: "2026-09-20", hours: 2 });

    vi.setSystemTime(new Date(2026, 9, 1, 12));
    const record = store().applyMonthReview({ items: { [drop]: "drop" } }, "2026-10-01");

    expect(item(carry)).toMatchObject({ month: "2026-10", status: "in_progress", carriedFrom: ["2026-09"] });
    expect(item(drop)).toBeUndefined();
    expect(hoursLoggedInMonth(data().activity, "2026-09")).toBe(2);
    expect(data().rollovers).toEqual([record]);
    expect(store().applyMonthReview({}, "2026-10-01")).toBeUndefined();
  });

  it("applies against the day the dialog showed, not the clock at the moment of Done", () => {
    vi.setSystemTime(new Date(2026, 9, 20, 12));
    store().addPlanItem("inspired", "2026-10");
    // The dialog was opened on Oct 31 for September; Done is clicked after midnight.
    vi.setSystemTime(new Date(2026, 10, 1, 0, 5));
    expect(store().applyMonthReview({}, "2026-10-31")).toBeUndefined();
    expect(data().planItems[0].month).toBe("2026-10");
  });
});

describe("data management", () => {
  it("exports and re-imports the workspace", () => {
    store().addPlanItem("inspired", "2026-10");
    const exported = store().exportData();
    const before = data();

    useAppStore.setState({ data: emptyWorkspace() });
    expect(store().importData(exported)).toEqual({ ok: true, data: before });
    expect(data()).toEqual(before);
  });

  it("never includes the visitor's Claude API key or device preferences in exports, and imports never touch them", () => {
    const key = "sk-ant-api03-secret-test-key";
    saveApiKey(key);
    updateDevicePreferences({ welcomeDoneAt: "2026-10-18T10:00:00Z" });
    store().addPlanItem("inspired", "2026-10");

    const exported = store().exportData();
    expect(exported).not.toContain(key);
    expect(exported).not.toContain(API_KEY_STORAGE_KEY);
    expect(exported).not.toContain("welcomeDoneAt");
    expect(localStorage.getItem(STORAGE_KEY) ?? "").not.toContain(key);

    const parsed = JSON.parse(exported);
    const tampered = JSON.stringify({ ...parsed, apiKey: "sk-ant-api03-other", data: { ...parsed.data, apiKey: "sk-ant-api03-other" } });
    store().importData(tampered);
    expect(JSON.stringify(data())).not.toContain("sk-ant-api03-other");
    expect(readApiKey()).toBe(key);
  });

  it("keeps current data when an import is invalid", () => {
    store().addPlanItem("inspired", "2026-10");
    const before = data();

    expect(store().importData("{}").ok).toBe(false);
    expect(data()).toBe(before);
  });

  it("erases everything: workspace, device preferences, sample, backup and the Claude key", () => {
    saveApiKey("sk-ant-api03-erase-me");
    store().addPlanItem("inspired", "2026-10");
    updateDevicePreferences({ welcomeDoneAt: "2026-10-18T10:00:00Z", tourSeenAt: "2026-10-18T10:00:00Z" });
    saveBackup("{old}");
    useUIStore.getState().updateWizard({ step: "skills", role: "pm" });
    localStorage.setItem("growloop:dev-now", "2027-01-01");

    store().eraseEverything();

    expect(data()).toEqual(emptyWorkspace());
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).state.data.planItems).toEqual([]);
    expect(readApiKey()).toBeNull();
    expect(localStorage.getItem(DEVICE_STORAGE_KEY)).toBeNull();
    expect(readBackup()).toBeNull();
    expect(localStorage.getItem(SAMPLE_STORAGE_KEY)).toBeNull();
    expect(useUIStore.getState().wizard).toEqual({ step: "answers", skills: [] });
    expect(sessionStorage.getItem("growloop:wizard")).toBeNull();
    expect(localStorage.getItem("growloop:dev-now")).toBeNull();
  });
});

describe("sample mode (ADR 009)", () => {
  it("never writes the own workspace while sample mode is on, and restores it on exit", () => {
    store().addPlanItem("roadmaps", "2026-10");
    const own = localStorage.getItem(STORAGE_KEY);

    expect(store().enterSampleMode()).toBe(true);
    expect(readDevicePreferences().sampleMode).toBe(true);
    expect(data().planItems.map((candidate) => candidate.id)).toEqual(["sample-card"]);
    expect(data().notes).toEqual([expect.objectContaining({ body: "Sample summary" })]);

    store().addPlanItem("inspired", "2026-10");
    store().createNote({ body: "Visitor's note" });
    expect(localStorage.getItem(STORAGE_KEY)).toBe(own);
    expect(localStorage.getItem(SAMPLE_STORAGE_KEY)).toContain("Visitor's note");

    expect(store().exitSampleMode()).toEqual({ ownWorkspaceEmpty: false });
    expect(localStorage.getItem(SAMPLE_STORAGE_KEY)).toBeNull();
    expect(readDevicePreferences()).not.toHaveProperty("sampleMode");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(own);
    expect(data().planItems.map((candidate) => candidate.materialId)).toEqual(["roadmaps"]);
  });

  it("starts from a fresh sample every time, and exiting to an empty workspace says so", () => {
    store().enterSampleMode();
    store().removePlanItem("sample-card");
    store().exitSampleMode();
    store().enterSampleMode();
    expect(item("sample-card")).toBeDefined();

    expect(store().exitSampleMode()).toEqual({ ownWorkspaceEmpty: true });
    expect(data()).toEqual(emptyWorkspace());
  });

  it("keeps the own workspace when storage is blocked (the sample session lives in memory)", () => {
    store().addPlanItem("roadmaps", "2026-10");
    const own = data();
    blockStorage();

    store().enterSampleMode();
    expect(item("sample-card")).toBeDefined();
    expect(store().exitSampleMode()).toEqual({ ownWorkspaceEmpty: false });
    expect(data()).toEqual(own);
  });

  it("keeps the sample-mode flag and the storage key in step when storage is full", () => {
    const target: Storage = localStorage instanceof Storage ? Storage.prototype : localStorage;
    updateDevicePreferences({ welcomeDoneAt: "2026-10-18T10:00:00Z" });
    vi.spyOn(target, "setItem").mockImplementation(() => {
      throw new DOMException("Quota", "QuotaExceededError");
    });

    store().enterSampleMode();
    expect(readStorageHealth()).toBe("full");
    // The write failed, but this tab's flag and key agree.
    expect(readDevicePreferences().sampleMode).toBe(true);
    expect(useAppStore.persist.getOptions().name).toBe(SAMPLE_STORAGE_KEY);
  });

  it("loads the workspace for the current mode on rehydration (e.g. another tab switched it)", () => {
    store().addPlanItem("roadmaps", "2026-10");
    store().enterSampleMode();
    store().addPlanItem("inspired", "2026-10");

    // Another tab exits sample mode…
    updateDevicePreferences({ sampleMode: undefined });
    rehydrateWorkspace();
    expect(data().planItems.map((candidate) => candidate.materialId)).toEqual(["roadmaps"]);

    // …and enters it again with a sample that this tab hasn't seen written yet.
    localStorage.removeItem(SAMPLE_STORAGE_KEY);
    updateDevicePreferences({ sampleMode: true });
    rehydrateWorkspace();
    expect(item("sample-card")).toBeDefined();
    expect(useAppStore.persist.getOptions().name).toBe(SAMPLE_STORAGE_KEY);
  });
});

describe("persistence", () => {
  const saved = (value: unknown, version = 4) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { data: value }, version }));
  const event = (version: number, value: unknown = emptyWorkspace()) => ({
    key: STORAGE_KEY,
    newValue: JSON.stringify({ state: { data: value }, version }),
  });

  it("saves data under a versioned key", () => {
    store().addSkill({ name: "Negotiation" });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);

    expect(stored.version).toBe(4);
    expect(stored.state.data.skills).toHaveLength(3);
    expect(stored.state).not.toHaveProperty("addSkill");
  });

  it("rehydrates valid saved data", async () => {
    const savedData: Workspace = { ...emptyWorkspace(), skills: [] };
    saved(savedData);

    await useAppStore.persist.rehydrate();
    expect(data()).toEqual(savedData);
  });

  it("backs up and ignores invalid saved data", async () => {
    saved({ version: 4, skills: "corrupt" });
    const raw = localStorage.getItem(STORAGE_KEY);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await useAppStore.persist.rehydrate();

    expect(data()).toEqual(emptyWorkspace());
    expect(readBackup()).toBe(raw);
    expect(warn).toHaveBeenCalled();
    // Loading never writes: the unreadable value stays where it was.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("never replaces an earlier backup: the last three distinct copies are kept, newest first", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    for (const broken of ["{one", "{two", "{two", "{three", "{four"]) {
      localStorage.setItem(STORAGE_KEY, broken);
      await useAppStore.persist.rehydrate();
    }
    expect(readBackups().map((backup) => backup.raw)).toEqual(["{four", "{three", "{two"]);
    expect(readBackups()[0].savedAt).toEqual(expect.any(String));
  });

  it("backs up unparseable JSON instead of getting stuck loading", async () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await useAppStore.persist.rehydrate();

    expect(useAppStore.persist.hasHydrated()).toBe(true);
    expect(data()).toEqual(emptyWorkspace());
    expect(readBackup()).toBe("{not json");
  });

  it("keeps working in memory when storage is blocked", async () => {
    // jsdom's Storage keeps methods on the prototype; the Node 25 test stand-in on the instance.
    const target: Storage = localStorage instanceof Storage ? Storage.prototype : localStorage;
    const blocked = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
    const getItem = vi.spyOn(target, "getItem").mockImplementation(blocked);
    vi.spyOn(target, "setItem").mockImplementation(blocked);

    await useAppStore.persist.rehydrate();
    expect(useAppStore.persist.hasHydrated()).toBe(true);
    expect(getItem).toHaveBeenCalled();

    store().addSkill({ name: "Negotiation" });
    expect(data().skills).toHaveLength(3);
    expect(readStorageHealth()).toBe("blocked");

    // Sample mode still works for the session.
    expect(store().enterSampleMode()).toBe(true);
    expect(item("sample-card")).toBeDefined();
  });

  it("does not load data written by a newer version", async () => {
    saved({ ...emptyWorkspace(), version: 5, skills: [] }, 5);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const raw = localStorage.getItem(STORAGE_KEY);
    await useAppStore.persist.rehydrate();
    expect(data()).toEqual(emptyWorkspace());
    expect(readBackup()).toContain('"version":5');
    // The newer data isn't overwritten by loading.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("follows edits from other tabs, but ignores other builds and keeps its data when a change can't be read", () => {
    store().addPlanItem("inspired", "2026-10");
    const mine = data();
    const { result } = renderHook(() => useNewerVersionInAnotherTab());
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // A newer build wrote: ignored, and the shell can offer a reload.
    saved({ ...emptyWorkspace(), version: 5 }, 5);
    act(() => handleStorageEvent(event(5, { ...emptyWorkspace(), version: 5 })));
    expect(data()).toBe(mine);
    expect(result.current).toBe(true);

    // An older build wrote: ignored too (this tab doesn't migrate under the other one's feet).
    handleStorageEvent(event(3));
    expect(data()).toBe(mine);

    // Same version but unreadable: keep what this tab shows, write nothing, no backup.
    saved({ version: 4, skills: "corrupt" });
    const raw = localStorage.getItem(STORAGE_KEY);
    handleStorageEvent(event(4, { version: 4, skills: "corrupt" }));
    expect(data()).toBe(mine);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    expect(readBackup()).toBeNull();

    // A readable change from the same build is loaded.
    const theirs = { ...emptyWorkspace(), skills: [] };
    saved(theirs);
    handleStorageEvent(event(4, theirs));
    expect(data()).toEqual(theirs);
  });

  it("upgrades v3 saves, and saves them as v4 with the next change", async () => {
    const { makeDataV3, makeLegacyItem } = await import("@/lib/testing/fixtures");
    saved(makeDataV3({ skills: emptyWorkspace().skills, planItems: [makeLegacyItem({ id: "card", notes: "Kept" })] }), 3);

    await useAppStore.persist.rehydrate();
    expect(data().version).toBe(4);
    expect(data().notes).toEqual([expect.objectContaining({ planItemId: "card", body: "Kept" })]);
    // Saved as v4 with the next change; loading alone leaves the v3 save untouched.
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(3);
    store().addSkill({ name: "Negotiation" });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).version).toBe(4);
    expect(readBackup()).toBeNull();
  });

  it("upgrades v1 and v2 saves", async () => {
    const { makeDataV1, makeDataV2, makeEvent, makeLegacyItem, at } = await import("@/lib/testing/fixtures");
    saved(makeDataV1({ planItems: [makeLegacyItem({ status: "done", completedAt: at("2026-10-03") })] }), 1);
    await useAppStore.persist.rehydrate();
    expect(data().version).toBe(4);
    expect(data().activity.map((event) => event.kind)).toEqual(["item_completed"]);

    saved(makeDataV2({ activity: [makeEvent()] }), 2);
    await useAppStore.persist.rehydrate();
    expect(data()).toMatchObject({ version: 4, dashboardLayout: null, notes: [], archivedYears: [] });
  });
});

describe("dashboard layout", () => {
  it("saves a layout and goes back to the default", () => {
    const layout = [{ widgetId: "skill-radar", size: "large" as const }];
    store().setDashboardLayout(layout);
    expect(data().dashboardLayout).toEqual(layout);
    expect(data().dashboardLayout).not.toBe(layout);

    store().setDashboardLayout(null);
    expect(data().dashboardLayout).toBeNull();
  });

  it("persists the layout", () => {
    store().setDashboardLayout([{ widgetId: "reminders", size: "small" }]);
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);
    expect(stored.state.data.dashboardLayout).toEqual([{ widgetId: "reminders", size: "small" }]);
  });
});
