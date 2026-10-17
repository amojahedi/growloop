import { KanbanIcon, LayoutDashboardIcon, LibraryIcon, SettingsIcon, ShapesIcon, TargetIcon, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: "/" | "/board" | "/library" | "/skills" | "/okrs" | "/settings";
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/board", label: "Board", icon: KanbanIcon },
  { href: "/library", label: "Library", icon: LibraryIcon },
  { href: "/skills", label: "Skills", icon: ShapesIcon },
  { href: "/okrs", label: "OKRs", icon: TargetIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

/** Whether a nav item is the current section (nested routes count, e.g. /skills/roadmapping). */
export function isActive(href: NavItem["href"], pathname: string | null): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
