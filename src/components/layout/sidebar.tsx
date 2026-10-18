"use client";

import { SproutIcon } from "lucide-react";
import Link from "next/link";
import { SETTINGS_ITEM } from "./nav-items";
import { SidebarFooter } from "./sidebar-footer";
import { SidebarLink, SidebarNav } from "./sidebar-nav";
import { SidebarObjectives } from "./sidebar-objectives";

/** The wordmark: sprout + "Growloop", linking to the Dashboard. */
export function Brand({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      href="/"
      onClick={onNavigate}
      className="flex min-h-9 items-center gap-2.5 rounded-lg px-2 font-display text-[19px] font-semibold tracking-tight"
    >
      <SproutIcon className="size-[22px] text-brand" aria-hidden />
      Growloop
    </Link>
  );
}

/**
 * Everything in the sidebar (navigation-and-empty-states.md §App shell): nav,
 * this quarter's objectives, Settings and the footer. Rendered in the desktop
 * sidebar and in the mobile menu sheet; `onNavigate` closes the sheet.
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex min-h-full flex-col gap-6">
      <Brand onNavigate={onNavigate} />
      <SidebarNav onNavigate={onNavigate} />
      <SidebarObjectives onNavigate={onNavigate} />
      <div className="mt-auto flex flex-col gap-3">
        <SidebarLink item={SETTINGS_ITEM} onNavigate={onNavigate} />
        <SidebarFooter onNavigate={onNavigate} />
      </div>
    </div>
  );
}
