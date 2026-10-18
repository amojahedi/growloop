/**
 * The guided tour (help-and-guide.md §Guided tour, H-2, H-5): content as data,
 * so copy changes never touch components. Each step points at an element by
 * its `data-tour` attribute. Widget frames expose `widget-<id>` and nav items
 * `nav-<label>`; steps whose target isn't on screen are skipped. When the
 * target is hidden (the sidebar below 768 px), `fallbackTarget` is used.
 */

export interface TourStep {
  /** The `data-tour` value of the element to highlight. */
  target: string;
  /** Used when `target` isn't visible, e.g. the menu button standing in for the sidebar on mobile. */
  fallbackTarget?: string;
  title: string;
  body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    target: "widget-items-completed",
    title: "Your month at a glance",
    body: "The big number is what you've finished this month. It's the one that counts.",
  },
  {
    target: "widget-skill-radar",
    title: "Where you're growing",
    body: "Solid shows what you've finished, dashed what's planned. Hover a card or resource to preview what it adds.",
  },
  {
    target: "nav-okrs",
    fallbackTarget: "menu",
    title: "Set your year",
    body: "A few goals, each tied to a skill. Progress fills in as you finish things.",
  },
  {
    target: "nav-library",
    fallbackTarget: "menu",
    title: "Find something good",
    body: "Hand-picked courses, books, articles and podcasts. Add puts one straight on this month's board.",
  },
  {
    target: "nav-board",
    fallbackTarget: "menu",
    title: "Learn on your board",
    body: "Drag cards as you go, or use ⋯ to move them. Open a card to take notes and write a summary.",
  },
  {
    target: "nav-notebook",
    fallbackTarget: "menu",
    title: "Keep what sticks",
    body: "Your summaries land here. Mark one Review later and it comes back when it's due.",
  },
  {
    target: "help",
    title: "Here when you need it",
    body: "Replay this tour or read how Growloop works.",
  },
];
