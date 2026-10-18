// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOUR_STEPS, type TourStep } from "@/content/help/tour";
import { useAppStore } from "@/lib/store/app-store";
import { clearDevicePreferences, readDevicePreferences, updateDevicePreferences } from "@/lib/store/device";
import { emptyWorkspace } from "@/lib/store/seed";

const navigation = vi.hoisted(() => ({ pathname: "/", push: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ push: navigation.push }),
}));

const { GuidedTour, placePopover, TOUR_START_DELAY_MS } = await import("./guided-tour");
const { requestTour, resolveTourSteps, shouldAutoStartTour, useTourStore } = await import("./tour-store");

/** jsdom lays nothing out: elements count as visible unless marked `data-hidden`. */
function stubLayout() {
  vi.spyOn(Element.prototype, "getClientRects").mockImplementation(function (this: Element) {
    return (this.closest("[data-hidden]") ? [] : [{}]) as unknown as DOMRectList;
  });
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
    const size = this.closest("[data-hidden]") ? 0 : 40;
    return { top: 100, left: 100, width: size, height: size, right: 100 + size, bottom: 100 + size, x: 100, y: 100, toJSON: () => ({}) };
  });
  Element.prototype.scrollIntoView = vi.fn();
}

/** A dashboard-like page with every tour target; `hide` marks some as off screen. */
function Page({ hide = [] as string[], missing = [] as string[] }) {
  const targets = ["widget-items-completed", "widget-skill-radar", "nav-okrs", "nav-library", "nav-board", "nav-notebook", "help"];
  return (
    <div>
      <button type="button">Before</button>
      {targets
        .filter((target) => !missing.includes(target))
        .map((target) => (
          <button key={target} type="button" data-tour={target} data-hidden={hide.includes(target) ? "" : undefined}>
            {target}
          </button>
        ))}
      <button type="button" data-tour="menu">
        Menu
      </button>
      <main id="content" tabIndex={-1} />
    </div>
  );
}

async function hydrate() {
  await act(async () => {
    await useAppStore.persist.rehydrate();
  });
}

async function startDelay() {
  await act(async () => {
    vi.advanceTimersByTime(TOUR_START_DELAY_MS + 10);
  });
}

beforeEach(async () => {
  localStorage.clear();
  clearDevicePreferences();
  useTourStore.setState({ status: "idle" });
  navigation.pathname = "/";
  navigation.push.mockReset();
  stubLayout();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date(2026, 9, 18, 12));
  useAppStore.setState({ data: emptyWorkspace() });
  await hydrate();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("tour content", () => {
  it("has the 7 steps of the spec, in order, as data", () => {
    expect(TOUR_STEPS.map((step) => step.target)).toEqual([
      "widget-items-completed",
      "widget-skill-radar",
      "nav-okrs",
      "nav-library",
      "nav-board",
      "nav-notebook",
      "help",
    ]);
    expect(TOUR_STEPS[0]).toMatchObject({ title: "Your month at a glance" });
    expect(TOUR_STEPS.at(-1)).toMatchObject({ title: "Here when you need it", body: "Replay this tour or read how Growloop works." });
  });
});

describe("resolveTourSteps", () => {
  const steps: TourStep[] = [
    { target: "a", title: "A", body: "" },
    { target: "b", fallbackTarget: "menu", title: "B", body: "" },
    { target: "c", title: "C", body: "" },
  ];

  it("skips steps whose target isn't on screen and falls back when one is given", () => {
    render(
      <div>
        <span data-tour="a">a</span>
        <span data-tour="b" data-hidden="">
          b
        </span>
        <span data-tour="menu">menu</span>
      </div>,
    );
    const resolved = resolveTourSteps(steps);
    expect(resolved.map(({ step, element }) => [step.title, element.textContent])).toEqual([
      ["A", "a"],
      ["B", "menu"],
    ]);
  });

  it("picks the visible copy when a target exists twice (sidebar and menu sheet)", () => {
    render(
      <div>
        <span data-tour="a" data-hidden="">
          hidden
        </span>
        <span data-tour="a">shown</span>
      </div>,
    );
    expect(resolveTourSteps(steps)[0].element.textContent).toBe("shown");
  });
});

describe("shouldAutoStartTour", () => {
  it("starts once, on the Dashboard, after the first-launch choice", () => {
    expect(shouldAutoStartTour({ welcomeDoneAt: "x" }, "/")).toBe(true);
    expect(shouldAutoStartTour({ welcomeDoneAt: "x" }, "/okrs/plan")).toBe(false);
    expect(shouldAutoStartTour({ welcomeDoneAt: "x", tourSeenAt: "y" }, "/")).toBe(false);
    expect(shouldAutoStartTour({}, "/")).toBe(false);
    expect(shouldAutoStartTour(null, "/")).toBe(false);
  });
});

describe("placePopover", () => {
  const viewport = { width: 1280, height: 800 };
  const popover = { width: 352, height: 200 };

  it("goes below the target when it fits, aligned to its left edge", () => {
    expect(placePopover({ top: 100, left: 300, width: 200, height: 40 }, popover, viewport)).toEqual({ top: 158, left: 300 });
  });

  it("goes above when there's no room below", () => {
    expect(placePopover({ top: 700, left: 300, width: 200, height: 40 }, popover, viewport)).toEqual({ top: 482, left: 300 });
  });

  it("goes beside a tall target and stays inside the viewport", () => {
    expect(placePopover({ top: 50, left: 16, width: 220, height: 700 }, popover, viewport)).toEqual({ top: 50, left: 254 });
    expect(placePopover({ top: 20, left: 1200, width: 60, height: 40 }, popover, viewport).left).toBe(1280 - 352 - 16);
  });

  it("fits a 375 px screen with a 16 px gutter, and centers without a target", () => {
    const phone = { width: 375, height: 700 };
    expect(placePopover({ top: 10, left: 330, width: 32, height: 32 }, { width: 343, height: 200 }, phone)).toEqual({ top: 60, left: 16 });
    expect(placePopover(null, popover, viewport)).toEqual({ top: 300, left: 464 });
  });
});

describe("GuidedTour", () => {
  async function renderTour(props: Parameters<typeof Page>[0] = {}) {
    const result = render(
      <>
        <Page {...props} />
        <GuidedTour />
      </>,
    );
    await startDelay();
    return result;
  }

  it("starts by itself on the Dashboard after the first-launch choice, once", async () => {
    updateDevicePreferences({ welcomeDoneAt: "2026-10-18T10:00:00.000Z" });
    await renderTour();

    const dialog = screen.getByRole("dialog", { name: "Your month at a glance" });
    expect(dialog).toHaveAccessibleDescription("The big number is what you've finished this month. It's the one that counts.");
    expect(screen.getByText("1 of 7")).toBeInTheDocument();
    expect(readDevicePreferences().tourSeenAt).toBeDefined();
    expect(readDevicePreferences().tourCompletedAt).toBeUndefined();

    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(readDevicePreferences().tourCompletedAt).toBeDefined();

    cleanup();
    await renderTour();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("never starts by itself before the first-launch choice, on other pages or for existing users", async () => {
    await renderTour();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    cleanup();
    updateDevicePreferences({ welcomeDoneAt: "2026-10-18T10:00:00.000Z" });
    navigation.pathname = "/okrs/plan";
    await renderTour();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(navigation.push).not.toHaveBeenCalled();
  });

  it("walks through the steps with Next and Back, and Done completes it", async () => {
    await renderTour();
    act(() => requestTour());
    await startDelay();

    const next = screen.getByRole("button", { name: "Next" });
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
    fireEvent.click(next);
    expect(screen.getByRole("dialog", { name: "Where you're growing" })).toBeInTheDocument();
    expect(screen.getByText("2 of 7")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByText("1 of 7")).toBeInTheDocument();

    for (let step = 1; step < 7; step++) fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "Here when you need it" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(readDevicePreferences().tourCompletedAt).toBeDefined();
  });

  it("skips missing targets and adjusts the count; nav steps use the menu button when the sidebar is hidden", async () => {
    await renderTour({ missing: ["widget-skill-radar"], hide: ["nav-okrs", "nav-library", "nav-board", "nav-notebook"] });
    act(() => requestTour());
    await startDelay();

    expect(screen.getByText("1 of 6")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "Set your year" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAccessibleDescription(
      "A few goals, each tied to a skill. Progress fills in as you finish things.",
    );
  });

  it("moves focus into the popover, traps Tab, skips on Esc and gives focus back", async () => {
    await renderTour();
    const before = screen.getByRole("button", { name: "Before" });
    before.focus();
    act(() => requestTour());
    await startDelay();

    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toHaveFocus();
    // Tab from the last control wraps to the first; Shift+Tab from the first goes to the last.
    fireEvent.keyDown(document, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Skip tour" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(next).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(before).toHaveFocus();
    expect(readDevicePreferences().tourCompletedAt).toBeDefined();
  });

  it("takes focus back when something else grabs it mid-tour (e.g. a closing dialog)", async () => {
    await renderTour();
    act(() => requestTour());
    await startDelay();
    act(() => document.getElementById("content")?.focus());
    expect(screen.getByRole("button", { name: "Next" })).toHaveFocus();
  });

  it("describes the highlighted element by the step's text while it is shown", async () => {
    await renderTour();
    act(() => requestTour());
    await startDelay();
    const target = screen.getByRole("button", { name: "widget-items-completed" });
    expect(target).toHaveAccessibleDescription(TOUR_STEPS[0].body);
    fireEvent.click(screen.getByRole("button", { name: "Skip tour" }));
    expect(target).not.toHaveAttribute("aria-describedby");
  });

  it("goes to the Dashboard first when asked for on another page", async () => {
    navigation.pathname = "/library";
    await renderTour();
    act(() => requestTour());
    expect(navigation.push).toHaveBeenCalledWith("/");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("gives up quietly when nothing can be highlighted", async () => {
    render(<GuidedTour />);
    act(() => requestTour());
    await startDelay();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useTourStore.getState().status).toBe("idle");
  });
});
