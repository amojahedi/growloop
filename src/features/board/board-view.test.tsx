// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { useAppStore } from "@/lib/store/app-store";
import { TodayContext } from "@/lib/store/hooks";
import { emptyWorkspace } from "@/lib/store/seed";
import { BoardView } from "./board-view";

const [first, second] = CURATED_MATERIALS;

function renderBoard() {
  render(
    <TodayContext value="2026-10-17">
      <BoardView />
    </TodayContext>,
  );
}

const button = (name: string) => screen.getByRole("button", { name });

beforeEach(() => {
  useAppStore.setState({ data: emptyWorkspace() });
  const { addPlanItem } = useAppStore.getState();
  addPlanItem(first.id, "2026-10");
  addPlanItem(second.id, "2026-10");
});
afterEach(cleanup);

describe("BoardView keyboard moves", () => {
  it("keeps focus on the same control after a card changes column", () => {
    renderBoard();
    const toInProgress = button(`Move "${first.title}" to In progress`);
    toInProgress.focus();
    fireEvent.click(toInProgress);

    expect(document.activeElement).toBe(button(`Move "${first.title}" to Done`));
    expect(screen.getByRole("region", { name: /In progress/ })).toContainElement(document.activeElement as HTMLElement);
  });

  it("falls back to the opposite control when that one is now disabled", () => {
    renderBoard();
    fireEvent.click(button(`Move "${first.title}" to In progress`));
    fireEvent.click(button(`Move "${first.title}" to Done`));

    // In Done there is no column to the right, so focus moves to the left arrow.
    expect(button(`Move "${first.title}" right`)).toBeDisabled();
    expect(document.activeElement).toBe(button(`Move "${first.title}" to In progress`));
  });

  it("restores focus after reordering within a column", () => {
    renderBoard();
    fireEvent.click(button(`Move "${second.title}" up`));

    const todo = screen.getByRole("region", { name: /To do/ });
    expect(todo.querySelectorAll("li")[0]).toHaveTextContent(second.title);
    expect(document.activeElement).toBe(button(`Move "${second.title}" down`));
  });

  it("gives every arrow, including disabled ones, a unique name", () => {
    renderBoard();
    const names = screen.getAllByRole("button").map((element) => element.getAttribute("aria-label"));
    expect(names.every(Boolean)).toBe(true);
    expect(new Set(names).size).toBe(names.length);
  });
});
