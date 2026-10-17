import { dayKey } from "@/lib/domain/dates";
import type { Workspace } from "@/lib/domain/types";
import { migrateAppData, MigrationError } from "./migrations";
import { validateWorkspace, type ValidationResult } from "./schema";

/** JSON export/import of the whole workspace. */

export const EXPORT_APP_ID = "growloop";

export interface ExportFile {
  app: typeof EXPORT_APP_ID;
  exportedAt: string;
  data: Workspace;
}

export function serializeWorkspace(data: Workspace, now: string = new Date().toISOString()): string {
  const file: ExportFile = { app: EXPORT_APP_ID, exportedAt: now, data };
  return JSON.stringify(file, null, 2);
}

/** Suggested download name using the local date, e.g. "growloop-2026-10-17.json". */
export function exportFileName(now: Date = new Date()): string {
  return `growloop-${dayKey(now)}.json`;
}

/**
 * Parses an export file (or bare workspace data), migrating older versions
 * and validating the result. Never throws.
 */
export function parseImportedData(json: string): ValidationResult<Workspace> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: "The file is not valid JSON." };
  }

  const payload = isExportFile(parsed) ? parsed.data : parsed;
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, error: "The file does not contain Growloop data." };
  }

  const version = (payload as { version?: unknown }).version;
  if (typeof version !== "number") {
    return { ok: false, error: "The file is missing a data version." };
  }

  try {
    return validateWorkspace(migrateAppData(payload, version));
  } catch (error) {
    if (error instanceof MigrationError) return { ok: false, error: error.message };
    throw error;
  }
}

function isExportFile(value: unknown): value is { app: string; data: unknown } {
  return typeof value === "object" && value !== null && (value as { app?: unknown }).app === EXPORT_APP_ID;
}
