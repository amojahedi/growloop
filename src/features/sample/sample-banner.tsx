"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { toast } from "@/components/ui/toast";
import { STORAGE_KEY } from "@/lib/store/app-store";
import { useSampleMode } from "@/lib/store/device";
import { useActions } from "@/lib/store/hooks";

/**
 * Whether the own workspace (`growloop:data`) holds anything, read straight
 * from storage while the sample is loaded. Anything unreadable counts as
 * data: there is something to go back to. Without storage there is nothing.
 */
export function storedOwnWorkspaceHasData(): boolean {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
  if (raw === null) return false;
  try {
    const data = (JSON.parse(raw) as { state?: { data?: Record<string, unknown> } }).state?.data;
    if (!data || typeof data !== "object") return true;
    return ["objectives", "planItems", "notes", "savedMaterialIds", "customMaterials"].some(
      (key) => Array.isArray(data[key]) && (data[key] as unknown[]).length > 0,
    );
  } catch {
    return true;
  }
}

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
  const { exitSampleMode } = useActions();
  const router = useRouter();
  // The own workspace can't change while the sample is loaded (every tab follows sample mode).
  const label = useMemo(() => exitSampleLabel(storedOwnWorkspaceHasData()), []);

  const exit = () => {
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
