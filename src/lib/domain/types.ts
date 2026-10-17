/**
 * Core domain model. See docs/PRD.md §4 for the concept map.
 * Dates are ISO strings: full timestamps for events, "YYYY-MM" for months, "YYYY-Qn" for quarters.
 */

export type ID = string;

/** "2026-10" */
export type MonthKey = string;
/** "2026-Q4" */
export type QuarterKey = string;

export type MaterialType = "course" | "certification" | "book" | "article" | "podcast" | "custom";

/** Every material type, in display order. */
export const MATERIAL_TYPES = ["course", "certification", "book", "article", "podcast", "custom"] as const satisfies readonly MaterialType[];

export type MaterialLevel = "beginner" | "intermediate" | "advanced";
export const MATERIAL_LEVELS = ["beginner", "intermediate", "advanced"] as const satisfies readonly MaterialLevel[];

export type MaterialCost = "free" | "freemium" | "paid";
export const MATERIAL_COSTS = ["free", "freemium", "paid"] as const satisfies readonly MaterialCost[];

export type BoardStatus = "backlog" | "todo" | "in_progress" | "done";

export const BOARD_COLUMNS: readonly BoardStatus[] = ["backlog", "todo", "in_progress", "done"];

/** Design-token color keys available to skills. */
export const SKILL_COLORS = [
  "slate", "red", "orange", "amber", "lime", "green", "teal", "cyan",
  "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
] as const;

export type SkillColor = (typeof SKILL_COLORS)[number];

export interface Skill {
  id: ID;
  name: string;
  description: string;
  /** Lucide icon name, e.g. "users", "map". */
  icon: string;
  color: SkillColor;
  /** True for the curated starter set; false for user-created skills. */
  builtIn: boolean;
  hidden?: boolean;
}

export interface Material {
  id: ID;
  type: MaterialType;
  title: string;
  /** Author(s), host or provider, e.g. "Marty Cagan" or "Reforge". */
  author: string;
  url?: string;
  skillIds: ID[];
  /** One-line hook shown on cards. */
  tagline: string;
  /** Short brief: what it covers. 2–4 sentences, original wording. */
  summary: string;
  /** Who it's for. */
  audience: string;
  /** 3–5 key takeaways, original wording. */
  keyTakeaways: string[];
  /** Rough effort to complete, in hours. */
  estimatedHours?: number;
  level: MaterialLevel;
  cost: MaterialCost;
  /** Milestones such as chapters or modules (optional). */
  milestones?: string[];
  /** True for library items, false for user-added ones. */
  curated: boolean;
}

export interface Task {
  id: ID;
  title: string;
  done: boolean;
  /**
   * "milestone" tasks come from the material's milestones, "suggested" ones are
   * prompts such as "Summarize in my words", and "custom" tasks are user-added.
   */
  kind: "milestone" | "suggested" | "custom";
  /** Set when the task is checked off; feeds the activity streak. */
  completedAt?: string;
}

export interface Reminder {
  /** ISO date, e.g. "2026-10-24". */
  date: string;
  note: string;
  dismissed?: boolean;
}

export interface TimeLog {
  id: ID;
  /** ISO date. */
  date: string;
  hours: number;
}

export interface PlanItem {
  id: ID;
  materialId: ID;
  month: MonthKey;
  status: BoardStatus;
  /** Order within its board column. */
  order: number;
  skillIds: ID[];
  keyResultId?: ID;
  tasks: Task[];
  notes: string;
  /** Last time `notes` was edited. */
  notesUpdatedAt?: string;
  /** "Summarize in my words". */
  summary: string;
  /** Last time `summary` was edited. */
  summaryUpdatedAt?: string;
  reminder?: Reminder;
  estimatedHours?: number;
  timeLogs: TimeLog[];
  createdAt: string;
  /** Set when status becomes "done". */
  completedAt?: string;
  /** Months this item was carried over from, oldest first. */
  carriedFrom?: MonthKey[];
}

export interface KeyResult {
  id: ID;
  title: string;
  /** "auto" = done/total of linked plan items; "manual" = user-set progress. */
  progressMode: "auto" | "manual";
  /** 0–100, used when progressMode is "manual". */
  manualProgress?: number;
}

export interface Objective {
  id: ID;
  quarter: QuarterKey;
  title: string;
  description?: string;
  skillIds: ID[];
  keyResults: KeyResult[];
  createdAt: string;
}

/** What to do with an unfinished item during the month-end review. */
export type RolloverDecision = "carry_over" | "backlog" | "drop";

/** Recorded outcome of a month-end rollover review. */
export interface RolloverRecord {
  fromMonth: MonthKey;
  toMonth: MonthKey;
  completedAt: string;
  /** How many items received each decision. */
  counts?: Record<RolloverDecision, number>;
}

/**
 * A workspace snapshot in schema v1: the format curated seed data (DEMO_DATA)
 * is authored in. The app stores a `Workspace` (current schema) and upgrades
 * v1 data through the migrations in src/lib/store/migrations.ts.
 */
export interface AppData {
  version: 1;
  skills: Skill[];
  /** User-added materials only; curated materials ship with the app. */
  customMaterials: Material[];
  objectives: Objective[];
  planItems: PlanItem[];
  rollovers: RolloverRecord[];
}

export type ActivityKind = "item_completed" | "task_completed" | "notes_edited" | "summary_edited" | "time_logged";

/**
 * One entry in the append-only activity log. Streaks, active days and logged
 * hours are computed from this log, so history survives later edits,
 * unchecked tasks and deleted or dropped items.
 */
export interface ActivityEvent {
  id: ID;
  kind: ActivityKind;
  /** Local calendar day the activity counts for, e.g. "2026-10-17". */
  day: string;
  /** When it was recorded (ISO timestamp). */
  at: string;
  itemId: ID;
  materialId: ID;
  /** The item's skills at the time, so per-skill history survives later edits. */
  skillIds: ID[];
  /** Hours, for "time_logged". */
  hours?: number;
  /** The task id ("task_completed") or time log id ("time_logged"). */
  refId?: ID;
}

/** Schema v2: v1 plus the activity log. Kept for migrating older saves. */
export interface WorkspaceV2 extends Omit<AppData, "version"> {
  version: 2;
  activity: ActivityEvent[];
  /**
   * Curated materials the user saved to My Library (ML-1). Optional and
   * defaulted to [] when loading, so older saves need no migration. The user's
   * own materials are always in the library and are not listed here.
   */
  savedMaterialIds?: ID[];
}

export const WIDGET_SIZES = ["small", "medium", "large"] as const;

export type WidgetSize = (typeof WIDGET_SIZES)[number];

/**
 * One visible dashboard widget, in display order. `widgetId` is a plain string
 * here because stored data may name widgets this build doesn't know (added by
 * a newer version or since retired); the dashboard skips those when rendering.
 */
export interface WidgetPlacement {
  widgetId: string;
  size: WidgetSize;
}

/** Everything the app stores locally (schema v3: v2 plus the dashboard layout). */
export interface Workspace extends Omit<WorkspaceV2, "version"> {
  version: 3;
  /** Visible widgets in order; hidden widgets are omitted. `null` = the default layout. */
  dashboardLayout: WidgetPlacement[] | null;
}
