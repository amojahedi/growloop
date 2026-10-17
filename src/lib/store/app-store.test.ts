// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Workspace } from "@/lib/domain/types";

vi.mock("@/lib/catalog", async () => {
  const { makeDataV1, makeMaterial, makeSkill } = await import("@/lib/testing/fixtures");
  const BUILT_IN_SKILLS = [makeSkill({ id: "roadmapping" }), makeSkill({ id: "discovery", name: "Discovery" })];
  const CURATED_MATERIALS = [makeMaterial({ id: "inspired", skillIds: ["discovery"] })];
  const getMaterialById = (id: string) => CURATED_MATERIALS.find((m) => m.id === id);
  return {
    BUILT_IN_SKILLS,
    CURATED_MATERIALS,
    DEMO_DATA: makeDataV1({ skills: BUILT_IN_SKILLS }),
    getMaterialById,
    suggestedTasksFor: () => ["Summarize in my words"],
    findMaterial: (id: string, custom: { id: string }[]) => getMaterialById(id) ?? custom.find((m) => m.id === id),
  };
});

const { STORAGE_KEY, useAppStore } = await import("./app-store");
const { emptyWorkspace } = await import("./seed");
const { hoursLoggedInMonth, monthActivity } = await import("@/lib/domain/dashboard");
const { BACKUP_STORAGE_KEY } = await import("./backup");

const store = () => useAppStore.getState();
const data = () => useAppStore.getState().data;
const item = (id: string | undefined) => data().planItems.find((candidate) => candidate.id === id);

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ data: emptyWorkspace() });
});

describe("initial state", () => {
  it("starts with the built-in skills and an empty plan", () => {
    expect(data().skills.map((skill) => skill.id)).toEqual(["roadmapping", "discovery"]);
    expect(data().planItems).toEqual([]);
    expect(data().version).toBe(2);
    expect(data().activity).toEqual([]);
  });
});

describe("skills", () => {
  it("adds, renames and hides skills", () => {
    const id = store().addSkill({ name: " Negotiation " });
    store().updateSkill(id, { name: "Negotiation & influence" });
    store().setSkillHidden("roadmapping", true);

    expect(data().skills.find((skill) => skill.id === id)).toMatchObject({
      name: "Negotiation & influence",
      builtIn: false,
    });
    expect(data().skills.find((skill) => skill.id === "roadmapping")?.hidden).toBe(true);
  });

  it("deletes only custom skills and untags them everywhere", () => {
    const id = store().addSkill({ name: "Negotiation" });
    const itemId = store().addPlanItem("inspired", "2026-10", { skillIds: [id, "discovery"] });

    store().deleteSkill("roadmapping");
    store().deleteSkill(id);

    expect(data().skills.map((skill) => skill.id)).toEqual(["roadmapping", "discovery"]);
    expect(item(itemId)?.skillIds).toEqual(["discovery"]);
  });
});

describe("plan items", () => {
  it("adds a material to a month with suggested tasks, appending to the column", () => {
    const first = store().addPlanItem("inspired", "2026-10");
    const second = store().addPlanItem("inspired", "2026-10");

    expect(item(first)).toMatchObject({ month: "2026-10", status: "todo", order: 0, skillIds: ["discovery"] });
    expect(item(first)?.tasks.map((task) => task.title)).toEqual(["Summarize in my words"]);
    expect(item(second)?.order).toBe(1);
  });

  it("ignores unknown materials", () => {
    expect(store().addPlanItem("missing", "2026-10")).toBeUndefined();
    expect(data().planItems).toEqual([]);
  });

  it("supports custom materials", () => {
    const materialId = store().addCustomMaterial({ title: "Team wiki", type: "article", skillIds: [] });
    const itemId = store().addPlanItem(materialId, "2026-10");
    expect(item(itemId)?.materialId).toBe(materialId);

    store().deleteCustomMaterial(materialId);
    expect(data().customMaterials).toEqual([]);
    expect(item(itemId)).toBeUndefined();
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

  it("updates card details", () => {
    const id = store().addPlanItem("inspired", "2026-10")!;
    const taskId = item(id)!.tasks[0].id;

    store().setTaskDone(id, taskId, true);
    store().addTask(id, "Teach it to a colleague");
    store().setSummary(id, "In my words…");
    store().setNotes(id, "Chapter 2 was key");
    store().setReminder(id, { date: "2026-10-24", note: "Finish" });
    store().dismissReminder(id);
    store().logTime(id, { date: "2026-10-17", hours: 1 });

    const updated = item(id)!;
    expect(updated.tasks.map((task) => [task.title, task.done])).toEqual([
      ["Summarize in my words", true],
      ["Teach it to a colleague", false],
    ]);
    expect(updated).toMatchObject({ summary: "In my words…", notes: "Chapter 2 was key" });
    expect(updated.reminder).toEqual({ date: "2026-10-24", note: "Finish", dismissed: true });
    expect(updated.timeLogs).toHaveLength(1);
  });
});

describe("objectives", () => {
  it("creates objectives with key results and unlinks items on delete", () => {
    const objectiveId = store().addObjective({ quarter: "2026-Q4", title: "Lead roadmap discussions", keyResults: [] });
    const krId = store().addKeyResult(objectiveId, { title: "Finish 2 roadmapping materials" });
    const itemId = store().addPlanItem("inspired", "2026-10", { keyResultId: krId });

    store().updateKeyResult(objectiveId, krId, { progressMode: "manual", manualProgress: 50 });
    expect(data().objectives[0].keyResults[0]).toMatchObject({ progressMode: "manual", manualProgress: 50 });

    store().deleteObjective(objectiveId);
    expect(data().objectives).toEqual([]);
    expect(item(itemId)).not.toHaveProperty("keyResultId");
  });

  it("unlinks items when a key result is deleted", () => {
    const objectiveId = store().addObjective({ quarter: "2026-Q4", title: "O", keyResults: [{ title: "KR" }] });
    const krId = data().objectives[0].keyResults[0].id;
    const itemId = store().addPlanItem("inspired", "2026-10", { keyResultId: krId });

    store().deleteKeyResult(objectiveId, krId);
    expect(data().objectives[0].keyResults).toEqual([]);
    expect(item(itemId)).not.toHaveProperty("keyResultId");
  });
});

describe("my library", () => {
  it("saves and unsaves curated materials once each", () => {
    store().saveMaterial("inspired");
    store().saveMaterial("inspired");
    expect(data().savedMaterialIds).toEqual(["inspired"]);

    store().unsaveMaterial("inspired");
    expect(data().savedMaterialIds).toEqual([]);
  });

  it("ignores unknown ids and the user's own materials (always in the library)", () => {
    const own = store().addCustomMaterial({ title: "Team wiki", type: "article", skillIds: [] });
    store().saveMaterial("missing");
    store().saveMaterial(own);
    expect(data().savedMaterialIds).toEqual([]);
  });

  it("works on workspaces loaded without the field", () => {
    const { savedMaterialIds: _saved, ...older } = emptyWorkspace();
    useAppStore.setState({ data: older });
    store().unsaveMaterial("inspired");
    store().saveMaterial("inspired");
    expect(data().savedMaterialIds).toEqual(["inspired"]);
  });
});

describe("activity log", () => {
  afterEach(() => vi.useRealTimers());

  it("counts note edits on different days as separate active days", () => {
    const id = store().addPlanItem("inspired", "2026-10")!;
    for (const [day, text] of [["03", "a"], ["04", "b"], ["04", "c"], ["06", "d"]]) {
      vi.setSystemTime(new Date(2026, 9, Number(day), 12));
      store().setNotes(id, text);
    }
    expect(monthActivity(data().activity, "2026-10").activeDays).toBe(3);
  });

  it("keeps logged hours after the item is dropped at rollover", () => {
    vi.setSystemTime(new Date(2026, 8, 20, 12));
    const id = store().addPlanItem("inspired", "2026-09")!;
    store().logTime(id, { date: "2026-09-20", hours: 2 });

    vi.setSystemTime(new Date(2026, 9, 1, 12));
    store().applyRollover("2026-10", { [id]: "drop" });

    expect(item(id)).toBeUndefined();
    expect(hoursLoggedInMonth(data().activity, "2026-09")).toBe(2);
  });

  it("forgets a time log entry that is deleted", () => {
    const id = store().addPlanItem("inspired", "2026-10")!;
    store().logTime(id, { date: "2026-10-02", hours: 1 });
    store().deleteTimeLog(id, item(id)!.timeLogs[0].id);
    expect(hoursLoggedInMonth(data().activity, "2026-10")).toBeNull();
  });
});

describe("rollover", () => {
  it("applies decisions and records the review", () => {
    const carry = store().addPlanItem("inspired", "2026-09")!;
    const drop = store().addPlanItem("inspired", "2026-09")!;

    const record = store().applyRollover("2026-10", { [carry]: "carry_over", [drop]: "drop" });

    expect(item(carry)).toMatchObject({ month: "2026-10", carriedFrom: ["2026-09"] });
    expect(item(drop)).toBeUndefined();
    expect(data().rollovers).toEqual([record]);
  });
});

describe("data management", () => {
  it("exports and re-imports the workspace", () => {
    store().addPlanItem("inspired", "2026-10");
    const exported = store().exportData();
    const before = data();

    store().resetToEmpty();
    expect(data().planItems).toEqual([]);

    expect(store().importData(exported)).toEqual({ ok: true, data: before });
    expect(data()).toEqual(before);
  });

  it("keeps current data when an import is invalid", () => {
    store().addPlanItem("inspired", "2026-10");
    const before = data();

    expect(store().importData("{}").ok).toBe(false);
    expect(data()).toBe(before);
  });

  it("resets to the demo workspace", () => {
    store().resetToDemo();
    expect(data().skills).toHaveLength(2);
  });
});

describe("persistence", () => {
  const saved = (value: unknown, version = 2) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { data: value }, version }));

  it("saves data under a versioned key", () => {
    store().addSkill({ name: "Negotiation" });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!);

    expect(stored.version).toBe(2);
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
    saved({ version: 2, skills: "corrupt" });
    const raw = localStorage.getItem(STORAGE_KEY);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await useAppStore.persist.rehydrate();

    expect(data()).toEqual(emptyWorkspace());
    expect(localStorage.getItem(BACKUP_STORAGE_KEY)).toBe(raw);
    expect(warn).toHaveBeenCalled();
  });

  it("backs up unparseable JSON instead of getting stuck loading", async () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await useAppStore.persist.rehydrate();

    expect(useAppStore.persist.hasHydrated()).toBe(true);
    expect(data()).toEqual(emptyWorkspace());
    expect(localStorage.getItem(BACKUP_STORAGE_KEY)).toBe("{not json");
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
  });

  it("does not load data written by a newer version", async () => {
    saved({ ...emptyWorkspace(), version: 3, skills: [] }, 3);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await useAppStore.persist.rehydrate();
    expect(data()).toEqual(emptyWorkspace());
    expect(localStorage.getItem(BACKUP_STORAGE_KEY)).toContain('"version":3');
  });

  it("rehydrates v2 saves written before `savedMaterialIds` existed", async () => {
    const { savedMaterialIds: _saved, ...older } = { ...emptyWorkspace(), skills: [] };
    saved(older);

    await useAppStore.persist.rehydrate();
    expect(data()).toEqual({ ...older, savedMaterialIds: [] });
    expect(localStorage.getItem(BACKUP_STORAGE_KEY)).toBeNull();
  });

  it("upgrades v1 saves, backfilling the activity log", async () => {
    const { makeDataV1, makeItem, at } = await import("@/lib/testing/fixtures");
    const v1 = makeDataV1({ planItems: [makeItem({ status: "done", completedAt: at("2026-10-03") })] });
    saved(v1, 1);

    await useAppStore.persist.rehydrate();
    expect(data().version).toBe(2);
    expect(data().activity.map((event) => event.kind)).toEqual(["item_completed"]);
  });
});
