"use client";

import { createContext, use, useEffect, useMemo, useSyncExternalStore, type FocusEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { addMonths, dayKey, monthOf, quarterOf, type DayKey } from "@/lib/domain/dates";
import type { ID, Material, MonthKey, QuarterKey, Skill } from "@/lib/domain/types";
import { useAppStore, type AppActions, type AppState } from "./app-store";
import { useUIStore, type SkillPreview } from "./ui-store";

// --- Data selectors -------------------------------------------------------------

export const useAppData = () => useAppStore((state) => state.data);
export const usePlanItems = () => useAppStore((state) => state.data.planItems);
export const useObjectives = () => useAppStore((state) => state.data.objectives);
export const useActivity = () => useAppStore((state) => state.data.activity);
/** The saved dashboard layout, or `null` for the default one. */
export const useSavedDashboardLayout = () => useAppStore((state) => state.data.dashboardLayout);

/** Skills in display order; hidden skills are excluded unless requested. */
export function useSkills({ includeHidden = false }: { includeHidden?: boolean } = {}): Skill[] {
  const skills = useAppStore((state) => state.data.skills);
  return useMemo(() => (includeHidden ? skills : skills.filter((skill) => !skill.hidden)), [skills, includeHidden]);
}

export function useSkill(id: ID): Skill | undefined {
  return useAppStore((state) => state.data.skills.find((skill) => skill.id === id));
}

/** Curated library plus the user's own materials. */
export function useMaterials(): Material[] {
  const custom = useAppStore((state) => state.data.customMaterials);
  return useMemo(() => [...CURATED_MATERIALS, ...custom], [custom]);
}

const NO_IDS: ID[] = [];

/** Curated materials saved to My Library (ML-1). */
export const useSavedMaterialIds = (): ID[] => useAppStore((state) => state.data.savedMaterialIds ?? NO_IDS);

/** Everything in My Library: saved curated materials plus the user's own. */
export function useLibraryIds(): ReadonlySet<ID> {
  const saved = useSavedMaterialIds();
  const custom = useAppStore((state) => state.data.customMaterials);
  return useMemo(() => new Set([...saved, ...custom.map((material) => material.id)]), [saved, custom]);
}

export function useMaterialMap(): ReadonlyMap<ID, Material> {
  const materials = useMaterials();
  return useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials]);
}

// --- Actions ----------------------------------------------------------------------

const pickActions = ({ data: _data, ...actions }: AppState): AppActions => actions;

/** All store actions. References are stable, so this never triggers re-renders. */
export const useActions = (): AppActions => useAppStore(useShallow(pickActions));

// --- Today & month navigation -----------------------------------------------------

const subscribeToClock = (onChange: () => void) => {
  const timer = setInterval(onChange, 60_000);
  return () => clearInterval(timer);
};

/**
 * Today's local date, refreshed every minute so the app rolls over at midnight.
 * `null` on the server and during hydration, where "today" is unknown.
 */
export function useClockDay(): DayKey | null {
  return useSyncExternalStore(
    subscribeToClock,
    () => dayKey(new Date()),
    () => null,
  );
}

/** Provided by `<DataGate>` once the client knows today's date. */
export const TodayContext = createContext<DayKey | null>(null);

/** Today's local date. Only available inside `<DataGate>`. */
export function useToday(): DayKey {
  const today = use(TodayContext);
  if (!today) throw new Error("useToday() must be used inside <DataGate>.");
  return today;
}

export interface MonthNavigation {
  month: MonthKey;
  quarter: QuarterKey;
  currentMonth: MonthKey;
  isCurrentMonth: boolean;
  setMonth: (month: MonthKey) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
}

/** The month the user is viewing (defaults to the current one). Only available inside `<DataGate>`. */
export function useMonthNavigation(): MonthNavigation {
  const currentMonth = monthOf(useToday());
  const selectedMonth = useUIStore((state) => state.selectedMonth);
  const setSelectedMonth = useUIStore((state) => state.setSelectedMonth);
  const month = selectedMonth ?? currentMonth;

  return useMemo(() => {
    // Storing `null` for the current month keeps following the calendar across midnight.
    const setMonth = (next: MonthKey) => setSelectedMonth(next === currentMonth ? null : next);
    return {
      month,
      quarter: quarterOf(month),
      currentMonth,
      isCurrentMonth: month === currentMonth,
      setMonth,
      goToPreviousMonth: () => setMonth(addMonths(month, -1)),
      goToNextMonth: () => setMonth(addMonths(month, 1)),
      goToCurrentMonth: () => setSelectedMonth(null),
    };
  }, [month, currentMonth, setSelectedMonth]);
}

// --- Skill impact preview ----------------------------------------------------------

/** The item currently previewed on skill radars, if any. */
export const useSkillPreview = () => useUIStore((state) => state.skillPreview);

/**
 * Event handlers that preview an item's skill impact while it is hovered or
 * focused. Spread them on the item's outermost element. While `paused` (e.g.
 * during a drag) nothing is previewed and the item's own preview is cleared.
 */
export function useSkillPreviewTrigger(preview: SkillPreview, { paused = false }: { paused?: boolean } = {}) {
  const showSkillPreview = useUIStore((state) => state.showSkillPreview);
  const hideSkillPreview = useUIStore((state) => state.hideSkillPreview);
  const { id } = preview;

  // A removed or moved-away item must not leave its preview behind.
  useEffect(() => () => hideSkillPreview(id), [id, hideSkillPreview]);
  useEffect(() => {
    if (paused) hideSkillPreview(id);
  }, [paused, id, hideSkillPreview]);

  const show = () => {
    if (!paused) showSkillPreview(preview);
  };
  const hide = () => hideSkillPreview(id);
  return {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    // Moving focus between controls inside the item keeps the preview.
    onBlur: (event: FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) hide();
    },
  };
}
