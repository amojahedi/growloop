import { z } from "zod";
import { ACTIVITY_KINDS, MATERIAL_COSTS, MATERIAL_LEVELS, MATERIAL_TYPES, SKILL_COLORS, WIDGET_SIZES } from "@/lib/domain/types";

/**
 * Field schemas shared by the current schema (schema.ts) and the legacy ones
 * (legacy-schemas.ts). Changing one changes how old saves are read, so only
 * loosen them, never tighten.
 */

export const id = z.string().min(1);
export const monthKey = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Expected a month key like 2026-10");
export const quarterKey = z.string().regex(/^\d{4}-Q[1-4]$/, "Expected a quarter key like 2026-Q4");
export const dayKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected a day like 2026-10-17");
export const timestamp = z.string().refine((value) => !Number.isNaN(Date.parse(value)), "Expected an ISO date");

export const skillSchema = z.object({
  id,
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  color: z.enum(SKILL_COLORS),
  builtIn: z.boolean(),
  hidden: z.boolean().optional(),
});

export const materialSchema = z.object({
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

export const taskSchema = z.object({
  id,
  title: z.string(),
  done: z.boolean(),
  kind: z.enum(["milestone", "suggested", "custom"]),
  completedAt: timestamp.optional(),
});

export const reminderSchema = z.object({
  date: timestamp,
  note: z.string(),
  dismissed: z.boolean().optional(),
});

export const timeLogSchema = z.object({
  id,
  date: timestamp,
  hours: z.number().positive(),
});

export const activityEventSchema = z.object({
  id,
  kind: z.enum(ACTIVITY_KINDS),
  day: dayKey,
  at: timestamp,
  itemId: id,
  materialId: id,
  skillIds: z.array(id),
  hours: z.number().positive().optional(),
  refId: id.optional(),
});

// Any non-empty id is accepted: unknown widgets are skipped when rendering, so a
// layout from a newer build never invalidates the whole workspace.
export const widgetPlacementSchema = z.object({
  widgetId: id,
  size: z.enum(WIDGET_SIZES),
});
