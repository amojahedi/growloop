import { describe, expect, it } from "vitest";
import { hiddenWidgets, resolveLayout } from "@/lib/domain/dashboard-layout";
import { DEFAULT_LAYOUT, getWidget, WIDGETS } from "./widget-registry";

describe("widget registry", () => {
  it("has unique ids and gallery copy for every widget", () => {
    expect(new Set(WIDGETS.map((widget) => widget.id)).size).toBe(WIDGETS.length);
    for (const widget of WIDGETS) {
      expect(widget.title).not.toBe("");
      expect(widget.description).not.toBe("");
      expect(getWidget(widget.id)).toBe(widget);
    }
    expect(getWidget("nope")).toBeUndefined();
  });

  it("ships the seven dashboard widgets and nothing about hours", () => {
    expect(WIDGETS.map((widget) => widget.id).sort()).toEqual(
      ["due-for-review", "items-completed", "learning-streak", "notes", "okr-progress", "reminders", "skill-radar"].sort(),
    );
    expect(WIDGETS.some((widget) => /hour/i.test(`${widget.id} ${widget.title} ${widget.description}`))).toBe(false);
  });

  it("keeps the core metric locked and first by default (ADR 006)", () => {
    expect(getWidget("items-completed")?.locked).toBe(true);
    expect(DEFAULT_LAYOUT[0].widgetId).toBe("items-completed");
  });

  it("follows the dashboard spec's default order, with Due for review small after Skill radar", () => {
    expect(DEFAULT_LAYOUT.map((placement) => placement.widgetId)).toEqual([
      "items-completed",
      "okr-progress",
      "skill-radar",
      "due-for-review",
      "reminders",
      "learning-streak",
      "notes",
    ]);
    expect(getWidget("due-for-review")).toMatchObject({ title: "Due for review", description: "Notes you asked to see again.", defaultSize: "small" });
  });

  it("never injects Due for review into a layout saved before it existed, but offers it in the gallery", () => {
    const saved = [
      { widgetId: "items-completed", size: "small" as const },
      { widgetId: "notes", size: "medium" as const },
    ];
    const layout = resolveLayout(saved, WIDGETS);
    expect(layout.map((placement) => placement.widgetId)).not.toContain("due-for-review");
    expect(hiddenWidgets(layout, WIDGETS).map((widget) => widget.id)).toContain("due-for-review");
  });
});
