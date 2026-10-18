// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { findCardNote } from "@/lib/domain/notes";
import { summaryTask } from "@/lib/domain/plan-items";
import { useAppStore } from "@/lib/store/app-store";
import { emptyWorkspace } from "@/lib/store/seed";

const store = () => useAppStore.getState();
const book = CURATED_MATERIALS.find((material) => material.type === "book")!;

beforeEach(() => useAppStore.setState({ data: emptyWorkspace() }));

describe("setReadOnlyCardNote (Phase 1 · WP4)", () => {
  it("writes a read-only card's summary without ticking its frozen tasks", () => {
    const id = store().addPlanItem(book.id, "2026-09", { status: "in_progress" })!;
    const noteId = store().setReadOnlyCardNote(id, "summary", "Learned later");
    expect(findCardNote(store().data.notes, id, "summary")).toMatchObject({ id: noteId, body: "Learned later", materialId: book.id });
    const item = store().data.planItems.find((candidate) => candidate.id === id)!;
    expect(summaryTask(item)?.done).toBe(false);
    expect(store().data.activity.some((event) => event.kind === "task_completed")).toBe(false);

    expect(store().setReadOnlyCardNote(id, "summary", "Rewritten")).toBe(noteId);
    expect(findCardNote(store().data.notes, id, "summary")?.body).toBe("Rewritten");
  });

  it("creates no record for empty text or an unknown card", () => {
    const id = store().addPlanItem(book.id, "2026-09")!;
    expect(store().setReadOnlyCardNote(id, "item_note", "  ")).toBeUndefined();
    expect(store().setReadOnlyCardNote("gone", "item_note", "Text")).toBeUndefined();
    expect(store().data.notes).toEqual([]);
  });
});
