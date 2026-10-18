import { create } from "zustand";
import { now } from "@/lib/clock";
import type { TourStep } from "@/content/help/tour";
import { readDevicePreferences, updateDevicePreferences, type DevicePreferences } from "@/lib/store/device";

/**
 * The guided tour's session state (help-and-guide.md §Guided tour). "pending"
 * means it was asked for and starts once the Dashboard shows its targets;
 * "running" means it is on screen. Whether it was seen or finished is a device
 * preference (ADR 009).
 *
 * Where a request came from matters: a Help request takes the user to the
 * Dashboard; an automatic one ("auto", the first visit) never navigates and
 * gives way as soon as the user goes anywhere else.
 */

export type TourStatus = "idle" | "pending" | "running";
export type TourOrigin = "auto" | "help";

interface TourState {
  status: TourStatus;
  origin: TourOrigin | null;
  /**
   * Set while the user is on their way off the Dashboard (a link was followed,
   * or the first-launch screen sent them to the wizard): no automatic start
   * until the page actually changes.
   */
  autoStartHeld: boolean;
}

export const useTourStore = create<TourState>(() => ({ status: "idle", origin: null, autoStartHeld: false }));

/** Asks for the tour; the tour host starts it on the Dashboard. */
export function requestTour(origin: TourOrigin = "help"): void {
  const { status, autoStartHeld } = useTourStore.getState();
  if (status !== "idle" || (origin === "auto" && autoStartHeld)) return;
  useTourStore.setState({ status: "pending", origin });
}

/** Holds automatic starts until the page changes (the user is leaving the Dashboard). */
export function holdAutoStart(): void {
  const { status, origin } = useTourStore.getState();
  useTourStore.setState({ autoStartHeld: true, ...(status === "pending" && origin === "auto" ? { status: "idle", origin: null } : {}) });
}

export function releaseAutoStart(): void {
  if (useTourStore.getState().autoStartHeld) useTourStore.setState({ autoStartHeld: false });
}

/** The tour is on screen: from now on it never starts by itself again. */
export function beginTour(): void {
  useTourStore.setState({ status: "running" });
  if (!readDevicePreferences().tourSeenAt) updateDevicePreferences({ tourSeenAt: now().toISOString() });
}

/** Finished (Done) or skipped (Skip tour, Esc): both count as completed. */
export function completeTour(): void {
  useTourStore.setState({ status: "idle", origin: null });
  const at = now().toISOString();
  updateDevicePreferences({ tourCompletedAt: at, tourSeenAt: readDevicePreferences().tourSeenAt ?? at });
}

/** The tour was asked for but had nothing to show, or the user left before it started. */
export function cancelTour(): void {
  useTourStore.setState({ status: "idle", origin: null });
}

/** The live element for a step: its target, or the fallback when the target isn't on screen. */
export function locateStep(step: TourStep, root: ParentNode = document): HTMLElement | null {
  return findTourTarget(step.target, root) ?? (step.fallbackTarget ? findTourTarget(step.fallbackTarget, root) : null);
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
    const element = locateStep(step, root);
    return element ? [{ step, element }] : [];
  });
}
