import type { ID, Material } from "@/lib/domain/types";
import { CURATED_MATERIALS } from "./materials";

export { BUILT_IN_SKILLS, objectivePhrasesFor, storedSkill, type BuiltInSkill } from "./skills";
export { CURATED_MATERIALS } from "./materials";
export { suggestedTasksFor, SUMMARIZE_TASK_TITLE } from "./suggested-tasks";
export { DEMO_DATA } from "./demo";

/** Looks up a material in the curated library first, then in user-added materials. */
export function getMaterialById(id: ID, customMaterials: Material[] = []): Material | undefined {
  return CURATED_MATERIALS.find((m) => m.id === id) ?? customMaterials.find((m) => m.id === id);
}

/** All curated and user-added materials tagged with the given skill, curated first. */
export function materialsForSkill(skillId: ID, customMaterials: Material[] = []): Material[] {
  return [...CURATED_MATERIALS, ...customMaterials].filter((m) => m.skillIds.includes(skillId));
}
