"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { isInsideToaster } from "@/components/ui/toast";
import { TOUR_STEPS } from "@/content/help/tour";
import { useDevicePreferences } from "@/lib/store/device";
import { useStoreHydrated } from "@/lib/store/hydration";
import {
  beginTour,
  cancelTour,
  completeTour,
  requestTour,
  resolveTourSteps,
  shouldAutoStartTour,
  useTourStore,
  type ResolvedStep,
} from "./tour-store";

/**
 * The guided tour (help-and-guide.md §Guided tour, H-2, H-3). Mounted once in
 * the app shell. It runs on the Dashboard only, spotlighting widgets and nav
 * items; asked for from another page, it goes to the Dashboard first. It
 * starts by itself once per device, right after the first-launch choice.
 */
export function GuidedTour() {
  // The pathname is unknown while prerendering dynamic routes.
  return (
    <Suspense fallback={null}>
      <TourHost />
    </Suspense>
  );
}

/** Time for the Dashboard to render and for a closing dialog or menu to hand focus back. */
export const TOUR_START_DELAY_MS = 250;

function TourHost() {
  const status = useTourStore((state) => state.status);
  const pathname = usePathname();
  const router = useRouter();
  const prefs = useDevicePreferences();
  const hydrated = useStoreHydrated();
  const [steps, setSteps] = useState<ResolvedStep[]>([]);

  useEffect(() => {
    if (hydrated && status === "idle" && shouldAutoStartTour(prefs, pathname)) requestTour();
  }, [hydrated, status, prefs, pathname]);

  useEffect(() => {
    if (status !== "pending") return;
    if (pathname !== "/") {
      router.push("/");
      return;
    }
    if (!hydrated) return;
    const timer = setTimeout(() => {
      const resolved = resolveTourSteps(TOUR_STEPS);
      if (resolved.length === 0) return cancelTour();
      setSteps(resolved);
      beginTour();
    }, TOUR_START_DELAY_MS);
    return () => clearTimeout(timer);
  }, [status, pathname, hydrated, router]);

  // Leaving the Dashboard (e.g. browser Back) ends the tour; it was seen, so it won't start by itself again.
  useEffect(() => {
    if (status === "running" && pathname !== "/") cancelTour();
  }, [status, pathname]);

  if (status !== "running" || steps.length === 0) return null;
  return createPortal(<TourOverlay initialSteps={steps} onClose={completeTour} />, document.body);
}

// --- Placement -------------------------------------------------------------------------

const GAP = 12;
const GUTTER = 16;
/** Breathing room between the target and the spotlight's edge. */
export const SPOTLIGHT_PADDING = 6;

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Where the popover goes: below the target if it fits, else above, else to
 * the right or left, else pinned to the bottom; always inside the viewport
 * with a 16 px gutter. Without a target it is centered. Pure, for tests.
 */
export function placePopover(
  target: Box | null,
  popover: { width: number; height: number },
  viewport: { width: number; height: number },
): { top: number; left: number } {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(value, Math.max(min, max)));
  const maxLeft = viewport.width - popover.width - GUTTER;
  const maxTop = viewport.height - popover.height - GUTTER;
  if (!target) return { top: clamp((viewport.height - popover.height) / 2, GUTTER, maxTop), left: clamp((viewport.width - popover.width) / 2, GUTTER, maxLeft) };

  const edge = SPOTLIGHT_PADDING + GAP;
  const below = target.top + target.height + edge;
  const above = target.top - edge - popover.height;
  const alignedLeft = clamp(target.left, GUTTER, maxLeft);
  if (below + popover.height <= viewport.height - GUTTER) return { top: below, left: alignedLeft };
  if (above >= GUTTER) return { top: above, left: alignedLeft };

  const alignedTop = clamp(target.top, GUTTER, maxTop);
  const right = target.left + target.width + edge;
  if (right + popover.width <= viewport.width - GUTTER) return { top: alignedTop, left: right };
  const left = target.left - edge - popover.width;
  if (left >= GUTTER) return { top: alignedTop, left };
  return { top: clamp(maxTop, GUTTER, maxTop), left: alignedLeft };
}

// --- Overlay ---------------------------------------------------------------------------

const subscribeToMotion = (onChange: () => void) => {
  const query = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
};
const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

function inViewport(element: Element): boolean {
  const { top, bottom } = element.getBoundingClientRect();
  return top >= 0 && bottom <= window.innerHeight;
}

const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function TourOverlay({ initialSteps, onClose }: { initialSteps: ResolvedStep[]; onClose: () => void }) {
  const [{ steps, index }, setTour] = useState({ steps: initialSteps, index: 0 });
  const current = steps[Math.min(index, steps.length - 1)];
  const isLast = index >= steps.length - 1;
  const [rect, setRect] = useState<Box | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const reducedMotion = useSyncExternalStore(subscribeToMotion, prefersReducedMotion, () => true);

  // Focus moves into the popover, stays there, and goes back to where it was when the tour ends.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    primaryRef.current?.focus();
    // Focus taken elsewhere (e.g. a closing dialog handing focus back late) comes back to the popover.
    const onFocusIn = (event: FocusEvent) => {
      const popover = popoverRef.current;
      if (popover && event.target instanceof Node && !popover.contains(event.target) && !isInsideToaster(event.target)) {
        primaryRef.current?.focus();
      }
    };
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("focusin", onFocusIn);
      const fallback = document.querySelector<HTMLElement>('[data-tour="help"]') ?? document.getElementById("content");
      const target = previous && previous !== document.body && previous.isConnected ? previous : fallback;
      target?.focus();
    };
  }, []);

  // Follow the target: scroll it into view, track its box through scrolling and resizing.
  useLayoutEffect(() => {
    const element = current.element;
    if (!inViewport(element)) element.scrollIntoView({ block: "center", inline: "nearest", behavior: reducedMotion ? "auto" : "smooth" });
    let frame = 0;
    const measure = () => {
      const { top, left, width, height } = element.getBoundingClientRect();
      setRect({ top, left, width, height });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("resize", schedule);
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    observer?.observe(element);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("resize", schedule);
      observer?.disconnect();
    };
  }, [current.element, reducedMotion]);

  // Targets can appear or disappear when the window is resized (the sidebar becomes the menu button).
  useEffect(() => {
    const onResize = () => {
      const next = resolveTourSteps(TOUR_STEPS);
      if (next.length === 0) return onClose();
      setTour((previous) => {
        const shown = previous.steps[Math.min(previous.index, previous.steps.length - 1)]?.step;
        const at = next.findIndex(({ step }) => step === shown);
        return { steps: next, index: at >= 0 ? at : Math.min(previous.index, next.length - 1) };
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [onClose]);

  // Place the popover once its size is known.
  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!popover) return;
    const { width, height } = popover.getBoundingClientRect();
    setPosition(placePopover(rect, { width, height }, { width: window.innerWidth, height: window.innerHeight }));
  }, [rect, index]);

  // The highlighted element is described by the step's text.
  useEffect(() => {
    const element = current.element;
    const previous = element.getAttribute("aria-describedby");
    element.setAttribute("aria-describedby", previous ? `${previous} ${bodyId}` : bodyId);
    return () => {
      if (previous === null) element.removeAttribute("aria-describedby");
      else element.setAttribute("aria-describedby", previous);
    };
  }, [current.element, bodyId]);

  // Esc skips; Tab stays inside the popover.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !popoverRef.current) return;
      const focusable = [...popoverRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const inside = popoverRef.current.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [onClose]);

  const go = useCallback(
    (delta: number) => {
      const next = index + delta;
      if (next >= steps.length) return onClose();
      setTour((previous) => ({ ...previous, index: Math.max(0, next) }));
      // Back disappears on the first step: keep focus on the popover's main button.
      if (next <= 0) primaryRef.current?.focus();
    },
    [index, steps.length, onClose],
  );

  const transition = reducedMotion ? "" : "transition-[top,left,width,height] duration-200 ease-out";
  const spotlight = rect && {
    top: rect.top - SPOTLIGHT_PADDING,
    left: rect.left - SPOTLIGHT_PADDING,
    width: rect.width + SPOTLIGHT_PADDING * 2,
    height: rect.height + SPOTLIGHT_PADDING * 2,
  };

  return (
    <div className="fixed inset-0 z-[70]" data-tour-overlay>
      {/* Blocks the page while the tour runs; the scrim itself is the spotlight's shadow. */}
      <div className="absolute inset-0" aria-hidden />
      <div
        aria-hidden
        className={`pointer-events-none absolute rounded-xl outline-2 outline-brand ${transition}`}
        style={{
          ...(spotlight ?? { top: "50%", left: "50%", width: 0, height: 0 }),
          boxShadow: "0 0 0 9999px color-mix(in oklab, var(--background) 72%, transparent)",
        }}
      />
      <div
        ref={popoverRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className={`absolute flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-3 rounded-2xl bg-popover p-5 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10 ${transition}`}
        // Transparent (not hidden) until placed, so it can take focus on the first render.
        style={position ?? { top: GUTTER, left: GUTTER, opacity: 0 }}
      >
        <p className="text-xs font-semibold text-muted-foreground tabular-nums">
          {index + 1} of {steps.length}
        </p>
        <h2 id={titleId} className="font-display text-lg leading-snug font-semibold">
          {current.step.title}
        </h2>
        <p id={bodyId} className="text-muted-foreground">
          {current.step.body}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" className="-ml-2.5 text-muted-foreground" onClick={onClose}>
            Skip tour
          </Button>
          <span className="flex-1" />
          {index > 0 && (
            <Button variant="outline" size="sm" onClick={() => go(-1)}>
              Back
            </Button>
          )}
          <Button ref={primaryRef} size="sm" onClick={() => go(1)}>
            {isLast ? "Done" : "Next"}
          </Button>
        </div>
        {/* Announces each new step; the dialog's own label and description cover the first. */}
        <p className="sr-only" aria-live="polite">
          {index > 0 ? `${current.step.title}. ${current.step.body} ${index + 1} of ${steps.length}.` : ""}
        </p>
      </div>
    </div>
  );
}
