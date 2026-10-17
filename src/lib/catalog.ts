/**
 * The only module that imports the curated content in `src/data`. Everything
 * else reads skills, materials, suggested tasks and the demo workspace through
 * here, so the content package can evolve behind one seam.
 */
import { getMaterialById } from "@/data";
import type { ID, Material } from "@/lib/domain/types";

export {
  BUILT_IN_SKILLS,
  CURATED_MATERIALS,
  DEMO_DATA,
  materialsForSkill,
  SUMMARIZE_TASK_TITLE,
  suggestedTasksFor,
} from "@/data";

/** Looks up a material in the curated library, then in the user's own materials. */
export function findMaterial(id: ID, customMaterials: readonly Material[]): Material | undefined {
  return getMaterialById(id, [...customMaterials]);
}
