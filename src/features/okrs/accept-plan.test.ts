import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CURATED_MATERIALS } from "@/lib/catalog";
import type { WizardAnswers } from "@/lib/domain/plan-draft";
import { makeItem } from "@/lib/testing/fixtures";
import { useAppStore } from "@/lib/store/app-store";
import { emptyWorkspace } from "@/lib/store/seed";

/** acceptPlan's card links for current-quarter targets (okrs-and-wizard.md §Accept all, step 4). */

const book = CURATED_MATERIALS.find((m) => m.type === "book" && m.skillIds[0] === "roadmapping")!;
const answers: WizardAnswers = { role: "pm", goal: "promotion", skills: [{ skillId: "roadmapping", current: 1, target: 4 }] };
const draft = {
  rationale: "",
  objectives: [
    {
      quarter: "2026-Q4",
      title: "Lead roadmap talks",
      why: "",
      keyResults: [
        { skillId: "roadmapping", type: "material" as const, materialId: book.id, title: "Finish it" },
        { skillId: "roadmapping", type: "count" as const, count: 3, title: "Complete 3 Roadmapping items" },
      ],
    },
  ],
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 18, 12));
});
afterEach(() => vi.useRealTimers());

describe("acceptPlan card links", () => {
  it("links this month's unlinked card for a current-quarter target", () => {
    useAppStore.setState({ data: { ...emptyWorkspace(), planItems: [makeItem({ id: "card", materialId: book.id })] } });
    const accepted = useAppStore.getState().acceptPlan({ draft, source: "quick", answers });
    const { planItems, objectives } = useAppStore.getState().data;
    expect(planItems).toHaveLength(1);
    expect(planItems[0].keyResultId).toBe(objectives[0].keyResults[0].id);
    expect(accepted.linkedItems).toEqual([{ itemId: "card", previousKeyResultId: undefined }]);
  });

  it("leaves a card that counts toward another key result alone and creates a new Backlog card", () => {
    useAppStore.setState({
      data: { ...emptyWorkspace(), planItems: [makeItem({ id: "card", materialId: book.id, keyResultId: "other-kr" })] },
    });
    const accepted = useAppStore.getState().acceptPlan({ draft, source: "quick", answers });
    const { planItems, objectives } = useAppStore.getState().data;
    expect(planItems.find((item) => item.id === "card")?.keyResultId).toBe("other-kr");
    const created = planItems.find((item) => item.id !== "card");
    expect(created).toMatchObject({ status: "backlog", keyResultId: objectives[0].keyResults[0].id });
    expect(accepted.linkedItems).toEqual([]);

    useAppStore.getState().undoAcceptPlan(accepted);
    expect(useAppStore.getState().data.planItems).toEqual([expect.objectContaining({ id: "card", keyResultId: "other-kr" })]);
  });
});
