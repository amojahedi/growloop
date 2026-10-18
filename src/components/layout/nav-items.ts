import { KanbanIcon, LayoutDashboardIcon, LibraryIcon, SettingsIcon, TargetIcon, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: "/" | "/board" | "/library" | "/okrs" | "/settings";
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/board", label: "Board", icon: KanbanIcon },
  { href: "/library", label: "Library", icon: LibraryIcon },
  { href: "/okrs", label: "OKRs", icon: TargetIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

/** Whether a nav item is the current section (nested routes count, e.g. /okrs/plan). */
export function isActive(href: NavItem["href"], pathname: string | null): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
