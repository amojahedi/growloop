"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { DataGate } from "@/components/app/data-gate";
import { useDueNotes } from "@/lib/store/hooks";
import { cn } from "@/lib/utils";
import { isActive, NAV_ITEMS, navTourId, type NavItem } from "./nav-items";

/**
 * Primary navigation (NAV-1). The active state needs the pathname, which is
 * unknown while prerendering dynamic routes, so the links first render without it.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main">
      <ul className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <li key={item.href}>
            <SidebarLink item={item} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** One sidebar link with its active state; also used for Settings at the bottom. */
export function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavLink item={item} pathname={null} onNavigate={onNavigate} />}>
      <ActiveNavLink item={item} onNavigate={onNavigate} />
    </Suspense>
  );
}

function ActiveNavLink(props: { item: NavItem; onNavigate?: () => void }) {
  return <NavLink {...props} pathname={usePathname()} />;
}

function NavLink({ item, pathname, onNavigate }: { item: NavItem; pathname: string | null; onNavigate?: () => void }) {
  const { href, label, icon: Icon } = item;
  const active = isActive(href, pathname);
  return (
    <Link
      href={href}
      data-tour={navTourId(item)}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "group/nav flex h-[38px] items-center gap-2.5 rounded-xl px-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground motion-reduce:transition-none",
        active && "bg-card text-sidebar-foreground shadow-sm hover:bg-card",
      )}
    >
      <span
        className={cn(
          "grid size-[26px] shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors motion-reduce:transition-none",
          active && "bg-brand-soft text-brand-soft-foreground",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {href === "/notebook" && (
        <DataGate fallback={null}>
          <DueBadge />
        </DataGate>
      )}
    </Link>
  );
}

/** Notes due for review today; hidden at 0. */
function DueBadge() {
  const due = useDueNotes().length;
  if (due === 0) return null;
  return (
    <span className="text-xs font-semibold text-muted-foreground tabular-nums group-aria-[current=page]/nav:text-sidebar-foreground">
      <span aria-hidden>{due}</span>
      <span className="sr-only">, {due === 1 ? "1 note" : `${due} notes`} to review</span>
    </span>
  );
}
