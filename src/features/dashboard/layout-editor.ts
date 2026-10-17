"use client";

import { useMemo } from "react";
import { create } from "zustand";
import { layoutReducer, resolveLayout, type LayoutAction } from "@/lib/domain/dashboard-layout";
import type { WidgetPlacement } from "@/lib/domain/types";
import { useSavedDashboardLayout } from "@/lib/store/hooks";
import { WIDGETS } from "./widget-registry";

/**
 * Edit mode for the dashboard. Edits go to a session-only draft, so Cancel can
 * drop them; Done saves the draft to the workspace.
 */
interface LayoutEditorState {
  /** `null` when not editing. */
  draft: WidgetPlacement[] | null;
  start: (layout: readonly WidgetPlacement[]) => void;
  dispatch: (action: LayoutAction) => void;
  stop: () => void;
}

export const useLayoutEditor = create<LayoutEditorState>()((set) => ({
  draft: null,
  start: (layout) => set({ draft: layoutReducer([], { type: "replace", layout }) }),
  dispatch: (action) => set((state) => (state.draft ? { draft: layoutReducer(state.draft, action) } : state)),
  stop: () => set({ draft: null }),
}));

export interface DashboardLayoutState {
  /** What to render: the draft while editing, else the saved layout. */
  layout: WidgetPlacement[];
  saved: WidgetPlacement[];
  editing: boolean;
}

export function useDashboardLayout(): DashboardLayoutState {
  const stored = useSavedDashboardLayout();
  const draft = useLayoutEditor((state) => state.draft);
  const saved = useMemo(() => resolveLayout(stored, WIDGETS), [stored]);
  return { layout: draft ?? saved, saved, editing: draft !== null };
}
