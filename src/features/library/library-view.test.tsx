// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { useAppStore } from "@/lib/store/app-store";
import { TodayContext } from "@/lib/store/hooks";
import { emptyWorkspace } from "@/lib/store/seed";
import { LibraryView } from "./library-view";

/**
 * Next's router mirrors native pushState/replaceState into useSearchParams.
 * This stand-in does the same, so the view's URL round trip is exercised for real.
 */
vi.mock("next/navigation", async () => {
  const { useMemo, useSyncExternalStore } = await import("react");
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args: Parameters<History["pushState"]>) => {
      original(...args);
      notify();
    };
  }
  window.addEventListener("popstate", notify);
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  return {
    usePathname: () => "/library",
    useSearchParams: () => {
      const search = useSyncExternalStore(subscribe, () => window.location.search);
      return useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

const [first] = CURATED_MATERIALS;
const certification = CURATED_MATERIALS.find((material) => material.type === "certification")!;

function renderLibrary(url = "/library") {
  window.history.replaceState(null, "", url);
  render(
    <TodayContext value="2026-10-17">
      <LibraryView />
    </TodayContext>,
  );
}

const search = () => decodeURIComponent(window.location.search);
const data = () => useAppStore.getState().data;

beforeEach(() => {
  useAppStore.setState({ data: emptyWorkspace() });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ available: false, code: "not-installed", reason: "Install Claude Code" })),
  );
});
afterEach(cleanup);

describe("LibraryView filters", () => {
  it("multi-selects skills from a popover, shows removable chips and syncs the URL", () => {
    renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: "Skills" }));
    const popover = screen.getByRole("group", { name: "Skills" });
    fireEvent.click(within(popover).getByRole("checkbox", { name: "Roadmapping" }));
    fireEvent.click(within(popover).getByRole("checkbox", { name: "Product Discovery" }));

    expect(search()).toBe("?skill=roadmapping,product-discovery");
    expect(screen.getByRole("button", { name: "Remove filter Skill: Roadmapping" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove filter Skill: Product Discovery" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Remove filter Skill: Roadmapping" }));
    expect(search()).toBe("?skill=product-discovery");
    expect(within(popover).getByRole("checkbox", { name: "Roadmapping" })).not.toBeChecked();
    expect(within(popover).getByRole("checkbox", { name: "Product Discovery" })).toBeChecked();
  });

  it("restores filters from the URL, e.g. after a refresh or from a shared link", () => {
    renderLibrary("/library?type=certification&sort=title");
    expect(screen.getByRole("button", { name: "Remove filter Type: Certification" })).toBeInTheDocument();
    expect(screen.getByLabelText("Sort")).toHaveValue("title");

    const titles = screen.getAllByRole("article").map((card) => within(card).getByRole("heading").textContent);
    expect(titles).toContain(certification.title);
    expect(titles).toEqual([...titles].sort((a, b) => a!.localeCompare(b!)));
  });

  it("shows a helpful empty state whose Clear filters keeps the sort", () => {
    renderLibrary("/library?q=zzzz-no-such-thing&sort=longest");
    expect(screen.getByText("Nothing matches")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(search()).toBe("?sort=longest");
    expect(screen.queryByText("Nothing matches")).not.toBeInTheDocument();
  });

  it("never shows result totals", () => {
    renderLibrary("/library?type=book");
    expect(document.body.textContent).not.toMatch(/\d+\s+(resources|materials|results|items)/i);
  });
});

describe("LibraryView actions", () => {
  it("Add puts the item in To Do on the current month's board and saves it; Undo reverts both", () => {
    useAppStore.setState({ data: { ...emptyWorkspace(), planItems: [] } });
    renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: `Add "${first.title}" to October 2026` }));

    expect(data().planItems).toEqual([expect.objectContaining({ materialId: first.id, month: "2026-10", status: "todo" })]);
    expect(data().savedMaterialIds).toEqual([first.id]);
    expect(screen.getByRole("link", { name: new RegExp(`"${first.title}" is on your October 2026 board`) })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `Undo adding "${first.title}"` }));
    expect(data().planItems).toEqual([]);
    expect(data().savedMaterialIds).toEqual([]);
  });

  it("Save to library toggles, and 'In my library' shows only saved items", () => {
    renderLibrary();
    fireEvent.click(screen.getByRole("button", { name: `Save "${first.title}" to library` }));
    expect(data().savedMaterialIds).toEqual([first.id]);
    expect(screen.getByRole("button", { name: `Saved "${first.title}" to library` })).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getAllByRole("radio", { name: "In my library" })[0]);
    expect(search()).toBe("?show=saved");
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });
});
