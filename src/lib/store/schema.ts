import { z } from "zod";
import type { AppData, WorkspaceV2, WorkspaceV3 } from "@/lib/domain/legacy-types";
import {
  GOAL_IDS,
  KEY_RESULT_TYPES,
  NOTE_KINDS,
  OBJECTIVE_SOURCES,
  ROLE_IDS,
  SKILL_LEVEL_VALUES,
  type Workspace,
} from "@/lib/domain/types";
import { appDataV1Schema, workspaceV2Schema, workspaceV3Schema } from "./legacy-schemas";
import {
  activityEventSchema,
  dayKey,
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
 * Runtime schema for stored data (v4). Used to validate anything that enters
 * the store from outside the type system: persisted localStorage state and
 * imported JSON. The `satisfies` clause keeps it in lockstep with the types.
 */

const planItemSchema = z.object({
  id,
  materialId: id,
  month: monthKey,
  status: z.enum(["backlog", "todo", "in_progress", "done"]),
  order: z.number(),
  skillIds: z.array(id),
  keyResultId: id.optional(),
  tasks: z.array(taskSchema),
  reminder: reminderSchema.optional(),
  estimatedHours: z.number().nonnegative().optional(),
  timeLogs: z.array(timeLogSchema),
  createdAt: timestamp,
  completedAt: timestamp.optional(),
  earnedAt: timestamp.optional(),
  summaryNudgedAt: timestamp.optional(),
  carriedFrom: z.array(monthKey).optional(),
});

const noteSchema = z.object({
  id,
  kind: z.enum(NOTE_KINDS),
  planItemId: id.optional(),
  materialId: id.optional(),
  title: z.string().optional(),
  body: z.string(),
  skillIds: z.array(id),
  reviewAt: dayKey.optional(),
  lastReviewedAt: timestamp.optional(),
  refinedAt: timestamp.optional(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const keyResultSchema = z.object({
  id,
  title: z.string(),
  skillId: id,
  type: z.enum(KEY_RESULT_TYPES),
  materialId: id.optional(),
  count: z.number().int().positive().optional(),
});

const objectiveSchema = z.object({
  id,
  quarter: quarterKey,
  title: z.string(),
  why: z.string().optional(),
  status: z.enum(["active", "closed"]),
  finalProgress: z.number().min(0).max(100).optional(),
  closedAt: timestamp.optional(),
  movedFrom: quarterKey.optional(),
  source: z.enum(OBJECTIVE_SOURCES),
  keyResults: z.array(keyResultSchema),
  createdAt: timestamp,
});

const skillLevelValue = z.literal([...SKILL_LEVEL_VALUES]);

const profileSchema = z.object({
  name: z.string().optional(),
  role: z.enum(ROLE_IDS).optional(),
  goal: z.enum(GOAL_IDS).optional(),
  goalText: z.string().optional(),
  skillLevels: z.array(
    z.object({ skillId: id, current: skillLevelValue, target: skillLevelValue, updatedAt: timestamp }),
  ),
});

const decisionCount = z.number().int().nonnegative();

const rolloverRecordSchema = z.object({
  fromMonth: monthKey,
  toMonth: monthKey,
  completedAt: timestamp,
  counts: z.object({ carry_over: decisionCount, backlog: decisionCount, drop: decisionCount }).optional(),
  closedObjectiveIds: z.array(id).optional(),
  movedObjectiveIds: z.array(id).optional(),
  yearsOffered: z.array(z.number().int()).optional(),
});

/** Current schema (v4). */
export const workspaceSchema = z.object({
  version: z.literal(4),
  profile: profileSchema,
  skills: z.array(skillSchema),
  customMaterials: z.array(materialSchema),
  savedMaterialIds: z.array(id),
  objectives: z.array(objectiveSchema),
  planItems: z.array(planItemSchema),
  notes: z.array(noteSchema),
  rollovers: z.array(rolloverRecordSchema),
  activity: z.array(activityEventSchema),
  archivedYears: z.array(z.number().int()),
  dashboardLayout: z.array(widgetPlacementSchema).nullable(),
}) satisfies z.ZodType<Workspace>;

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

function toResult<T>(result: z.ZodSafeParseResult<T>): ValidationResult<T> {
  return result.success ? { ok: true, data: result.data } : { ok: false, error: z.prettifyError(result.error) };
}

/** Validates unknown input as a current-schema `Workspace`, with a readable error on failure. */
export function validateWorkspace(input: unknown): ValidationResult<Workspace> {
  return toResult(workspaceSchema.safeParse(input));
}

/** Validates unknown input as schema v3 data. */
export function validateWorkspaceV3(input: unknown): ValidationResult<WorkspaceV3> {
  return toResult(workspaceV3Schema.safeParse(input));
}

/** Validates unknown input as schema v2 data. */
export function validateWorkspaceV2(input: unknown): ValidationResult<WorkspaceV2> {
  return toResult(workspaceV2Schema.safeParse(input));
}

/** Validates unknown input as schema v1 data. */
export function validateAppDataV1(input: unknown): ValidationResult<AppData> {
  return toResult(appDataV1Schema.safeParse(input));
}
