import { z } from "zod";
import { MATERIAL_COSTS, MATERIAL_LEVELS, MATERIAL_TYPES, SKILL_COLORS, type AppData, type Workspace } from "@/lib/domain/types";

/**
 * Runtime schemas for stored data. Used to validate anything that enters the
 * store from outside the type system: persisted localStorage state and
 * imported JSON. The `satisfies` clauses keep them in lockstep with the types.
 */

const id = z.string().min(1);
const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected a month key like 2026-10");
const quarterKey = z.string().regex(/^\d{4}-Q[1-4]$/, "Expected a quarter key like 2026-Q4");
const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Expected an ISO date");

const skillSchema = z.object({
  id,
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  color: z.enum(SKILL_COLORS),
  builtIn: z.boolean(),
  hidden: z.boolean().optional(),
});

const materialSchema = z.object({
  id,
  type: z.enum(MATERIAL_TYPES),
  title: z.string(),
  author: z.string(),
  url: z.string().optional(),
  skillIds: z.array(id),
  tagline: z.string(),
  summary: z.string(),
  audience: z.string(),
  keyTakeaways: z.array(z.string()),
  estimatedHours: z.number().nonnegative().optional(),
  level: z.enum(MATERIAL_LEVELS),
  cost: z.enum(MATERIAL_COSTS),
  milestones: z.array(z.string()).optional(),
  curated: z.boolean(),
});

const taskSchema = z.object({
  id,
  title: z.string(),
  done: z.boolean(),
  kind: z.enum(["milestone", "suggested", "custom"]),
  completedAt: timestamp.optional(),
});

const reminderSchema = z.object({
  date: timestamp,
  note: z.string(),
  dismissed: z.boolean().optional(),
});

const timeLogSchema = z.object({
  id,
  date: timestamp,
  hours: z.number().positive(),
});

const planItemSchema = z.object({
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

const keyResultSchema = z.object({
  id,
  title: z.string(),
  progressMode: z.enum(["auto", "manual"]),
  manualProgress: z.number().min(0).max(100).optional(),
});

const objectiveSchema = z.object({
  id,
  quarter: quarterKey,
  title: z.string(),
  description: z.string().optional(),
  skillIds: z.array(id),
  keyResults: z.array(keyResultSchema),
  createdAt: timestamp,
});

const decisionCount = z.number().int().nonnegative();

const rolloverRecordSchema = z.object({
  fromMonth: monthKey,
  toMonth: monthKey,
  completedAt: timestamp,
  counts: z.object({ carry_over: decisionCount, backlog: decisionCount, drop: decisionCount }).optional(),
});

/** Schema v1 (before the activity log); used to upgrade old saves, imports and seed data. */
export const appDataV1Schema = z.object({
  version: z.literal(1),
  skills: z.array(skillSchema),
  customMaterials: z.array(materialSchema),
  objectives: z.array(objectiveSchema),
  planItems: z.array(planItemSchema),
  rollovers: z.array(rolloverRecordSchema),
}) satisfies z.ZodType<AppData>;

const activityEventSchema = z.object({
  id,
  kind: z.enum(["item_completed", "task_completed", "notes_edited", "summary_edited", "time_logged"]),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a day like 2026-10-17"),
  at: timestamp,
  itemId: id,
  materialId: id,
  skillIds: z.array(id),
  hours: z.number().positive().optional(),
  refId: id.optional(),
});

/** Current schema (v2). */
export const workspaceSchema = appDataV1Schema.extend({
  version: z.literal(2),
  activity: z.array(activityEventSchema),
  // Added after v2 shipped: optional with a default, so saves without it load unchanged (no version bump).
  savedMaterialIds: z.array(id).default([]),
}) satisfies z.ZodType<Workspace>;

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

function toResult<T>(result: z.ZodSafeParseResult<T>): ValidationResult<T> {
  return result.success ? { ok: true, data: result.data } : { ok: false, error: z.prettifyError(result.error) };
}

/** Validates unknown input as a current-schema `Workspace`, with a readable error on failure. */
export function validateWorkspace(input: unknown): ValidationResult<Workspace> {
  return toResult(workspaceSchema.safeParse(input));
}

/** Validates unknown input as schema v1 data. */
export function validateAppDataV1(input: unknown): ValidationResult<AppData> {
  return toResult(appDataV1Schema.safeParse(input));
}
