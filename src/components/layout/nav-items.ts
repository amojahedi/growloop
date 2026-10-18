import {
  KanbanIcon,
  LayoutDashboardIcon,
  LibraryIcon,
  NotebookPenIcon,
  SettingsIcon,
  TargetIcon,
  type LucideIcon,
} from "lucide-react";

/** Navigation (navigation-and-empty-states.md §Navigation, NAV-1). */

export type NavHref = "/" | "/board" | "/library" | "/notebook" | "/okrs" | "/settings";

export interface NavItem {
  href: NavHref;
  label: string;
  icon: LucideIcon;
}

/** Ordered by use: the month first, then where things come from and go to, then the year. */
export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/board", label: "Board", icon: KanbanIcon },
  { href: "/library", label: "Library", icon: LibraryIcon },
  { href: "/notebook", label: "Notebook", icon: NotebookPenIcon },
  { href: "/okrs", label: "OKRs", icon: TargetIcon },
];

/** Sits at the bottom of the sidebar, above the footer. */
export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: SettingsIcon };

/** The tour anchor of a nav item (help-and-guide.md): `nav-<label lowercased>`. */
export const navTourId = (item: NavItem): string => `nav-${item.label.toLowerCase()}`;

/** Whether a nav item is the current section (nested routes count, e.g. /okrs/plan). */
export function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

const OTHER_PAGES: readonly { href: string; title: string }[] = [{ href: "/guide", title: "Guide" }];

/**
 * The page title for the breadcrumb ("Growloop / {Page}"): the section only,
 * no deeper levels. Unknown routes are the not-found page.
 */
export function pageTitle(pathname: string | null): string | null {
  if (pathname === null) return null;
  const pages = [...NAV_ITEMS, SETTINGS_ITEM].map(({ href, label }) => ({ href, title: label }));
  const match = [...pages, ...OTHER_PAGES].find(({ href }) => isActive(href, pathname));
  return match?.title ?? "Not found";
}
