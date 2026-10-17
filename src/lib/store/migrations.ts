import { backfillActivity } from "@/lib/domain/activity";
import { APP_DATA_VERSION } from "@/lib/domain/app-data";
import type { Workspace, WorkspaceV2 } from "@/lib/domain/types";
import { validateAppDataV1, validateWorkspaceV2 } from "./schema";

/**
 * Schema migrations for persisted and imported data.
 *
 * When the stored shape changes: bump `APP_DATA_VERSION` (and the `version`
 * literal in types.ts / schema.ts), then add a step here keyed by the version
 * it upgrades *from*. Steps receive unvalidated data; the result is validated
 * against the current schema afterwards.
 */

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

export class MigrationError extends Error {
  override name = "MigrationError";
}

export const migrations: Readonly<Record<number, Migration>> = {
  /** v1 → v2: add the activity log, reconstructed from the timestamps already on plan items. */
  1: (data) => {
    const v1 = validateAppDataV1(data);
    if (!v1.ok) throw new MigrationError(`Saved data (v1) is invalid: ${v1.error}`);
    const upgraded: WorkspaceV2 = { ...v1.data, version: 2, activity: backfillActivity(v1.data.planItems) };
    return upgraded as unknown as Record<string, unknown>;
  },
  /** v2 → v3: add the dashboard layout, unset so existing users get the default dashboard. */
  2: (data) => {
    const v2 = validateWorkspaceV2(data);
    if (!v2.ok) throw new MigrationError(`Saved data (v2) is invalid: ${v2.error}`);
    const upgraded: Workspace = { ...v2.data, version: 3, dashboardLayout: null };
    return upgraded as unknown as Record<string, unknown>;
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
