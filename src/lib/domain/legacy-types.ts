import type { ActivityEvent, ID, Material, PlanItem, QuarterKey, RolloverRecord, Skill, WidgetPlacement } from "./types";

/**
 * Shapes of older saves (schema v1–v3), kept only so the migrations in
 * src/lib/store/migrations.ts can read them. Nothing else should use these.
 * The authored seed (src/data/demo.ts) is still written in v1 and upgraded.
 */

/** v1–v3 plan item: summary and notes were fields on the card (moved to Note records in v4, ADR 010). */
export interface LegacyPlanItem extends Omit<PlanItem, "earnedAt" | "summaryNudgedAt"> {
  notes: string;
  notesUpdatedAt?: string;
  summary: string;
  summaryUpdatedAt?: string;
}

/** v1–v3 key result: free text with auto or manual progress (typed in v4, ADR 011). */
export interface LegacyKeyResult {
  id: ID;
  title: string;
  /** "auto" = done/total of linked plan items; "manual" = user-set progress. */
  progressMode: "auto" | "manual";
  /** 0–100, used when progressMode is "manual". */
  manualProgress?: number;
}

export interface LegacyObjective {
  id: ID;
  quarter: QuarterKey;
  title: string;
  description?: string;
  skillIds: ID[];
  keyResults: LegacyKeyResult[];
  createdAt: string;
}

/** Schema v1: the format the curated seed data is authored in. */
export interface AppData {
  version: 1;
  skills: Skill[];
  /** User-added materials only; curated materials ship with the app. */
  customMaterials: Material[];
  objectives: LegacyObjective[];
  planItems: LegacyPlanItem[];
  rollovers: Pick<RolloverRecord, "fromMonth" | "toMonth" | "completedAt" | "counts">[];
}

/** Schema v2: v1 plus the activity log and saved materials. */
export interface WorkspaceV2 extends Omit<AppData, "version"> {
  version: 2;
  activity: ActivityEvent[];
  savedMaterialIds: ID[];
}

/** Schema v3: v2 plus the dashboard layout. */
export interface WorkspaceV3 extends Omit<WorkspaceV2, "version"> {
  version: 3;
  dashboardLayout: WidgetPlacement[] | null;
}
