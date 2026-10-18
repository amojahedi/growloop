"use client";

import { SproutIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useTourStore } from "@/features/help/tour-store";
import { now } from "@/lib/clock";
import { isEmptyWorkspace } from "@/lib/domain/app-data";
import { updateDevicePreferences, useDevicePreferences, type DevicePreferences } from "@/lib/store/device";
import { useActions, useAppData } from "@/lib/store/hooks";
import { useStoreHydrated } from "@/lib/store/hydration";

/**
 * Whether to show the first-launch screen (onboarding.md, H-6): once per
 * device, when it was never answered and the own workspace is empty, so
 * existing users never see it, without a migration. Never in sample mode.
 * Pure, for tests; `prefs` is null until the device preferences are read.
 */
export function shouldShowFirstLaunch(prefs: DevicePreferences | null, { hydrated, workspaceEmpty }: { hydrated: boolean; workspaceEmpty: boolean }): boolean {
  return hydrated && prefs !== null && prefs.welcomeDoneAt === undefined && prefs.sampleMode !== true && workspaceEmpty;
}

/**
 * One light screen over the dimmed, empty app shell, on whatever page the
 * visitor lands: Set your year · Try sample data · Skip for now. No questions.
 * Every choice sets `welcomeDoneAt`; Esc equals Skip for now. The tour starts
 * on the Dashboard right after (see GuidedTour).
 */
export function FirstLaunch() {
  const prefs = useDevicePreferences();
  const hydrated = useStoreHydrated();
  const data = useAppData();
  const open = shouldShowFirstLaunch(prefs, { hydrated, workspaceEmpty: isEmptyWorkspace(data) });
  // Always mounted, so closing runs the dialog's own focus handling.
  return <FirstLaunchDialog open={open} />;
}

const markWelcomeDone = () => updateDevicePreferences({ welcomeDoneAt: now().toISOString() });

function FirstLaunchDialog({ open }: { open: boolean }) {
  const router = useRouter();
  const { enterSampleMode } = useActions();
  const primary = useRef<HTMLButtonElement>(null);

  const setYear = () => {
    markWelcomeDone();
    router.push("/okrs/plan");
  };
  const trySample = () => {
    markWelcomeDone();
    if (!enterSampleMode()) toast({ message: "Couldn't load the sample. Try again." });
    router.push("/");
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && markWelcomeDone()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background/70 backdrop-blur-[2px] duration-200 data-open:animate-in data-open:fade-in-0 motion-reduce:animate-none" />
        <DialogPrimitive.Content
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100svh-2rem)] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-6 overflow-y-auto rounded-3xl bg-card px-6 py-8 text-center text-card-foreground shadow-lg ring-1 ring-foreground/10 outline-hidden duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 motion-reduce:animate-none sm:px-10 sm:py-10"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            primary.current?.focus();
          }}
          // Returning focus to whatever had it at load (often nothing) would lose it: go to the page instead.
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            // The tour starts right after and takes focus itself.
            if (useTourStore.getState().status === "idle") document.getElementById("content")?.focus();
          }}
          // A choice is needed: clicking the dimmed page doesn't dismiss (Esc still means Skip for now).
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="flex items-center gap-2.5 font-display text-[19px] font-semibold tracking-tight">
            <SproutIcon className="size-[22px] text-brand" aria-hidden />
            Growloop
          </div>
          <div className="flex flex-col gap-2">
            <DialogPrimitive.Title className="font-display text-2xl leading-tight font-semibold tracking-tight text-balance">
              Grow on purpose, a month at a time.
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-sm text-muted-foreground text-pretty">
              Set a few goals for the year, learn a little each month, and keep what sticks.
            </DialogPrimitive.Description>
          </div>
          <div className="flex w-full flex-col items-stretch gap-2.5 sm:max-w-64">
            <Button ref={primary} size="lg" className="h-10 rounded-full" onClick={setYear}>
              Set your year
            </Button>
            <Button variant="outline" size="lg" className="h-10 rounded-full" onClick={trySample}>
              Try sample data
            </Button>
            <DialogPrimitive.Close asChild>
              <Button variant="link" size="sm" className="text-muted-foreground">
                Skip for now
              </Button>
            </DialogPrimitive.Close>
          </div>
          <p className="text-xs text-muted-foreground">No account. Your data stays in this browser.</p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
