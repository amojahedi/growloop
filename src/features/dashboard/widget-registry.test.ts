import { describe, expect, it } from "vitest";
import { WIDGET_COLUMNS } from "@/lib/domain/dashboard-layout";
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

  it("ships the six dashboard widgets and nothing about hours", () => {
    expect(WIDGETS.map((widget) => widget.id).sort()).toEqual(
      ["items-completed", "learning-streak", "notes", "okr-progress", "reminders", "skill-radar"].sort(),
    );
    expect(WIDGETS.some((widget) => /hour/i.test(`${widget.id} ${widget.title} ${widget.description}`))).toBe(false);
  });

  it("keeps the core metric locked and first by default (ADR 006)", () => {
    expect(getWidget("items-completed")?.locked).toBe(true);
    expect(DEFAULT_LAYOUT[0].widgetId).toBe("items-completed");
  });

  it("fills whole rows of the 3-column grid by default", () => {
    let row = 0;
    for (const placement of DEFAULT_LAYOUT) {
      row += WIDGET_COLUMNS[placement.size];
      expect(row).toBeLessThanOrEqual(3);
      if (row === 3) row = 0;
    }
    expect(row).toBe(0);
  });
});
