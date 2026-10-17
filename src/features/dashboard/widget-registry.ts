import type { ComponentType } from "react";
import { defaultLayout, type WidgetMeta } from "@/lib/domain/dashboard-layout";
import { ItemsCompletedWidget } from "./items-completed-widget";
import { LearningStreakWidget } from "./learning-streak-widget";
import { OkrProgressWidget } from "./okr-progress-widget";
import { ReflectionsFeed } from "./reflections-feed";
import { RemindersPanel } from "./reminders-panel";
import { SkillRadarWidget } from "./skill-radar-widget";

/**
 * Every dashboard widget (D-8). To add one: build a self-contained component
 * (it reads the store itself) and add an entry here. Registry order is the
 * default layout order and the "Add widget" gallery order. Ids are stored in
 * saved layouts, so never rename one; retire it instead.
 * Hours are deliberately not a widget (ADR 006).
 */

export interface WidgetDefinition extends WidgetMeta {
  title: string;
  /** One line for the "Add widget" gallery. */
  description: string;
  component: ComponentType;
}

export const WIDGETS: readonly WidgetDefinition[] = [
  {
    id: "items-completed",
    title: "Items completed",
    description: "This month's finished items, compared with last month. Always shown.",
    defaultSize: "small",
    // ADR 006: the core metric is always on the dashboard.
    locked: true,
    component: ItemsCompletedWidget,
  },
  {
    id: "okr-progress",
    title: "OKR progress",
    description: "Objectives and key results for the quarter you're viewing.",
    defaultSize: "medium",
    component: OkrProgressWidget,
  },
  {
    id: "skill-radar",
    title: "Skill radar",
    description: "Completed and projected skill impact this month, per skill.",
    defaultSize: "medium",
    component: SkillRadarWidget,
  },
  {
    id: "reminders",
    title: "Upcoming reminders",
    description: "Reminders set on your cards, soonest first.",
    defaultSize: "small",
    component: RemindersPanel,
  },
  {
    id: "learning-streak",
    title: "Learning streak",
    description: "Current and longest streak, with a calendar of active days.",
    defaultSize: "small",
    component: LearningStreakWidget,
  },
  {
    id: "notes",
    title: "Notes & summaries",
    description: "Your latest summaries and notes in your own words.",
    defaultSize: "medium",
    component: ReflectionsFeed,
  },
];

const BY_ID = new Map(WIDGETS.map((widget) => [widget.id, widget]));

export const getWidget = (id: string): WidgetDefinition | undefined => BY_ID.get(id);

export const DEFAULT_LAYOUT = defaultLayout(WIDGETS);
