/**
 * Core domain model (schema v4). See docs/PRD.md §4 for the concept map and
 * docs/design/ux-flows.md §5 for the data model.
 * Dates are ISO strings: full timestamps for events, "YYYY-MM-DD" for days,
 * "YYYY-MM" for months, "YYYY-Qn" for quarters.
 *
 * Frozen after WP0 (build plan): Phase 1 packages don't change these types;
 * new persisted fields are batched into one v5 migration.
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
  /** The card's own skills (1–3); the first is the primary skill. Starts as the material's skills. */
  skillIds: ID[];
  keyResultId?: ID;
  tasks: Task[];
  reminder?: Reminder;
  estimatedHours?: number;
  timeLogs: TimeLog[];
  createdAt: string;
  /** Set when status becomes "done". */
  completedAt?: string;
  /** Certifications only: when the user confirmed they earned it (C-7). */
  earnedAt?: string;
  /** When the "add a summary while it's fresh" toast was shown; it is shown at most once per card. */
  summaryNudgedAt?: string;
  /** Months this item was carried over from, oldest first. */
  carriedFrom?: MonthKey[];
}

// --- Writing (ADR 010) -------------------------------------------------------------

export type NoteKind = "summary" | "item_note" | "free";
export const NOTE_KINDS = ["summary", "item_note", "free"] as const satisfies readonly NoteKind[];

/** The two notes every card can have. */
export type CardNoteKind = Exclude<NoteKind, "free">;

/**
 * Everything the user writes. A card's summary and its notes are notes (one of
 * each per card), so the card drawer and the Notebook edit the same record, and
 * writing survives when the card is removed, dropped or archived. Plain text.
 */
export interface Note {
  id: ID;
  kind: NoteKind;
  /** summary / item_note: the card it belongs to (which may since have been removed). */
  planItemId?: ID;
  /** summary / item_note: kept so the note stays readable after its card is gone. */
  materialId?: ID;
  /** Free notes only; card notes show their material's title. */
  title?: string;
  body: string;
  /** Free notes: chosen (0–3). Card notes: follow the card's skills. */
  skillIds: ID[];
  /** Day the note is due for review, e.g. "2026-10-25". */
  reviewAt?: string;
  lastReviewedAt?: string;
  /** Last time a Claude suggestion replaced the body (summaries only). */
  refinedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// --- OKRs (ADR 007, 011) -----------------------------------------------------------

export type KeyResultType = "material" | "certification" | "count";
export const KEY_RESULT_TYPES = ["material", "certification", "count"] as const satisfies readonly KeyResultType[];

/** A typed key result on exactly one skill. Progress is always computed (see okrs.ts), never typed. */
export interface KeyResult {
  id: ID;
  title: string;
  skillId: ID;
  type: KeyResultType;
  /** material / certification: the library item to finish. */
  materialId?: ID;
  /** count: how many items tagged with the skill to finish inside the objective's quarter (1–10). */
  count?: number;
}

export type ObjectiveStatus = "active" | "closed";
export type ObjectiveSource = "claude" | "quick" | "manual";
export const OBJECTIVE_SOURCES = ["claude", "quick", "manual"] as const satisfies readonly ObjectiveSource[];

export interface Objective {
  id: ID;
  quarter: QuarterKey;
  title: string;
  /** One short line linking the objective to the user's goal. */
  why?: string;
  status: ObjectiveStatus;
  /** The score it closed with (0–100); set when closed. */
  finalProgress?: number;
  closedAt?: string;
  /** Set by the one quarter-end move allowed per objective: the quarter it came from. */
  movedFrom?: QuarterKey;
  source: ObjectiveSource;
  keyResults: KeyResult[];
  createdAt: string;
}

// --- Profile -----------------------------------------------------------------------

/** 1 New to it · 2 Learning · 3 Capable · 4 Strong · 5 Expert. */
export type SkillLevelValue = 1 | 2 | 3 | 4 | 5;
export const SKILL_LEVEL_VALUES = [1, 2, 3, 4, 5] as const satisfies readonly SkillLevelValue[];

export interface SkillLevel {
  skillId: ID;
  current: SkillLevelValue;
  target: SkillLevelValue;
  updatedAt: string;
}

export type RoleId = "aspiring_pm" | "associate_pm" | "pm" | "senior_pm" | "lead_pm";
export const ROLE_IDS = ["aspiring_pm", "associate_pm", "pm", "senior_pm", "lead_pm"] as const satisfies readonly RoleId[];

export type GoalId = "promotion" | "move_into_product" | "stronger" | "leadership" | "other";
export const GOAL_IDS = [
  "promotion",
  "move_into_product",
  "stronger",
  "leadership",
  "other",
] as const satisfies readonly GoalId[];

export interface Profile {
  /** Used in the greeting (≤ 40 chars). */
  name?: string;
  role?: RoleId;
  goal?: GoalId;
  /** The user's own words when the goal is "other" (≤ 80 chars). */
  goalText?: string;
  /** Now and Goal levels per skill, from the wizard or the skill sheet (S-5). */
  skillLevels: SkillLevel[];
}

// --- Month-end review --------------------------------------------------------------

/** What to do with an unfinished item during the month-end review. */
export type RolloverDecision = "carry_over" | "backlog" | "drop";

/** Recorded outcome of a month-end review. */
export interface RolloverRecord {
  fromMonth: MonthKey;
  toMonth: MonthKey;
  completedAt: string;
  /** How many items received each decision. */
  counts?: Record<RolloverDecision, number>;
  /** Objectives closed and moved in this review. */
  closedObjectiveIds?: ID[];
  movedObjectiveIds?: ID[];
  /**
   * Years the review offered to archive, archived or not. A declined year is
   * not offered again; the OKR page keeps an "Archive" button for it instead.
   */
  yearsOffered?: number[];
}

// --- Activity ----------------------------------------------------------------------

export type ActivityKind = "item_completed" | "task_completed" | "notes_edited" | "summary_edited" | "time_logged";
export const ACTIVITY_KINDS = [
  "item_completed",
  "task_completed",
  "notes_edited",
  "summary_edited",
  "time_logged",
] as const satisfies readonly ActivityKind[];

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

// --- Dashboard ---------------------------------------------------------------------

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

// --- Workspace ---------------------------------------------------------------------

/**
 * Everything the app stores for one workspace (schema v4), under
 * `growloop:data`, or `growloop:sample` in sample mode (ADR 009). Device
 * preferences and the Claude key live outside it and are never exported.
 * Older shapes are in legacy-types.ts; src/lib/store/migrations.ts upgrades them.
 */
export interface Workspace {
  version: 4;
  profile: Profile;
  skills: Skill[];
  /** User-added materials only; curated materials ship with the app. */
  customMaterials: Material[];
  /** Curated materials saved to My Library (ML-1). The user's own materials are always in the library. */
  savedMaterialIds: ID[];
  objectives: Objective[];
  planItems: PlanItem[];
  notes: Note[];
  rollovers: RolloverRecord[];
  activity: ActivityEvent[];
  /** Years archived in the month-end review: read-only under the OKR page's Archive tab. */
  archivedYears: number[];
  /** Visible widgets in order; hidden widgets are omitted. `null` = the default layout. */
  dashboardLayout: WidgetPlacement[] | null;
}
