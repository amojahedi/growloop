import { create } from "zustand";
import { now } from "@/lib/clock";
import type { TourStep } from "@/content/help/tour";
import { readDevicePreferences, updateDevicePreferences, type DevicePreferences } from "@/lib/store/device";

/**
 * The guided tour's session state (help-and-guide.md §Guided tour). "pending"
 * means it was asked for (from Help, or automatically on the first visit) and
 * starts once the Dashboard shows its targets; "running" means it is on screen.
 * Whether it was seen or finished is a device preference (ADR 009).
 */

export type TourStatus = "idle" | "pending" | "running";

export const useTourStore = create<{ status: TourStatus }>(() => ({ status: "idle" }));

/** Asks for the tour; the tour host starts it on the Dashboard. */
export function requestTour(): void {
  if (useTourStore.getState().status === "idle") useTourStore.setState({ status: "pending" });
}

/** The tour is on screen: from now on it never starts by itself again. */
export function beginTour(): void {
  useTourStore.setState({ status: "running" });
  if (!readDevicePreferences().tourSeenAt) updateDevicePreferences({ tourSeenAt: now().toISOString() });
}

/** Finished (Done) or skipped (Skip tour, Esc): both count as completed. */
export function completeTour(): void {
  useTourStore.setState({ status: "idle" });
  const at = now().toISOString();
  updateDevicePreferences({ tourCompletedAt: at, tourSeenAt: readDevicePreferences().tourSeenAt ?? at });
}

/** The tour was asked for but had nothing to show (no target appeared). */
export function cancelTour(): void {
  useTourStore.setState({ status: "idle" });
}

/**
 * The tour starts by itself once per device (onboarding.md §Tour on first
 * visit, H-3): on the Dashboard, after the first-launch choice, if it was
 * never shown. Never on other pages, so never during the wizard.
 */
export function shouldAutoStartTour(prefs: DevicePreferences | null, pathname: string | null): boolean {
  return prefs !== null && pathname === "/" && prefs.welcomeDoneAt !== undefined && prefs.tourSeenAt === undefined;
}

/** Whether an element is laid out on screen (not display: none, not in a closed sheet). */
export function isVisible(element: Element): boolean {
  if (element.getClientRects().length === 0) return false;
  const { width, height } = element.getBoundingClientRect();
  return width > 0 || height > 0;
}

/** The first visible element carrying `data-tour="<name>"`. */
export function findTourTarget(name: string, root: ParentNode = document): HTMLElement | null {
  const candidates = root.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`);
  return [...candidates].find(isVisible) ?? null;
}

export interface ResolvedStep {
  step: TourStep;
  element: HTMLElement;
}

/** The steps that can be shown right now, each with its element; missing targets are skipped. */
export function resolveTourSteps(steps: readonly TourStep[], root: ParentNode = document): ResolvedStep[] {
  return steps.flatMap((step) => {
    const element = findTourTarget(step.target, root) ?? (step.fallbackTarget ? findTourTarget(step.fallbackTarget, root) : null);
    return element ? [{ step, element }] : [];
  });
}
