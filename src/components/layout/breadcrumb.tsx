"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { pageTitle } from "./nav-items";

/**
 * "Growloop / {Page}" in the top bar (the page title only, no deeper levels).
 * Below 768 px only the page title shows, next to the menu button.
 */
export function Breadcrumb() {
  return (
    <Suspense fallback={<Trail title={null} />}>
      <CurrentTrail />
    </Suspense>
  );
}

function CurrentTrail() {
  return <Trail title={pageTitle(usePathname())} />;
}

function Trail({ title }: { title: string | null }) {
  return (
    <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
      <ol className="flex min-w-0 items-center gap-2 text-sm">
        <li className="hidden text-muted-foreground md:block">Growloop</li>
        {title && (
          <li className="flex min-w-0 items-center gap-2 font-semibold">
            <span aria-hidden className="hidden text-input md:inline">
              /
            </span>
            <span aria-current="page" className="truncate">
              {title}
            </span>
          </li>
        )}
      </ol>
    </nav>
  );
}
