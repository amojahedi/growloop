// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useSyncExternalStore } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TOUR_STEPS } from "@/content/help/tour";
import { STORAGE_KEY, useAppStore } from "@/lib/store/app-store";
import { clearDevicePreferences, readDevicePreferences, updateDevicePreferences } from "@/lib/store/device";
import { emptyWorkspace } from "@/lib/store/seed";

/**
 * The first visit end to end: the first-launch screen and the tour together,
 * with navigation that lands later than the tour's start delay, like the real
 * router fetching a page.
 */

const NAVIGATION_MS = 400;

const router = vi.hoisted(() => {
  let pathname = "/";
  const listeners = new Set<() => void>();
  return {
    get pathname() {
      return pathname;
    },
    set(next: string) {
      pathname = next;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    push: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({
  usePathname: () => useSyncExternalStore(router.subscribe, () => router.pathname),
  useRouter: () => ({ push: router.push }),
}));

const { GuidedTour, TOUR_START_DELAY_MS } = await import("./guided-tour");
const { FirstLaunch } = await import("@/features/onboarding/first-launch");
const { requestTour, useTourStore } = await import("./tour-store");

/** Like the app router: the URL changes once the next page has loaded. */
function navigate(url: string) {
  setTimeout(() => router.set(new URL(url, "http://localhost").pathname), NAVIGATION_MS);
}

function App() {
  const pathname = useSyncExternalStore(router.subscribe, () => router.pathname);
  return (
    <>
      <nav>
        <a
          href="/board"
          onClick={(event) => {
            event.preventDefault();
            router.push("/board");
          }}
        >
          Board
        </a>
        <button type="button" data-tour="nav-okrs">
          OKRs
        </button>
        <button type="button" data-tour="help">
          Help
        </button>
      </nav>
      <main id="content" tabIndex={-1}>
        {pathname === "/" && <section data-tour={TOUR_STEPS[0].target}>Items completed</section>}
      </main>
      <FirstLaunch />
      <GuidedTour />
    </>
  );
}

async function advance(ms: number) {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
}

const tourDialog = () => screen.queryByRole("dialog", { name: TOUR_STEPS[0].title });

beforeEach(async () => {
  localStorage.clear();
  clearDevicePreferences();
  useTourStore.setState({ status: "idle", origin: null, autoStartHeld: false });
  router.set("/");
  router.push.mockReset();
  router.push.mockImplementation(navigate);
  vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
    top: 100, left: 100, width: 40, height: 40, right: 140, bottom: 140, x: 100, y: 100, toJSON: () => ({}),
  });
  Element.prototype.scrollIntoView = vi.fn();
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  vi.setSystemTime(new Date(2026, 9, 18, 12));
  useAppStore.persist.setOptions({ name: STORAGE_KEY });
  useAppStore.setState({ data: emptyWorkspace() });
  await act(async () => {
    await useAppStore.persist.rehydrate();
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("first visit", () => {
  it("Set your year goes to the wizard and stays there; the tour waits for the Dashboard", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Set your year" }));

    // Past the tour's start delay, before the wizard has loaded.
    await advance(TOUR_START_DELAY_MS + 50);
    expect(tourDialog()).not.toBeInTheDocument();
    await advance(NAVIGATION_MS);
    expect(router.pathname).toBe("/okrs/plan");
    await advance(1_000);
    expect(router.push.mock.calls).toEqual([["/okrs/plan?from=welcome"]]);
    expect(tourDialog()).not.toBeInTheDocument();
    expect(readDevicePreferences().tourSeenAt).toBeUndefined();

    // Cancelling or accepting the wizard lands on the Dashboard: now the tour starts.
    act(() => router.set("/"));
    await advance(TOUR_START_DELAY_MS + 10);
    expect(tourDialog()).toBeInTheDocument();
  });

  it("Skip for now starts the tour on the Dashboard", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    await advance(TOUR_START_DELAY_MS + 10);
    expect(tourDialog()).toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("a nav link followed before the tour appears wins, and the tour comes on the next Dashboard visit", async () => {
    updateDevicePreferences({ welcomeDoneAt: "2026-10-18T10:00:00.000Z" });
    render(<App />);
    await advance(100);
    fireEvent.click(screen.getByRole("link", { name: "Board" }));

    await advance(TOUR_START_DELAY_MS + 50);
    expect(tourDialog()).not.toBeInTheDocument();
    await advance(NAVIGATION_MS);
    expect(router.pathname).toBe("/board");
    await advance(1_000);
    expect(router.push.mock.calls).toEqual([["/board"]]);
    expect(tourDialog()).not.toBeInTheDocument();

    act(() => router.set("/"));
    await advance(TOUR_START_DELAY_MS + 10);
    expect(tourDialog()).toBeInTheDocument();
  });

  it("never starts by itself in the wizard, even right after the first-launch choice", async () => {
    updateDevicePreferences({ welcomeDoneAt: "2026-10-18T10:00:00.000Z" });
    act(() => router.set("/okrs/plan"));
    render(<App />);
    await advance(2_000);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.push).not.toHaveBeenCalled();
  });

  it("Help asked for elsewhere goes to the Dashboard once, then starts", async () => {
    updateDevicePreferences({ welcomeDoneAt: "x", tourSeenAt: "y", tourCompletedAt: "z" });
    act(() => router.set("/library"));
    render(<App />);
    act(() => requestTour("help"));
    await advance(NAVIGATION_MS + 10);
    expect(router.pathname).toBe("/");
    await advance(TOUR_START_DELAY_MS + 10);
    expect(tourDialog()).toBeInTheDocument();
    expect(router.push.mock.calls).toEqual([["/"]]);
  });
});

describe("a remounted target", () => {
  it("is found again by its anchor: the spotlight and the description follow the new element", async () => {
    updateDevicePreferences({ welcomeDoneAt: "x" });
    render(<App />);
    await advance(TOUR_START_DELAY_MS + 10);
    const first = screen.getByText("Items completed");
    expect(first).toHaveAccessibleDescription(TOUR_STEPS[0].body);

    // A widget remounts (e.g. the dashboard re-renders it) while the tour is open.
    vi.useRealTimers();
    const replacement = first.cloneNode(true) as HTMLElement;
    replacement.removeAttribute("aria-describedby");
    act(() => first.replaceWith(replacement));
    await waitFor(() => expect(replacement).toHaveAccessibleDescription(TOUR_STEPS[0].body));
    expect(first).not.toHaveAttribute("aria-describedby");
  });
});
