"use client";

import { useEffect } from "react";
import { DataGate } from "@/components/app/data-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { useStoreHydrated } from "@/lib/store/hydration";
import { SkillsSettings } from "../skills/skills-settings";
import { AppearanceSettings } from "./appearance-settings";
import { ClaudeSettings } from "./claude-settings";
import { DataSettings } from "./data-settings";
import { ProfileSettings } from "./profile-settings";

/** The five sections, in page order, with their anchors (settings-and-ai-keys.md §Page structure, ST-1). */
export const SETTINGS_SECTIONS = ["profile", "skills", "claude", "appearance", "data"] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

/**
 * One calm, scrolling page; everything autosaves. Each section's anchor is
 * rendered on the server, so `/settings#skills` (and the `/skills` redirect)
 * always has a target; sections that read saved data fill in after load.
 */
export function SettingsView() {
  useScrollToHash();

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <Anchor id="profile">
        <DataGate fallback={<SectionSkeleton />}>
          <ProfileSettings />
        </DataGate>
      </Anchor>
      <Anchor id="skills">
        <DataGate fallback={<SectionSkeleton tall />}>
          <SkillsSettings />
        </DataGate>
      </Anchor>
      {/* Independent of workspace data: the key is stored separately. */}
      <Anchor id="claude">
        <ClaudeSettings />
      </Anchor>
      <Anchor id="appearance">
        <AppearanceSettings />
      </Anchor>
      <Anchor id="data">
        <DataGate fallback={<SectionSkeleton />}>
          <DataSettings />
        </DataGate>
      </Anchor>
    </div>
  );
}

function Anchor({ id, children }: { id: SettingsSection; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-6">
      {children}
    </div>
  );
}

function SectionSkeleton({ tall = false }: { tall?: boolean }) {
  return <Skeleton aria-busy="true" aria-label="Loading" className={tall ? "h-96 w-full" : "h-32 w-full"} />;
}

/**
 * The browser jumps to the hash before saved data has filled the sections
 * above it, so the jump lands short. Scroll again once data is loaded, and on
 * later in-page hash changes.
 */
function useScrollToHash() {
  const hydrated = useStoreHydrated();

  useEffect(() => {
    if (!hydrated) return;
    const scroll = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!(SETTINGS_SECTIONS as readonly string[]).includes(id)) return;
      document.getElementById(id)?.scrollIntoView({ block: "start" });
    };
    // After the gated sections have rendered.
    const frame = requestAnimationFrame(scroll);
    window.addEventListener("hashchange", scroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("hashchange", scroll);
    };
  }, [hydrated]);
}
