"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { dismissToast, toast } from "@/components/ui/toast";
import { useSampleMode } from "@/lib/store/device";
import { useActions } from "@/lib/store/hooks";

/** The action's label: "Back to my data" when the own workspace has something, "Start fresh" otherwise. */
export const exitSampleLabel = (ownHasData: boolean) => (ownHasData ? "Back to my data" : "Start fresh");

/**
 * The "Exit sample" banner (sample-data.md §The banner, H-7): a slim band at
 * the top of the content column on every page while sample mode is on. Not
 * dismissible. Leaving deletes the sample, loads the own workspace and goes
 * to the Dashboard.
 */
export function SampleBanner() {
  const sampleMode = useSampleMode();
  if (!sampleMode) return null;
  return <SampleBannerContent />;
}

function SampleBannerContent() {
  const { exitSampleMode, ownWorkspaceHasData } = useActions();
  const router = useRouter();
  // The own workspace can't change while the sample is loaded (every tab follows sample mode).
  const label = useMemo(() => exitSampleLabel(ownWorkspaceHasData()), [ownWorkspaceHasData]);

  const exit = () => {
    // An Undo toast from the sample must never act on the own workspace.
    dismissToast();
    const { ownWorkspaceEmpty } = exitSampleMode();
    toast({ message: ownWorkspaceEmpty ? "Fresh start. It's all yours." : "Back to your own data." });
    router.push("/");
  };

  return (
    <div
      role="region"
      aria-label="Sample data"
      className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-border bg-brand-soft px-4 py-2 text-center text-sm text-brand-soft-foreground md:px-9"
    >
      <p>You&apos;re viewing sample data</p>
      <span aria-hidden>·</span>
      <button
        type="button"
        onClick={exit}
        className="rounded-sm font-semibold underline underline-offset-4 hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-hidden"
      >
        {label}
      </button>
    </div>
  );
}
