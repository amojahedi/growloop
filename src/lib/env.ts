/**
 * Public build-time flags. `NEXT_PUBLIC_*` values are inlined at build time, so
 * they must be read with literal property access.
 */

/** Hosted demo: seeds sample data on first load and disables the local AI bridge. */
export const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
