import { findMaterial } from "@/lib/catalog";
import { appendActivity, event, type NewEvent } from "@/lib/domain/activity";
import { APP_DATA_VERSION } from "@/lib/domain/app-data";
import { toDayKey } from "@/lib/domain/dates";
import type { LegacyObjective, LegacyPlanItem, WorkspaceV2, WorkspaceV3 } from "@/lib/domain/legacy-types";
import type { ActivityEvent, KeyResult, Note, Objective, PlanItem, Skill, Workspace } from "@/lib/domain/types";
import { validateAppDataV1, validateWorkspaceV2, validateWorkspaceV3 } from "./schema";

/**
 * Schema migrations for persisted and imported data.
 *
 * When the stored shape changes: bump `APP_DATA_VERSION` (and the `version`
 * literal in types.ts / schema.ts), freeze the old schema in legacy-schemas.ts,
 * then add a step here keyed by the version it upgrades *from*. Steps receive
 * unvalidated data; the result is validated against the current schema afterwards.
 */

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

export class MigrationError extends Error {
  override name = "MigrationError";
}

const asRecord = (value: unknown) => value as Record<string, unknown>;

export const migrations: Readonly<Record<number, Migration>> = {
  /** v1 → v2: add the activity log, reconstructed from the timestamps already on plan items. */
  1: (data) => {
    const v1 = validateAppDataV1(data);
    if (!v1.ok) throw new MigrationError(`Saved data (v1) is invalid: ${v1.error}`);
    const upgraded: WorkspaceV2 = {
      ...v1.data,
      version: 2,
      activity: backfillActivity(v1.data.planItems),
      savedMaterialIds: [],
    };
    return asRecord(upgraded);
  },
  /** v2 → v3: add the dashboard layout, unset so existing users get the default dashboard. */
  2: (data) => {
    const v2 = validateWorkspaceV2(data);
    if (!v2.ok) throw new MigrationError(`Saved data (v2) is invalid: ${v2.error}`);
    const upgraded: WorkspaceV3 = { ...v2.data, version: 3, dashboardLayout: null };
    return asRecord(upgraded);
  },
  /** v3 → v4: notes become records, key results become typed, plus the profile and archived years. */
  3: (data) => {
    const v3 = validateWorkspaceV3(data);
    if (!v3.ok) throw new MigrationError(`Saved data (v3) is invalid: ${v3.error}`);
    return asRecord(upgradeV3(v3.data));
  },
};

export function migrateAppData(
  input: unknown,
  fromVersion: number,
  steps: Readonly<Record<number, Migration>> = migrations,
  targetVersion: number = APP_DATA_VERSION,
): unknown {
  if (fromVersion > targetVersion) {
    throw new MigrationError(
      `Data was saved by a newer version of Growloop (v${fromVersion}); this build reads up to v${targetVersion}.`,
    );
  }
  if (typeof input !== "object" || input === null) {
    throw new MigrationError("Expected an object to migrate.");
  }

  let data = input as Record<string, unknown>;
  for (let version = fromVersion; version < targetVersion; version += 1) {
    const step = steps[version];
    if (!step) throw new MigrationError(`No migration from v${version} to v${version + 1}.`);
    data = step(data);
  }
  return data;
}

// --- v1 → v2 ------------------------------------------------------------------------

/** Reconstructs an activity log from the timestamps on v1 plan items (v1 had no log). */
export function backfillActivity(items: readonly LegacyPlanItem[]): ActivityEvent[] {
  const events: NewEvent[] = items.flatMap((item) => {
    const at = (value: string) => ({ at: new Date(value).toISOString(), day: toDayKey(value) });
    const result: NewEvent[] = [];
    if (item.status === "done" && item.completedAt) {
      const { at: when, day } = at(item.completedAt);
      result.push(event(item, "item_completed", when, day));
    }
    for (const task of item.tasks) {
      if (task.done && task.completedAt) {
        const { at: when, day } = at(task.completedAt);
        result.push(event(item, "task_completed", when, day, { refId: task.id }));
      }
    }
    if (item.notes.trim() && item.notesUpdatedAt) {
      const { at: when, day } = at(item.notesUpdatedAt);
      result.push(event(item, "notes_edited", when, day));
    }
    if (item.summary.trim() && item.summaryUpdatedAt) {
      const { at: when, day } = at(item.summaryUpdatedAt);
      result.push(event(item, "summary_edited", when, day));
    }
    for (const log of item.timeLogs) {
      const { at: when } = at(item.createdAt);
      result.push(event(item, "time_logged", when, toDayKey(log.date), { hours: log.hours, refId: log.id }));
    }
    return result;
  });

  return appendActivity([], events.sort((a, b) => a.day.localeCompare(b.day) || a.at.localeCompare(b.at)));
}

// --- v3 → v4 ------------------------------------------------------------------------

/**
 * Upgrades a v3 workspace without losing anything the user wrote
 * (ux-flows.md §5, ADR 010 and 011):
 * - a card's summary and notes become Note records linked to the card and its
 *   material, keeping their timestamps;
 * - each free-text key result becomes a count KR on the objective's first
 *   skill (or the first visible skill), counting max(1, linked cards), with its
 *   title and card links kept. Manual progress has no place in the typed model
 *   and is dropped by design (ADR 011);
 * - objectives keep their description as `why` and start active and manual;
 * - Done certification cards count as earned: v3 had no separate "earned"
 *   step, so finishing one was the only way to say so.
 */
export function upgradeV3(v3: WorkspaceV3): Workspace {
  const fallbackSkill = v3.skills.find((skill) => !skill.hidden) ?? v3.skills[0];
  const linkedCount = (keyResultId: string) => v3.planItems.filter((item) => item.keyResultId === keyResultId).length;

  return {
    version: 4,
    profile: { skillLevels: [] },
    skills: v3.skills,
    customMaterials: v3.customMaterials,
    savedMaterialIds: v3.savedMaterialIds,
    objectives: v3.objectives.map((objective) => upgradeObjective(objective, fallbackSkill, linkedCount)),
    planItems: v3.planItems.map((item) => upgradePlanItem(item, v3)),
    notes: v3.planItems.flatMap(extractNotes),
    rollovers: v3.rollovers,
    activity: v3.activity,
    archivedYears: [],
    dashboardLayout: v3.dashboardLayout,
  };
}

function upgradeObjective(
  objective: LegacyObjective,
  fallbackSkill: Skill | undefined,
  linkedCount: (keyResultId: string) => number,
): Objective {
  const skillId = objective.skillIds[0] ?? fallbackSkill?.id;
  if (objective.keyResults.length > 0 && !skillId) {
    throw new MigrationError("Saved data (v3) has key results but no skills to attach them to.");
  }
  const keyResults: KeyResult[] = objective.keyResults.map((keyResult) => ({
    id: keyResult.id,
    title: keyResult.title,
    skillId: skillId!,
    type: "count",
    count: Math.max(1, linkedCount(keyResult.id)),
  }));
  const why = objective.description?.trim();
  return {
    id: objective.id,
    quarter: objective.quarter,
    title: objective.title,
    ...(why ? { why } : {}),
    status: "active",
    source: "manual",
    keyResults,
    createdAt: objective.createdAt,
  };
}

function upgradePlanItem(item: LegacyPlanItem, v3: WorkspaceV3): PlanItem {
  const { notes: _notes, notesUpdatedAt: _notesAt, summary: _summary, summaryUpdatedAt: _summaryAt, ...rest } = item;
  const isCertification = findMaterial(item.materialId, v3.customMaterials)?.type === "certification";
  return isCertification && item.status === "done" && item.completedAt ? { ...rest, earnedAt: item.completedAt } : rest;
}

/** A card's summary and notes as Note records. Ids are derived from the card, so migrating twice gives the same ids. */
function extractNotes(item: LegacyPlanItem): Note[] {
  const note = (kind: "summary" | "item_note", body: string, updatedAt: string | undefined): Note => ({
    id: `${item.id}:${kind}`,
    kind,
    planItemId: item.id,
    materialId: item.materialId,
    body,
    skillIds: [...item.skillIds],
    // Text written before edit times were recorded dates from the card's creation.
    createdAt: updatedAt ?? item.createdAt,
    updatedAt: updatedAt ?? item.createdAt,
  });
  return [
    ...(item.summary.trim() ? [note("summary", item.summary, item.summaryUpdatedAt)] : []),
    ...(item.notes.trim() ? [note("item_note", item.notes, item.notesUpdatedAt)] : []),
  ];
}
