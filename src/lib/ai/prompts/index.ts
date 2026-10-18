/**
 * Prompts and output schemas shared by both Claude providers (local Claude
 * Code and the visitor's own key), so they return the same shapes. One module
 * per feature; everything here is isomorphic (see shared.ts).
 */

export * from "./draft-plan";
export * from "./enrich-material";
export * from "./recommend";
export * from "./refine-summary";
export { type PromptSpec } from "./shared";
