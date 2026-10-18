// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster, dismissToast } from "@/components/ui/toast";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { useAppStore } from "@/lib/store/app-store";
import { TodayContext } from "@/lib/store/hooks";
import { emptyWorkspace } from "@/lib/store/seed";
import { useUIStore } from "@/lib/store/ui-store";
import { ResourceActions } from "../library/resource-actions";
import { BoardMonthSwitcher } from "./board-month-switcher";
import { BoardView, SUMMARY_NUDGE } from "./board-view";

vi.mock("next/navigation", () => import("./next-navigation.test-utils"));

// The overlay is a visual copy of the card; without it dnd-kit measures the card itself,
// which keeps the fake layout below simple.
vi.mock("@dnd-kit/core", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@dnd-kit/core")>()),
  DragOverlay: () => null,
}));

const [first, second, third] = CURATED_MATERIALS.filter((material) => material.type !== "certification");
const certification = CURATED_MATERIALS.find((material) => material.type === "certification")!;

function renderBoard(url = "/board") {
  window.history.replaceState(null, "", url);
  render(
    <TodayContext value="2026-10-17">
      <BoardMonthSwitcher />
      <BoardView />
      <Toaster />
    </TodayContext>,
  );
}

const card = (title: string) => screen.getByRole("button", { name: new RegExp(`^${escape(title)}`) });
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const column = (name: RegExp) => screen.getByRole("region", { name });
const state = () => useAppStore.getState();
const itemOf = (materialId: string) => state().data.planItems.find((i) => i.materialId === materialId)!;
const announcement = () => document.querySelector("[id^=DndLiveRegion]")?.textContent;
const menuAnnouncement = () => document.querySelector("p[role=status]")?.textContent?.trim();
const toastText = () => document.querySelector("[data-toaster]")?.textContent ?? "";

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

// The keyboard sensor starts and moves on timers and animation frames; focus moves after a tick.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 50)));
async function press(code: string, target: Element = document.activeElement ?? document.body) {
  fireEvent.keyDown(target, { code, key: code === "Space" ? " " : code });
  await settle();
}

function openMenu(title: string) {
  fireEvent.keyDown(screen.getByRole("button", { name: `Actions for ${title}` }), { key: "Enter" });
  return screen.getByRole("menu");
}

async function choose(title: string, item: string | RegExp) {
  const menu = openMenu(title);
  fireEvent.click(within(menu).getByRole("menuitem", { name: item }));
  await settle();
}

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ data: emptyWorkspace() });
  useUIStore.setState({ selectedMonth: null });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 17, 12));
  const { addPlanItem } = state();
  addPlanItem(first.id, "2026-10");
  addPlanItem(second.id, "2026-10");
});

afterEach(() => {
  act(() => dismissToast());
  cleanup();
  vi.useRealTimers();
});

describe("BoardView cards", () => {
  it("makes every card a focusable drag handle with screen-reader instructions", () => {
    renderBoard();
    const handle = card(first.title);
    expect(handle).toHaveAttribute("tabindex", "0");
    expect(handle).toHaveAttribute("aria-roledescription", "draggable card");
    const instructions = document.getElementById(handle.getAttribute("aria-describedby")!);
    expect(instructions).toHaveTextContent(/press space to pick it up/);
    expect(instructions).toHaveTextContent(/Press enter to open the card/);
  });

  it("has a ⋯ menu per card instead of arrow and trash buttons", () => {
    renderBoard();
    expect(screen.queryByRole("button", { name: /^Move|^Remove/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: /^Actions for/ }).map((button) => button.getAttribute("aria-label"))).toEqual([
      `Actions for ${first.title}`,
      `Actions for ${second.title}`,
    ]);
  });

  it("shows the progress line without Backlog, and hides it when nothing is planned", () => {
    const { movePlanItem, addPlanItem } = state();
    movePlanItem(itemOf(first.id).id, { status: "done" });
    addPlanItem(third.id, "2026-10", { status: "backlog" });
    renderBoard();
    expect(screen.getByText("1 of 2 done")).toBeInTheDocument();
    cleanup();

    useAppStore.setState({ data: emptyWorkspace() });
    renderBoard();
    expect(screen.queryByText(/ of .* done/)).toBeNull();
  });

  it("shows the KR tag on linked cards", () => {
    const objectiveId = state().addObjective({
      quarter: "2026-Q4",
      title: "Get better at discovery",
      keyResults: [{ title: "Finish it", skillId: first.skillIds[0], type: "material", materialId: first.id }],
    });
    const krId = state().data.objectives.find((o) => o.id === objectiveId)!.keyResults[0].id;
    state().updatePlanItem(itemOf(first.id).id, { keyResultId: krId });
    renderBoard();
    expect(within(card(first.title)).getByText("Counts toward a key result")).toBeInTheDocument();
    expect(within(card(second.title)).queryByText("Counts toward a key result")).toBeNull();
  });
});

describe("BoardView ⋯ menu", () => {
  it("offers Open, the other columns, the possible moves and Remove", () => {
    renderBoard();
    const menu = openMenu(first.title);
    const names = within(menu)
      .getAllByRole("menuitem")
      .map((item) => item.getAttribute("aria-label") ?? item.textContent);
    expect(names).toEqual(["Open", "Move to Backlog", "Move to In progress", "Move to Done", "Move down", "Remove from board"]);
  });

  it("moves a card to another column, announces it and keeps focus on it", async () => {
    renderBoard();
    await choose(first.title, "Move to In progress");

    expect(itemOf(first.id).status).toBe("in_progress");
    expect(within(column(/In progress/)).getByText(first.title)).toBeInTheDocument();
    expect(menuAnnouncement()).toBe(`Moved ${first.title} to In progress.`);
    expect(document.activeElement).toBe(card(first.title));
  });

  it("moves a card up and down within its column", async () => {
    renderBoard();
    await choose(first.title, "Move down");
    expect(itemOf(first.id).order).toBe(1);
    expect(itemOf(second.id).order).toBe(0);
    expect(menuAnnouncement()).toBe(`Moved ${first.title} down.`);
    expect(document.activeElement).toBe(card(first.title));

    await choose(first.title, "Move up");
    expect(itemOf(first.id).order).toBe(0);
  });

  it("schedules a Backlog card into the viewed month when it leaves Backlog", async () => {
    state().addPlanItem(third.id, "2026-08", { status: "backlog" });
    renderBoard();
    expect(within(column(/Backlog/)).getByText(third.title)).toBeInTheDocument();
    await choose(third.title, "Move to To do");
    expect(itemOf(third.id)).toMatchObject({ status: "todo", month: "2026-10" });
  });

  it("removes a card with an undo toast and keeps its notes", async () => {
    const itemId = itemOf(first.id).id;
    state().setCardNote(itemId, "summary", "The one idea I'll use.");
    renderBoard();
    await choose(first.title, "Remove from board");

    expect(screen.queryByText(first.title)).toBeNull();
    expect(toastText()).toContain("Removed from October");
    expect(state().data.notes.find((note) => note.planItemId === itemId)?.body).toBe("The one idea I'll use.");
    // Focus moves to the neighbour that took its place.
    expect(document.activeElement).toBe(card(second.title));

    fireEvent.click(within(document.querySelector("[data-toaster]") as HTMLElement).getByRole("button", { name: "Undo" }));
    await settle();
    expect(itemOf(first.id)).toMatchObject({ id: itemId, status: "todo", order: 0 });
    expect(document.activeElement).toBe(card(first.title));
  });
});

describe("BoardView moving to Done", () => {
  it("asks whether a certification was earned; Yes sets earnedAt", async () => {
    state().addPlanItem(certification.id, "2026-10");
    renderBoard();
    await choose(certification.title, "Move to Done");

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName(/^Did you earn .+\?$/);
    fireEvent.click(within(dialog).getByRole("button", { name: "Yes, I earned it" }));
    await settle();

    expect(itemOf(certification.id).earnedAt).toBeDefined();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(card(certification.title));
    expect(within(card(certification.title)).getByText("Earned")).toBeInTheDocument();
  });

  it("Not yet leaves it Done and offers Mark as earned on the card", async () => {
    state().addPlanItem(certification.id, "2026-10");
    renderBoard();
    await choose(certification.title, "Move to Done");
    fireEvent.click(screen.getByRole("button", { name: "Not yet" }));
    await settle();

    expect(itemOf(certification.id)).toMatchObject({ status: "done" });
    expect(itemOf(certification.id).earnedAt).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: `Mark ${certification.title} as earned` }));
    expect(itemOf(certification.id).earnedAt).toBeDefined();
    expect(screen.queryByRole("button", { name: /as earned$/ })).toBeNull();
  });

  it("offers the summary toast once per card, and not when a summary exists", async () => {
    renderBoard();
    await choose(first.title, "Move to Done");
    expect(toastText()).toContain(SUMMARY_NUDGE);
    expect(itemOf(first.id).summaryNudgedAt).toBeDefined();
    act(() => dismissToast());

    await choose(first.title, "Move to In progress");
    await choose(first.title, "Move to Done");
    expect(toastText()).not.toContain(SUMMARY_NUDGE);

    state().setCardNote(itemOf(second.id).id, "summary", "Already written.");
    await choose(second.title, "Move to Done");
    expect(toastText()).not.toContain(SUMMARY_NUDGE);
  });

  it("Write summary opens the card asking for the summary field", async () => {
    renderBoard();
    await choose(first.title, "Move to Done");
    fireEvent.click(within(document.querySelector("[data-toaster]") as HTMLElement).getByRole("button", { name: "Write summary" }));
    await settle();
    const params = new URLSearchParams(window.location.search);
    expect(params.get("item")).toBe(itemOf(first.id).id);
    expect(params.get("focus")).toBe("summary");
    expect(screen.getByRole("dialog", { name: first.title })).toBeInTheDocument();
  });
});

describe("BoardView card drawer (?item=)", () => {
  it("opens the drawer on click and Enter, and closes it again", async () => {
    renderBoard();
    fireEvent.click(card(first.title));
    expect(window.location.search).toBe(`?item=${itemOf(first.id).id}`);
    expect(screen.getByRole("dialog", { name: first.title })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
    expect(window.location.search).toBe("");
    expect(screen.queryByRole("dialog")).toBeNull();

    card(second.title).focus();
    await press("Enter");
    expect(screen.getByRole("dialog", { name: second.title })).toBeInTheDocument();
  });

  it("opens from the ⋯ menu", async () => {
    renderBoard();
    await choose(first.title, "Open");
    expect(screen.getByRole("dialog", { name: first.title })).toBeInTheDocument();
  });

  it("switches to the item's month, and to the current month for Backlog items", async () => {
    const past = state().addPlanItem(third.id, "2026-08")!;
    renderBoard(`/board?item=${past}`);
    await settle();
    expect(screen.getByText("August 2026")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: third.title })).toBeInTheDocument();
    cleanup();

    useUIStore.setState({ selectedMonth: "2026-08" });
    state().movePlanItem(past, { status: "backlog" });
    renderBoard(`/board?item=${past}`);
    await settle();
    expect(screen.getByText("October 2026")).toBeInTheDocument();
  });

  it("is where the Library's On board button leads", () => {
    render(
      <TodayContext value="2026-10-17">
        <ResourceActions material={first} />
      </TodayContext>,
    );
    expect(screen.getByRole("link", { name: /is on your October 2026 board/ })).toHaveAttribute(
      "href",
      `/board?item=${itemOf(first.id).id}`,
    );
  });

  it("toasts for an unknown id and opens the board normally", async () => {
    renderBoard("/board?item=gone");
    await settle();
    expect(toastText()).toContain("That card no longer exists.");
    expect(window.location.search).toBe("");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(card(first.title)).toBeInTheDocument();
  });
});

describe("BoardView past months", () => {
  beforeEach(() => {
    const { addPlanItem } = state();
    addPlanItem(third.id, "2026-09");
    addPlanItem(certification.id, "2026-09", { status: "backlog" });
    useUIStore.setState({ selectedMonth: "2026-09" });
  });

  it("is read-only, hides Backlog and shows the banner", async () => {
    renderBoard();
    expect(screen.getByText("You're looking at September. Cards are read-only, but notes stay editable.")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Backlog/ })).toBeNull();
    expect(card(third.title)).not.toHaveAttribute("aria-roledescription");

    const menu = openMenu(third.title);
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual(["Open"]);
  });

  it("opens a read-only card with Space as well as Enter", async () => {
    renderBoard();
    card(third.title).focus();
    await press("Space");
    expect(screen.getByRole("dialog", { name: third.title })).toBeInTheDocument();
  });

  it("goes back to the current month from the banner", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Back to October" }));
    expect(useUIStore.getState().selectedMonth).toBeNull();
    expect(screen.queryByText(/You're looking at/)).toBeNull();
  });

  it("says when nothing was planned", () => {
    useUIStore.setState({ selectedMonth: "2026-07" });
    state().addPlanItem(third.id, "2026-06");
    renderBoard();
    expect(screen.getByText("Nothing was planned for July.")).toBeInTheDocument();
  });
});

describe("BoardMonthSwitcher", () => {
  it("goes back only, as far as the first month with a plan item", () => {
    state().addPlanItem(third.id, "2026-09");
    renderBoard();
    const next = screen.getByRole("button", { name: "Next month" });
    const previous = screen.getByRole("button", { name: "Previous month" });
    expect(next).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(next);
    expect(screen.getByText("October 2026")).toBeInTheDocument();

    fireEvent.click(previous);
    expect(screen.getByText("September 2026")).toBeInTheDocument();
    expect(previous).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(previous);
    expect(screen.getByText("September 2026")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "This month" }));
    expect(screen.getByText("October 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "This month" })).toBeNull();
  });
});

describe("BoardView filters", () => {
  it("filters by several skills with removable chips", async () => {
    const skills = state().data.skills;
    const skillOf = (id: string) => skills.find((skill) => skill.id === id)!;
    const firstSkill = skillOf(itemOf(first.id).skillIds[0]);
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "Skills" }));
    fireEvent.click(screen.getByRole("checkbox", { name: firstSkill.name }));
    await settle();
    expect(screen.getByRole("button", { name: `Remove filter Skill: ${firstSkill.name}` })).toBeInTheDocument();
    expect(card(first.title)).toBeInTheDocument();
    const secondHasSkill = itemOf(second.id).skillIds.includes(firstSkill.id);
    expect(screen.queryByText(second.title) !== null).toBe(secondHasSkill);

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(card(second.title)).toBeInTheDocument();
  });

  it("filters by one of the quarter's objectives and says when nothing matches", async () => {
    state().addObjective({
      quarter: "2026-Q4",
      title: "Lead with data",
      keyResults: [{ title: "Finish 3", skillId: "made-up-skill", type: "count", count: 3 }],
    });
    state().addObjective({ quarter: "2026-Q3", title: "Last quarter's objective", keyResults: [] });
    renderBoard();

    fireEvent.keyDown(screen.getByRole("button", { name: "Objective" }), { key: "Enter" });
    const options = screen.getAllByRole("menuitemradio").map((option) => option.textContent);
    expect(options).toEqual(["All objectives", "Lead with data"]);
    fireEvent.click(screen.getByRole("menuitemradio", { name: "Lead with data" }));
    await settle();

    expect(screen.getByText("No cards match these filters.")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(card(first.title)).toBeInTheDocument();
  });
});

describe("BoardView empty states", () => {
  it("prompts to find something when the month is empty", () => {
    useAppStore.setState({ data: emptyWorkspace() });
    renderBoard();
    expect(screen.getByText("Nothing on your October board yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find something to learn" })).toHaveAttribute("href", "/library");
  });

  it("explains empty columns", async () => {
    renderBoard();
    expect(within(column(/Backlog/)).getByText("Things you'll do, just not this month.")).toBeInTheDocument();
    expect(within(column(/In progress/)).getByText("Drag a card here when you start.")).toBeInTheDocument();
    expect(within(column(/Done/)).getByText("Finished cards land here.")).toBeInTheDocument();

    await choose(first.title, "Move to Backlog");
    await choose(second.title, "Move to Backlog");
    expect(within(column(/To do/)).getByText("Pick 3 for October. Drag from Backlog, or use ⋯ → Move to To do.")).toBeInTheDocument();
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
    expect(state().data.activity.map((event) => event.kind)).toContain("item_completed");
    // Dropping in Done offers the summary toast too.
    expect(toastText()).toContain(SUMMARY_NUDGE);
  });

  it("drops with Enter without opening the card", async () => {
    renderBoard();
    card(first.title).focus();
    await press("Space");
    await press("ArrowDown");
    await press("Enter");
    expect(itemOf(first.id).order).toBe(1);
    expect(screen.queryByRole("dialog")).toBeNull();
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

  it("does not pick up a card when a key is pressed on its ⋯ button", async () => {
    renderBoard();
    const actions = screen.getByRole("button", { name: `Actions for ${first.title}` });
    actions.focus();
    await press("Space", actions);
    expect(announcement() ?? "").not.toMatch(/Picked up/);
  });
});

describe("BoardView drags only from the card itself", () => {
  beforeEach(fakeLayout);

  const pointer = { isPrimary: true, button: 0, pointerType: "mouse" };
  // Whether a drag started: dnd-kit announced something (pick-up, then the slot it is over).
  async function pointerDrag(target: Element) {
    const before = announcement();
    fireEvent.pointerDown(target, { ...pointer, clientX: 100, clientY: 100 });
    fireEvent.pointerMove(document, { ...pointer, clientX: 110, clientY: 108 });
    await settle();
    const dragged = announcement() !== before;
    fireEvent.pointerUp(document, { ...pointer, clientX: 110, clientY: 108 });
    await settle();
    return dragged;
  }
  async function slowTouch(target: Element) {
    const before = announcement();
    fireEvent.touchStart(target, { touches: [{ clientX: 100, clientY: 100 }] });
    await act(() => new Promise((resolve) => setTimeout(resolve, 260)));
    const dragged = announcement() !== before;
    fireEvent.touchEnd(target, { touches: [], changedTouches: [{ clientX: 100, clientY: 100 }] });
    await settle();
    return dragged;
  }

  it("starts a pointer drag from the card (control for the tests below)", async () => {
    renderBoard();
    expect(await pointerDrag(card(first.title))).toBe(true);
  });

  it("doesn't start a drag from a press and move on a ⋯ menu item", async () => {
    renderBoard();
    const menu = openMenu(first.title);
    expect(await pointerDrag(within(menu).getByRole("menuitem", { name: "Move to Done" }))).toBe(false);
    expect(await pointerDrag(screen.getByRole("button", { name: `Actions for ${second.title}` }))).toBe(false);
  });

  it("doesn't start a drag from a slow touch on ⋯ or on Mark as earned", async () => {
    state().addPlanItem(certification.id, "2026-10", { status: "done" });
    renderBoard();
    expect(await slowTouch(screen.getByRole("button", { name: `Actions for ${second.title}` }))).toBe(false);
    expect(await slowTouch(screen.getByRole("button", { name: `Mark ${certification.title} as earned` }))).toBe(false);
    // Control: the same touch on the card itself picks it up.
    expect(await slowTouch(card(first.title))).toBe(true);
  });
});

describe("BoardView skill impact", () => {
  beforeEach(fakeLayout);

  it("shows each card's skill impact bars", () => {
    renderBoard();
    expect(within(card(first.title)).getByRole("list", { name: "Skill impact" })).toBeInTheDocument();
  });

  it("previews a card's impact while hovered or focused, and clears it on leave, drag and removal", async () => {
    renderBoard();
    const preview = () => useUIStore.getState().skillPreview;
    const item = card(first.title).closest("li")!;

    fireEvent.mouseEnter(item);
    expect(preview()).toMatchObject({ label: first.title, source: { skillIds: first.skillIds } });
    fireEvent.mouseLeave(item);
    expect(preview()).toBeNull();

    card(first.title).focus();
    expect(preview()?.label).toBe(first.title);
    card(second.title).focus();
    expect(preview()?.label).toBe(second.title);

    // Picking up a card clears the preview, and nothing is previewed mid-drag.
    await press("Space");
    expect(preview()).toBeNull();
    fireEvent.mouseEnter(item);
    expect(preview()).toBeNull();
    await press("Escape");

    fireEvent.mouseEnter(item);
    expect(preview()?.label).toBe(first.title);
    cleanup();
    expect(preview()).toBeNull();
  });
});
