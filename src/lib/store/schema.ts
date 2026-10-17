import { z } from "zod";
import { SKILL_COLORS, type AppData } from "@/lib/domain/types";

/**
 * Runtime schema for `AppData`. Used to validate anything that enters the store
 * from outside the type system: persisted localStorage state and imported JSON.
 * The `satisfies` clause keeps it in lockstep with the TypeScript contract.
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
  type: z.enum(["course", "book", "article", "podcast", "custom"]),
  title: z.string(),
  author: z.string(),
  url: z.string().optional(),
  skillIds: z.array(id),
  tagline: z.string(),
  summary: z.string(),
  audience: z.string(),
  keyTakeaways: z.array(z.string()),
  estimatedHours: z.number().nonnegative().optional(),
  level: z.enum(["beginner", "intermediate", "advanced"]),
  cost: z.enum(["free", "paid", "freemium"]),
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

export const appDataSchema = z.object({
  version: z.literal(1),
  skills: z.array(skillSchema),
  customMaterials: z.array(materialSchema),
  objectives: z.array(objectiveSchema),
  planItems: z.array(planItemSchema),
  rollovers: z.array(rolloverRecordSchema),
}) satisfies z.ZodType<AppData>;

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; error: string };

/** Validates unknown input as `AppData`, with a readable error on failure. */
export function validateAppData(input: unknown): ValidationResult<AppData> {
  const result = appDataSchema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: z.prettifyError(result.error) };
}
