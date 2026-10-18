"use client";

import { BookOpenIcon, CircleHelpIcon, CompassIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { requestTour } from "@/features/help/tour-store";
import { useAIStatus } from "@/lib/ai/status";

/**
 * Help in the top bar on every page (help-and-guide.md §Help button, H-1):
 * the tour, the guide, and "Turn on Claude" while Claude is off.
 */
export function HelpMenu() {
  const { provider, checking } = useAIStatus();
  const claudeOff = provider === null && !checking;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="group/help relative rounded-full" aria-label="Help" data-tour="help">
          <CircleHelpIcon className="size-[18px]" />
          {/* Visible tooltip on hover and keyboard focus; the button's name says the same. */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-full right-0 z-40 mt-1.5 rounded-md bg-foreground px-2 py-1 text-xs font-medium text-background opacity-0 shadow-sm group-hover/help:opacity-100 group-focus-visible/help:opacity-100 group-aria-expanded/help:hidden motion-safe:transition-opacity"
          >
            Help
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuItem onSelect={requestTour}>
          <CompassIcon aria-hidden />
          Take the tour
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/guide">
            <BookOpenIcon aria-hidden />
            How Growloop works
          </Link>
        </DropdownMenuItem>
        {claudeOff && (
          <DropdownMenuItem asChild>
            <Link href="/settings#claude">
              <SparklesIcon aria-hidden />
              Turn on Claude
            </Link>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
