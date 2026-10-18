// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/lib/store/app-store";
import { TodayContext } from "@/lib/store/hooks";
import { emptyWorkspace } from "@/lib/store/seed";
import { useUIStore } from "@/lib/store/ui-store";
import { CustomizeToolbar } from "./customize-toolbar";
import { DashboardView } from "./dashboard-view";

function renderDashboard() {
  return render(
    <TodayContext value="2026-10-17">
      <CustomizeToolbar />
      <DashboardView />
    </TodayContext>,
  );
}

const button = (name: string | RegExp) => screen.getByRole("button", { name });
const widgetIds = () =>
  [...document.querySelectorAll<HTMLElement>("[data-widget-id]")].map((element) => element.dataset.widgetId);
const savedLayout = () => useAppStore.getState().data.dashboardLayout;

beforeAll(() => {
  // jsdom has no ResizeObserver, which the skill radar's ResponsiveContainer needs.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});
beforeEach(() => useAppStore.setState({ data: emptyWorkspace() }));
afterEach(() => {
  cleanup();
});

describe("dashboard edit mode", () => {
  it("shows the default widgets, without hours", () => {
    renderDashboard();
    expect(widgetIds()).toEqual([
      "items-completed",
      "okr-progress",
      "skill-radar",
      "due-for-review",
      "reminders",
      "learning-streak",
      "notes",
    ]);
    expect(screen.queryByText(/hours/i)).toBeNull();
    expect(screen.queryByRole("button", { name: /^Move / })).toBeNull();
  });

  it("adds handles, size pickers and remove buttons; the core metric cannot be removed", () => {
    renderDashboard();
    fireEvent.click(button("Customize"));

    expect(document.activeElement).toBe(button("Done"));
    expect(screen.getAllByRole("button", { name: /^Move / })).toHaveLength(7);
    expect(screen.getAllByRole("group", { name: /^Size of / })).toHaveLength(7);
    expect(screen.queryByRole("button", { name: "Remove Items completed" })).toBeNull();
    expect(button("Remove Skill radar")).toBeInTheDocument();
  });

  it("removes, re-adds and resizes widgets, then saves on Done", () => {
    renderDashboard();
    fireEvent.click(button("Customize"));

    fireEvent.click(button("Remove Learning streak"));
    expect(widgetIds()).not.toContain("learning-streak");
    // Focus moves to the next widget's handle rather than getting lost.
    expect(document.activeElement).toBe(button("Move Notes & summaries"));

    fireEvent.click(button("Add widget"));
    const dialog = screen.getByRole("dialog", { name: "Add a widget" });
    expect(dialog).toHaveTextContent("Current and longest streak");
    fireEvent.click(within(dialog).getByRole("button", { name: "Add Learning streak" }));
    expect(widgetIds().at(-1)).toBe("learning-streak");

    const size = screen.getByRole("group", { name: "Size of Skill radar" });
    fireEvent.click(within(size).getByRole("radio", { name: "Large" }));
    expect(document.querySelector('[data-widget-id="skill-radar"]')).toHaveClass("lg:col-span-3");

    expect(savedLayout()).toBeNull();
    fireEvent.click(button("Done"));

    expect(savedLayout()).toEqual([
      { widgetId: "items-completed", size: "small" },
      { widgetId: "okr-progress", size: "medium" },
      { widgetId: "skill-radar", size: "large" },
      { widgetId: "due-for-review", size: "small" },
      { widgetId: "reminders", size: "small" },
      { widgetId: "notes", size: "medium" },
      { widgetId: "learning-streak", size: "small" },
    ]);
    expect(document.activeElement).toBe(button("Customize"));
  });

  it("reverts every edit on Cancel", () => {
    renderDashboard();
    fireEvent.click(button("Customize"));
    fireEvent.click(button("Remove Upcoming reminders"));
    fireEvent.click(button("Cancel"));

    expect(widgetIds()).toContain("reminders");
    expect(savedLayout()).toBeNull();
  });

  it("resets to the default layout, stored as the default", () => {
    useAppStore.getState().setDashboardLayout([{ widgetId: "items-completed", size: "large" }]);
    renderDashboard();
    expect(widgetIds()).toEqual(["items-completed"]);

    fireEvent.click(button("Customize"));
    fireEvent.click(button("Reset to default"));
    expect(widgetIds()).toHaveLength(7);
    fireEvent.click(button("Done"));

    expect(savedLayout()).toBeNull();
  });

  it("previews a hovered item's skill impact on the radar", () => {
    renderDashboard();
    const radar = () => document.querySelector<HTMLElement>('[data-widget-id="skill-radar"]')!;
    expect(radar()).not.toHaveTextContent("Inspired");

    act(() =>
      useUIStore.getState().showSkillPreview({ id: "item-1", label: "Inspired", source: { skillIds: ["roadmapping"] } }),
    );
    expect(within(radar()).getByRole("table")).toHaveTextContent("Inspired");

    act(() => useUIStore.getState().hideSkillPreview("item-1"));
    expect(radar()).not.toHaveTextContent("Inspired");
  });

  it("explains when every widget is already shown", () => {
    renderDashboard();
    fireEvent.click(button("Customize"));
    fireEvent.click(button("Add widget"));
    expect(screen.getByRole("dialog")).toHaveTextContent("Every widget is already on your dashboard.");
  });
});
