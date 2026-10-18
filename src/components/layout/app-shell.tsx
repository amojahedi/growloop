import { SproutIcon } from "lucide-react";
import Link from "next/link";
import { BackupBanner } from "@/components/app/backup-banner";
import { StorageBanner } from "@/components/app/storage-banner";
import { GuidedTour } from "@/features/help/guided-tour";
import { FirstLaunch } from "@/features/onboarding/first-launch";
import { SampleBanner } from "@/features/sample/sample-banner";
import { SkillSheet } from "@/features/skills/skill-sheet";
import { Breadcrumb } from "./breadcrumb";
import { HelpMenu } from "./help-menu";
import { MobileMenu } from "./mobile-menu";
import { SidebarContent } from "./sidebar";
import { ThemeToggle } from "./theme-toggle";
import { UpdateBanner } from "./update-banner";

/**
 * The app frame (navigation-and-empty-states.md §App shell): the sidebar, a top
 * bar with the breadcrumb, Help and the color toggle, the banners, then the
 * page. Below 768 px the sidebar moves into the menu sheet.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[80] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow-md"
      >
        Skip to content
      </a>
      <aside
        aria-label="Sidebar"
        className="sticky top-0 hidden h-svh w-[252px] shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground md:block"
      >
        <SidebarContent />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 bg-background/85 px-4 backdrop-blur-md md:h-[60px] md:gap-4 md:px-9">
          <MobileMenu />
          <Link href="/" aria-label="Growloop, go to your dashboard" className="rounded-md md:hidden">
            <SproutIcon className="size-[22px] text-brand" aria-hidden />
          </Link>
          <Breadcrumb />
          <div className="flex items-center gap-1">
            <HelpMenu />
            <ThemeToggle />
          </div>
        </header>
        <SampleBanner />
        <StorageBanner />
        <UpdateBanner />
        <BackupBanner />
        <main id="content" tabIndex={-1} className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 outline-none md:px-9 md:py-8">
          {children}
        </main>
      </div>
      {/* One skill sheet for the whole app, opened with openSkillSheet(skillId). */}
      <SkillSheet />
      <FirstLaunch />
      <GuidedTour />
    </div>
  );
}
