// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { useAppStore } from "@/lib/store/app-store";
import { clearDevicePreferences } from "@/lib/store/device";
import { emptyWorkspace } from "@/lib/store/seed";
import { useUIStore } from "@/lib/store/ui-store";
import { makeItem, makeKeyResult, makeNote, makeObjective } from "@/lib/testing/fixtures";

const mocks = vi.hoisted(() => ({
  pathname: "/",
  push: vi.fn(),
  ai: { provider: null as "key" | "local" | null, checking: false },
}));
vi.mock("next/navigation", () => ({ usePathname: () => mocks.pathname, useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/ai/status", () => ({ useAIStatus: () => mocks.ai }));

const { SidebarContent } = await import("./sidebar");
const { sidebarObjectives } = await import("./sidebar-objectives");
const { claudeStatusLabel } = await import("./sidebar-footer");
const { Breadcrumb } = await import("./breadcrumb");
const { HelpMenu } = await import("./help-menu");
const { MobileMenu } = await import("./mobile-menu");
const { MonthSwitcher, monthSwitcherLimits } = await import("./month-switcher");
const { NAV_ITEMS, pageTitle } = await import("./nav-items");
const { useTourStore } = await import("@/features/help/tour-store");

const store = () => useAppStore.getState();

beforeEach(async () => {
  localStorage.clear();
  clearDevicePreferences();
  mocks.pathname = "/";
  mocks.push.mockReset();
  mocks.ai = { provider: null, checking: false };
  useTourStore.setState({ status: "idle" });
  useUIStore.setState({ selectedMonth: null });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 18, 12));
  useAppStore.setState({ data: emptyWorkspace() });
  await act(async () => {
    await useAppStore.persist.rehydrate();
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("navigation", () => {
  it("is Dashboard, Board, Library, Notebook, OKRs, with Settings at the bottom and no Skills", () => {
    mocks.pathname = "/okrs/plan";
    render(<SidebarContent />);
    const nav = screen.getByRole("navigation", { name: "Main" });
    const links = within(nav).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["Dashboard", "Board", "Library", "Notebook", "OKRs"]);
    expect(links.map((link) => link.getAttribute("data-tour"))).toEqual(["nav-dashboard", "nav-board", "nav-library", "nav-notebook", "nav-okrs"]);
    expect(within(nav).getByRole("link", { name: "OKRs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
    expect(screen.queryByRole("link", { name: /Skills/ })).not.toBeInTheDocument();
  });

  it("shows the due notes count on Notebook, hidden at 0", () => {
    render(<SidebarContent />);
    expect(screen.getByRole("link", { name: "Notebook" })).toBeInTheDocument();

    act(() => {
      useAppStore.setState({
        data: { ...emptyWorkspace(), notes: [makeNote({ reviewAt: "2026-10-18" }), makeNote({ reviewAt: "2026-10-10" }), makeNote({ reviewAt: "2026-10-30" })] },
      });
    });
    expect(screen.getByRole("link", { name: "Notebook, 2 notes to review" })).toBeInTheDocument();
  });

  it("names the page in the breadcrumb, and unknown routes as not found", () => {
    expect(NAV_ITEMS.map((item) => pageTitle(item.href))).toEqual(["Dashboard", "Board", "Library", "Notebook", "OKRs"]);
    expect(pageTitle("/okrs/plan")).toBe("OKRs");
    expect(pageTitle("/guide")).toBe("Guide");
    expect(pageTitle("/nope")).toBe("Not found");
    mocks.pathname = "/library";
    render(<Breadcrumb />);
    const trail = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(trail).toHaveTextContent(/^Growloop\s*\/\s*Library$/);
  });
});

describe("sidebar objectives slot", () => {
  const roadmap = (overrides = {}) =>
    makeObjective({ quarter: "2026-Q4", keyResults: [makeKeyResult({ skillId: "roadmapping", count: 2 })], ...overrides });

  it("asks to set the year until an active objective exists", () => {
    expect(sidebarObjectives([], [], "2026-Q4")).toEqual({ kind: "set-your-year" });
    expect(sidebarObjectives([roadmap({ status: "closed" })], [], "2026-Q4")).toEqual({ kind: "set-your-year" });
    render(<SidebarContent />);
    expect(screen.getByRole("link", { name: "Set your year" })).toHaveAttribute("href", "/okrs/plan");
  });

  it("offers to plan the quarter when objectives exist but none this quarter", () => {
    act(() => useAppStore.setState({ data: { ...emptyWorkspace(), objectives: [roadmap({ quarter: "2027-Q1" })] } }));
    render(<SidebarContent />);
    expect(screen.getByText(/Nothing set for Q4/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plan it" })).toHaveAttribute("href", "/okrs/plan");
  });

  it("lists this quarter's objectives with progress, at most 3 and '+ n more'", () => {
    const done = makeItem({ status: "done", skillIds: ["roadmapping"], completedAt: "2026-10-05T10:00:00.000Z" });
    const objectives = ["One", "Two", "Three", "Four", "Five"].map((title) => roadmap({ title }));
    act(() => useAppStore.setState({ data: { ...emptyWorkspace(), objectives, planItems: [done] } }));
    render(<SidebarContent />);

    const slot = screen.getByRole("region", { name: "Q4 2026" });
    const links = within(slot).getAllByRole("link");
    expect(links.map((link) => link.textContent)).toEqual(["One50%", "Two50%", "Three50%", "+ 2 more"]);
    expect(links.every((link) => link.getAttribute("href") === "/okrs")).toBe(true);
  });
});

describe("sidebar footer", () => {
  it("says the data stays on this device and shows the live Claude status, linking to Settings", () => {
    expect(claudeStatusLabel({ provider: "key", checking: false })).toBe("Claude on");
    expect(claudeStatusLabel({ provider: null, checking: true })).toBe("Claude…");
    expect(claudeStatusLabel({ provider: null, checking: false })).toBe("Claude off");

    mocks.ai = { provider: "local", checking: false };
    render(<SidebarContent />);
    expect(screen.getByText("Saved on this device")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Claude on" })).toHaveAttribute("href", "/settings#claude");
  });
});

describe("Help menu", () => {
  const openMenu = () => {
    const button = screen.getByRole("button", { name: "Help" });
    expect(button).toHaveAttribute("data-tour", "help");
    fireEvent.keyDown(button, { key: "ArrowDown" });
  };

  it("offers the tour, the guide and Turn on Claude while Claude is off", () => {
    render(<HelpMenu />);
    openMenu();
    expect(screen.getByRole("menuitem", { name: "Take the tour" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "How Growloop works" })).toHaveAttribute("href", "/guide");
    expect(screen.getByRole("menuitem", { name: "Turn on Claude" })).toHaveAttribute("href", "/settings#claude");
  });

  it("hides Turn on Claude while Claude is on", () => {
    mocks.ai = { provider: "key", checking: false };
    render(<HelpMenu />);
    openMenu();
    expect(screen.queryByRole("menuitem", { name: "Turn on Claude" })).not.toBeInTheDocument();
  });

  it("Take the tour asks for the tour", () => {
    render(<HelpMenu />);
    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Take the tour" }));
    expect(useTourStore.getState().status).toBe("pending");
  });
});

describe("mobile menu", () => {
  it("opens the full sidebar in a sheet and closes it when a link is followed", () => {
    render(<MobileMenu />);
    const button = screen.getByRole("button", { name: "Menu" });
    expect(button).toHaveAttribute("data-tour", "menu");
    fireEvent.click(button);

    const sheet = screen.getByRole("dialog", { name: "Menu" });
    expect(within(sheet).getByRole("navigation", { name: "Main" })).toBeInTheDocument();
    expect(within(sheet).getByText("Saved on this device")).toBeInTheDocument();
    fireEvent.click(within(sheet).getByRole("link", { name: "Board" }));
    expect(screen.queryByRole("dialog", { name: "Menu" })).not.toBeInTheDocument();
  });
});

describe("month switcher", () => {
  it("goes back only, down to the earliest month with a card", () => {
    expect(monthSwitcherLimits("2026-10", "2026-10", ["2026-08", "2026-10"])).toEqual({ canGoBack: true, canGoForward: false });
    expect(monthSwitcherLimits("2026-08", "2026-10", ["2026-08", "2026-10"])).toEqual({ canGoBack: false, canGoForward: true });
    expect(monthSwitcherLimits("2026-10", "2026-10", [])).toEqual({ canGoBack: false, canGoForward: false });
  });

  it("shares the month, and offers This month when looking back", () => {
    act(() => void store().addPlanItem(CURATED_MATERIALS[0].id, "2026-09"));
    render(<MonthSwitcher />);
    expect(screen.getByRole("button", { name: "Next month" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));

    expect(screen.getByText("September 2026")).toBeInTheDocument();
    expect(useUIStore.getState().selectedMonth).toBe("2026-09");
    expect(screen.getByRole("button", { name: "Previous month" })).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    expect(useUIStore.getState().selectedMonth).toBe("2026-09");
    fireEvent.click(screen.getByRole("button", { name: "This month" }));
    expect(screen.getByText("October 2026")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "This month" })).not.toBeInTheDocument();
  });
});
