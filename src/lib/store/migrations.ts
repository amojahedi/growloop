import { APP_DATA_VERSION } from "@/lib/domain/app-data";

/**
 * Schema migrations for persisted and imported data.
 *
 * When `AppData` changes shape: bump `APP_DATA_VERSION` (and the `version`
 * literal in types.ts / schema.ts), then add a step here keyed by the version
 * it upgrades *from*. Steps receive unvalidated data; the result is validated
 * against the current schema afterwards.
 */

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

export const migrations: Readonly<Record<number, Migration>> = {
  // 1: (data) => ({ ...data, version: 2, newField: [] }),
};

export class MigrationError extends Error {
  override name = "MigrationError";
}

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
