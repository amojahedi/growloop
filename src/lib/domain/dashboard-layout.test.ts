import { describe, expect, it } from "vitest";
import {
  defaultLayout,
  hiddenWidgets,
  layoutReducer,
  resolveLayout,
  sameLayout,
  type WidgetMeta,
} from "./dashboard-layout";
import type { WidgetPlacement } from "./types";

const WIDGETS: WidgetMeta[] = [
  { id: "core", defaultSize: "small", locked: true },
  { id: "radar", defaultSize: "medium" },
  { id: "notes", defaultSize: "medium" },
  { id: "extra", defaultSize: "large", hiddenByDefault: true },
];

const ids = (layout: readonly WidgetPlacement[]) => layout.map((placement) => placement.widgetId);

describe("defaultLayout", () => {
  it("lists widgets in registry order with their default size, skipping hidden-by-default ones", () => {
    expect(defaultLayout(WIDGETS)).toEqual([
      { widgetId: "core", size: "small" },
      { widgetId: "radar", size: "medium" },
      { widgetId: "notes", size: "medium" },
    ]);
  });
});

describe("resolveLayout", () => {
  it("uses the default layout when nothing is saved", () => {
    expect(resolveLayout(null, WIDGETS)).toEqual(defaultLayout(WIDGETS));
  });

  it("keeps a saved layout's order and sizes", () => {
    const saved: WidgetPlacement[] = [
      { widgetId: "notes", size: "small" },
      { widgetId: "core", size: "large" },
    ];
    expect(resolveLayout(saved, WIDGETS)).toEqual(saved);
  });

  it("drops unknown and duplicate widgets", () => {
    const saved: WidgetPlacement[] = [
      { widgetId: "core", size: "small" },
      { widgetId: "retired", size: "small" },
      { widgetId: "radar", size: "large" },
      { widgetId: "radar", size: "small" },
    ];
    expect(resolveLayout(saved, WIDGETS)).toEqual([
      { widgetId: "core", size: "small" },
      { widgetId: "radar", size: "large" },
    ]);
  });

  it("puts a missing locked widget back in front", () => {
    expect(ids(resolveLayout([{ widgetId: "notes", size: "small" }], WIDGETS))).toEqual(["core", "notes"]);
    expect(ids(resolveLayout([], WIDGETS))).toEqual(["core"]);
  });

  it("does not share objects with the stored layout", () => {
    const saved: WidgetPlacement[] = [{ widgetId: "core", size: "small" }];
    expect(resolveLayout(saved, WIDGETS)[0]).not.toBe(saved[0]);
  });
});

describe("hiddenWidgets", () => {
  it("returns widgets not on the dashboard, in registry order", () => {
    const layout: WidgetPlacement[] = [
      { widgetId: "notes", size: "small" },
      { widgetId: "core", size: "small" },
    ];
    expect(hiddenWidgets(layout, WIDGETS).map((widget) => widget.id)).toEqual(["radar", "extra"]);
  });
});

describe("sameLayout", () => {
  it("compares order and sizes", () => {
    const layout = defaultLayout(WIDGETS);
    expect(sameLayout(layout, defaultLayout(WIDGETS))).toBe(true);
    expect(sameLayout(layout, layoutReducer(layout, { type: "resize", widgetId: "radar", size: "large" }))).toBe(false);
    expect(sameLayout(layout, layoutReducer(layout, { type: "move", widgetId: "notes", overId: "radar" }))).toBe(false);
    expect(sameLayout(layout, layout.slice(1))).toBe(false);
  });
});

describe("layoutReducer", () => {
  const layout = defaultLayout(WIDGETS);

  it("moves a widget to another widget's position, both directions", () => {
    expect(ids(layoutReducer(layout, { type: "move", widgetId: "core", overId: "notes" }))).toEqual([
      "radar",
      "notes",
      "core",
    ]);
    expect(ids(layoutReducer(layout, { type: "move", widgetId: "notes", overId: "core" }))).toEqual([
      "notes",
      "core",
      "radar",
    ]);
  });

  it("ignores moves onto itself or unknown widgets", () => {
    expect(layoutReducer(layout, { type: "move", widgetId: "core", overId: "core" })).toEqual(layout);
    expect(layoutReducer(layout, { type: "move", widgetId: "nope", overId: "core" })).toEqual(layout);
  });

  it("adds a widget at the end, once", () => {
    const added = layoutReducer(layout, { type: "add", widgetId: "extra", size: "large" });
    expect(added.at(-1)).toEqual({ widgetId: "extra", size: "large" });
    expect(layoutReducer(added, { type: "add", widgetId: "extra", size: "small" })).toEqual(added);
  });

  it("removes a widget", () => {
    expect(ids(layoutReducer(layout, { type: "remove", widgetId: "radar" }))).toEqual(["core", "notes"]);
  });

  it("resizes a widget", () => {
    const resized = layoutReducer(layout, { type: "resize", widgetId: "notes", size: "small" });
    expect(resized.find((placement) => placement.widgetId === "notes")?.size).toBe("small");
    expect(resized.find((placement) => placement.widgetId === "radar")?.size).toBe("medium");
  });

  it("replaces the whole layout (reset)", () => {
    const edited = layoutReducer(layout, { type: "remove", widgetId: "radar" });
    expect(layoutReducer(edited, { type: "replace", layout })).toEqual(layout);
  });

  it("never mutates the input", () => {
    const frozen = Object.freeze(layout.map((placement) => Object.freeze({ ...placement })));
    expect(() => {
      layoutReducer(frozen, { type: "move", widgetId: "core", overId: "notes" });
      layoutReducer(frozen, { type: "resize", widgetId: "core", size: "large" });
      layoutReducer(frozen, { type: "remove", widgetId: "core" });
      layoutReducer(frozen, { type: "add", widgetId: "extra", size: "small" });
    }).not.toThrow();
    expect(frozen).toEqual(layout);
  });
});
