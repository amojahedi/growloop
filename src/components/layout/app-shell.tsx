import { SproutIcon } from "lucide-react";
import Link from "next/link";
import { BackupBanner } from "@/components/app/backup-banner";
import { SkillSheet } from "@/features/skills/skill-sheet";
import { MonthSwitcher } from "./month-switcher";
import { SidebarNav } from "./sidebar-nav";
import { ThemeToggle } from "./theme-toggle";

/** Page frame: sidebar navigation, a header with global controls, and the page content. */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col md:flex-row">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow-md"
      >
        Skip to content
      </a>
      <aside className="border-b bg-sidebar p-4 md:w-56 md:shrink-0 md:border-r md:border-b-0">
        <Link href="/" className="mb-6 flex items-center gap-2 px-3 text-lg font-semibold">
          <SproutIcon className="size-5" aria-hidden />
          Growloop
        </Link>
        <SidebarNav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <BackupBanner />
        <header className="flex items-center justify-between gap-2 border-b px-4 py-2 md:px-6">
          <MonthSwitcher />
          <ThemeToggle />
        </header>
        <main id="content" tabIndex={-1} className="flex-1 p-4 outline-none md:p-6">
          {children}
        </main>
      </div>
      {/* One skill sheet for the whole app, opened with openSkillSheet(skillId). */}
      <SkillSheet />
    </div>
  );
}
