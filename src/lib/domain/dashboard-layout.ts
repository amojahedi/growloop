import type { WidgetPlacement, WidgetSize } from "./types";

/**
 * Pure logic behind the customizable dashboard (D-8). A layout is the ordered
 * list of visible widgets with their sizes; anything not listed is hidden.
 * Widget definitions live in the UI registry, which passes in what this
 * module needs to know about them.
 */

export type DashboardLayout = readonly WidgetPlacement[];

export interface WidgetMeta {
  id: string;
  defaultSize: WidgetSize;
  /** Locked widgets can be moved and resized but never removed. */
  locked?: boolean;
  /** Left out of the default layout, but available in the widget gallery. */
  hiddenByDefault?: boolean;
}

/** Grid columns each size spans on the 3-column desktop grid. */
export const WIDGET_COLUMNS: Readonly<Record<WidgetSize, 1 | 2 | 3>> = { small: 1, medium: 2, large: 3 };

export function defaultLayout(widgets: readonly WidgetMeta[]): WidgetPlacement[] {
  return widgets
    .filter((widget) => !widget.hiddenByDefault)
    .map((widget) => ({ widgetId: widget.id, size: widget.defaultSize }));
}

/**
 * The layout to render from what is stored: the default when nothing is saved,
 * otherwise the saved layout without unknown or duplicate widgets, and with any
 * missing locked widget put back in front.
 */
export function resolveLayout(stored: DashboardLayout | null, widgets: readonly WidgetMeta[]): WidgetPlacement[] {
  if (stored === null) return defaultLayout(widgets);

  const known = new Map(widgets.map((widget) => [widget.id, widget]));
  const seen = new Set<string>();
  const placements = stored.filter(({ widgetId }) => {
    if (!known.has(widgetId) || seen.has(widgetId)) return false;
    seen.add(widgetId);
    return true;
  });
  const missingLocked = widgets
    .filter((widget) => widget.locked && !seen.has(widget.id))
    .map((widget) => ({ widgetId: widget.id, size: widget.defaultSize }));

  return [...missingLocked, ...placements.map((placement) => ({ ...placement }))];
}

/** Widgets not on the dashboard, in registry order (the "Add widget" gallery). */
export function hiddenWidgets<T extends WidgetMeta>(layout: DashboardLayout, widgets: readonly T[]): T[] {
  const visible = new Set(layout.map((placement) => placement.widgetId));
  return widgets.filter((widget) => !visible.has(widget.id));
}

export function sameLayout(a: DashboardLayout, b: DashboardLayout): boolean {
  return (
    a.length === b.length &&
    a.every((placement, index) => placement.widgetId === b[index].widgetId && placement.size === b[index].size)
  );
}

export type LayoutAction =
  /** Moves a widget to the position of another (drag and drop). */
  | { type: "move"; widgetId: string; overId: string }
  /** Shows a hidden widget at the end of the dashboard. */
  | { type: "add"; widgetId: string; size: WidgetSize }
  | { type: "remove"; widgetId: string }
  | { type: "resize"; widgetId: string; size: WidgetSize }
  | { type: "replace"; layout: DashboardLayout };

export function layoutReducer(layout: DashboardLayout, action: LayoutAction): WidgetPlacement[] {
  const index = (widgetId: string) => layout.findIndex((placement) => placement.widgetId === widgetId);

  switch (action.type) {
    case "move": {
      const from = index(action.widgetId);
      const to = index(action.overId);
      if (from === -1 || to === -1 || from === to) return [...layout];
      const next = [...layout];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    }
    case "add":
      if (index(action.widgetId) !== -1) return [...layout];
      return [...layout, { widgetId: action.widgetId, size: action.size }];
    case "remove":
      return layout.filter((placement) => placement.widgetId !== action.widgetId);
    case "resize":
      return layout.map((placement) =>
        placement.widgetId === action.widgetId ? { ...placement, size: action.size } : placement,
      );
    case "replace":
      return action.layout.map((placement) => ({ ...placement }));
  }
}
