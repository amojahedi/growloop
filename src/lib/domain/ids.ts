import type { ID } from "./types";

/** Random, collision-safe identifier for locally created records. */
export function createId(): ID {
  return crypto.randomUUID();
}
