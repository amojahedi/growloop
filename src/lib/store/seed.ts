import { BUILT_IN_SKILLS, DEMO_DATA } from "@/lib/catalog";
import { newWorkspace } from "@/lib/domain/app-data";
import type { AppData, Workspace } from "@/lib/domain/types";
import { migrateAppData } from "./migrations";
import { validateWorkspace } from "./schema";

/** First-run data: an empty plan, or the sample workspace on the hosted demo. */

export const emptyWorkspace = (): Workspace => newWorkspace(BUILT_IN_SKILLS);

/** Upgrades authored seed data (schema v1) to the current schema via the regular migrations. */
export function upgradeSeed(seed: AppData): Workspace {
  const result = validateWorkspace(migrateAppData(structuredClone(seed), seed.version));
  if (!result.ok) throw new Error(`Seed data is invalid: ${result.error}`);
  return result.data;
}

export const demoWorkspace = (): Workspace => upgradeSeed(DEMO_DATA);
