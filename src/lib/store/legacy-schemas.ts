import { z } from "zod";
import type { AppData, WorkspaceV2, WorkspaceV3 } from "@/lib/domain/legacy-types";
import {
  activityEventSchema,
  id,
  materialSchema,
  monthKey,
  quarterKey,
  reminderSchema,
  skillSchema,
  taskSchema,
  timeLogSchema,
  timestamp,
  widgetPlacementSchema,
} from "./schema-parts";

/**
 * Schemas of older saves (v1–v3), used only to validate data before a
 * migration upgrades it. Frozen: never change them, add a new version instead.
 */

const legacyPlanItemSchema = z.object({
  id,
  materialId: id,
  month: monthKey,
  status: z.enum(["backlog", "todo", "in_progress", "done"]),
  order: z.number(),
  skillIds: z.array(id),
  keyResultId: id.optional(),
  tasks: z.array(taskSchema),
  notes: z.string(),
  notesUpdatedAt: timestamp.optional(),
  summary: z.string(),
  summaryUpdatedAt: timestamp.optional(),
  reminder: reminderSchema.optional(),
  estimatedHours: z.number().nonnegative().optional(),
  timeLogs: z.array(timeLogSchema),
  createdAt: timestamp,
  completedAt: timestamp.optional(),
  carriedFrom: z.array(monthKey).optional(),
});

const legacyKeyResultSchema = z.object({
  id,
  title: z.string(),
  progressMode: z.enum(["auto", "manual"]),
  manualProgress: z.number().min(0).max(100).optional(),
});

const legacyObjectiveSchema = z.object({
  id,
  quarter: quarterKey,
  title: z.string(),
  description: z.string().optional(),
  skillIds: z.array(id),
  keyResults: z.array(legacyKeyResultSchema),
  createdAt: timestamp,
});

const decisionCount = z.number().int().nonnegative();

const legacyRolloverRecordSchema = z.object({
  fromMonth: monthKey,
  toMonth: monthKey,
  completedAt: timestamp,
  counts: z.object({ carry_over: decisionCount, backlog: decisionCount, drop: decisionCount }).optional(),
});

/** Schema v1 (before the activity log): old saves, imports and the authored seed. */
export const appDataV1Schema = z.object({
  version: z.literal(1),
  skills: z.array(skillSchema),
  customMaterials: z.array(materialSchema),
  objectives: z.array(legacyObjectiveSchema),
  planItems: z.array(legacyPlanItemSchema),
  rollovers: z.array(legacyRolloverRecordSchema),
}) satisfies z.ZodType<AppData>;

/** Schema v2 (before the dashboard layout). */
export const workspaceV2Schema = appDataV1Schema.extend({
  version: z.literal(2),
  activity: z.array(activityEventSchema),
  // Added after v2 shipped: optional with a default, so saves without it load unchanged (no version bump).
  savedMaterialIds: z.array(id).default([]),
}) satisfies z.ZodType<WorkspaceV2, unknown>;

/** Schema v3 (before notes, typed key results and the profile). */
export const workspaceV3Schema = workspaceV2Schema.extend({
  version: z.literal(3),
  dashboardLayout: z.array(widgetPlacementSchema).nullable(),
}) satisfies z.ZodType<WorkspaceV3, unknown>;
