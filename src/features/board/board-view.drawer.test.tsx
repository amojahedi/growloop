// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster, dismissToast } from "@/components/ui/toast";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { useAppStore } from "@/lib/store/app-store";
import { TodayContext } from "@/lib/store/hooks";
import { emptyWorkspace } from "@/lib/store/seed";
import { useUIStore } from "@/lib/store/ui-store";
import { BoardView } from "./board-view";

vi.mock("next/navigation", () => import("./next-navigation.test-utils"));

// A stand-in drawer that shows the props the board passes (WP4 owns the real one).
vi.mock("../card/card-detail-drawer", () => ({
  CardDetailDrawer: (props: { itemId: string | null; focus?: string; onClose: () => void }) =>
    props.itemId ? (
      <div role="dialog" aria-label="Card" data-item={props.itemId} data-focus={props.focus ?? ""}>
        <button type="button" onClick={props.onClose}>
          Close
        </button>
      </div>
    ) : null,
}));

const [first, second] = CURATED_MATERIALS.filter((material) => material.type !== "certification");
const state = () => useAppStore.getState();
const itemOf = (materialId: string) => state().data.planItems.find((item) => item.materialId === materialId)!;
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));
const toaster = () => within(document.querySelector("[data-toaster]") as HTMLElement);

function renderBoard(url = "/board") {
  window.history.replaceState(null, "", url);
  render(
    <TodayContext value="2026-10-17">
      <BoardView />
      <Toaster />
    </TodayContext>,
  );
}

async function moveToDone(title: string) {
  fireEvent.keyDown(screen.getByRole("button", { name: `Actions for ${title}` }), { key: "Enter" });
  fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Move to Done" }));
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ data: emptyWorkspace() });
  useUIStore.setState({ selectedMonth: null });
  state().addPlanItem(first.id, "2026-10");
  state().addPlanItem(second.id, "2026-10");
});

afterEach(() => {
  act(() => dismissToast());
  cleanup();
});

describe("BoardView card drawer props", () => {
  it("passes focus=summary to the drawer from Write summary", async () => {
    renderBoard();
    await moveToDone(first.title);
    fireEvent.click(toaster().getByRole("button", { name: "Write summary" }));
    await settle();

    const drawer = screen.getByRole("dialog", { name: "Card" });
    expect(drawer).toHaveAttribute("data-item", itemOf(first.id).id);
    expect(drawer).toHaveAttribute("data-focus", "summary");
  });

  it("ignores an unknown focus value and opens without one", async () => {
    renderBoard(`/board?item=${itemOf(first.id).id}&focus=elsewhere`);
    await settle();
    expect(screen.getByRole("dialog", { name: "Card" })).toHaveAttribute("data-focus", "");
  });

  it("replaces the open card in the URL instead of stacking history entries", async () => {
    renderBoard();
    await moveToDone(first.title);
    const start = window.history.length;

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${second.title}`) }));
    expect(window.history.length).toBe(start + 1);
    // Opening another card while one is open (here from the toast) replaces the entry.
    fireEvent.click(toaster().getByRole("button", { name: "Write summary" }));
    await settle();
    expect(window.history.length).toBe(start + 1);
    expect(screen.getByRole("dialog", { name: "Card" })).toHaveAttribute("data-item", itemOf(first.id).id);
  });
});
