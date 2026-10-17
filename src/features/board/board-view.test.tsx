// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { useAppStore } from "@/lib/store/app-store";
import { TodayContext } from "@/lib/store/hooks";
import { emptyWorkspace } from "@/lib/store/seed";
import { BoardView } from "./board-view";

// The overlay is a visual copy of the card; without it dnd-kit measures the card itself,
// which keeps the fake layout below simple.
vi.mock("@dnd-kit/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@dnd-kit/core")>()),
  DragOverlay: () => null,
}));

const [first, second] = CURATED_MATERIALS;

function renderBoard() {
  render(
    <TodayContext value="2026-10-17">
      <BoardView />
    </TodayContext>,
  );
}

const card = (title: string) => screen.getByRole("button", { name: new RegExp(`^${title}`) });
const column = (name: RegExp) => screen.getByRole("region", { name });
const itemOf = (materialId: string) => useAppStore.getState().data.planItems.find((i) => i.materialId === materialId)!;
const announcement = () => document.querySelector("[id^=DndLiveRegion]")?.textContent;

/** jsdom has no layout: place columns side by side and cards stacked in them. */
function fakeLayout() {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const section = this.closest("section");
    const columnIndex = [...document.querySelectorAll("section")].indexOf(section!);
    const li = this.closest("li");
    const box = (left: number, top: number, width: number, height: number) =>
      ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON() {} }) as DOMRect;
    if (!section) return box(0, 0, 0, 0);
    if (!li) return box(columnIndex * 300, 0, 280, 800);
    const row = [...li.parentElement!.children].indexOf(li);
    return box(columnIndex * 300 + 10, 40 + row * 110, 260, 100);
  });
}

// The keyboard sensor starts and moves on timers and animation frames.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));
async function press(code: string, target: Element = document.activeElement ?? document.body) {
  fireEvent.keyDown(target, { code, key: code === "Space" ? " " : code });
  await settle();
}

beforeEach(() => {
  useAppStore.setState({ data: emptyWorkspace() });
  const { addPlanItem } = useAppStore.getState();
  addPlanItem(first.id, "2026-10");
  addPlanItem(second.id, "2026-10");
});
afterEach(cleanup);

describe("BoardView", () => {
  it("makes every card a focusable drag handle with screen-reader instructions", () => {
    renderBoard();
    const handle = card(first.title);
    expect(handle).toHaveAttribute("tabindex", "0");
    expect(handle).toHaveAttribute("aria-roledescription", "draggable card");
    const instructions = document.getElementById(handle.getAttribute("aria-describedby")!);
    expect(instructions).toHaveTextContent(/press space or enter/);
  });

  it("has no arrow buttons, and remove buttons with unique names", () => {
    renderBoard();
    expect(screen.queryByRole("button", { name: /^Move/ })).toBeNull();
    const names = screen.getAllByRole("button", { name: /^Remove/ }).map((button) => button.getAttribute("aria-label"));
    expect(names).toEqual([`Remove "${first.title}"`, `Remove "${second.title}"`]);
  });

  it("removes a card after confirmation", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: `Remove "${first.title}"` }));
    expect(screen.queryByText(first.title)).toBeNull();
  });
});

describe("BoardView keyboard drag", () => {
  beforeEach(fakeLayout);

  it("announces pick-up and cancel, and leaves the card in place", async () => {
    renderBoard();
    card(first.title).focus();
    await press("Space");
    expect(announcement()).toBe(`Picked up ${first.title}.`);

    await press("Escape");
    expect(announcement()).toBe(`Cancelled. ${first.title} is back where it started.`);
    expect(itemOf(first.id)).toMatchObject({ status: "todo", order: 0 });
  });

  it("moves a card to another column, stamping completedAt in Done", async () => {
    renderBoard();
    card(first.title).focus();
    await press("Space");
    await press("ArrowRight");
    expect(announcement()).toBe("Moved to In progress, position 1.");
    await press("ArrowRight");
    await press("Space");

    expect(announcement()).toBe(`Dropped ${first.title} in Done, position 1.`);
    expect(within(column(/Done/)).getByText(first.title)).toBeInTheDocument();
    expect(itemOf(first.id).status).toBe("done");
    expect(itemOf(first.id).completedAt).toBeDefined();
    expect(useAppStore.getState().data.activity.map((event) => event.kind)).toContain("item_completed");
  });

  it("reorders within a column", async () => {
    renderBoard();
    card(first.title).focus();
    await press("Space");
    await press("ArrowDown");
    await press("Space");

    expect(itemOf(second.id).order).toBe(0);
    expect(itemOf(first.id).order).toBe(1);
    expect(within(column(/To do/)).getAllByRole("listitem")[0]).toHaveTextContent(second.title);
  });

  it("does not pick up a card when Enter is pressed on its remove button", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    renderBoard();
    const remove = screen.getByRole("button", { name: `Remove "${first.title}"` });
    remove.focus();
    await press("Enter", remove);
    expect(announcement() ?? "").not.toMatch(/Picked up/);
  });
});
