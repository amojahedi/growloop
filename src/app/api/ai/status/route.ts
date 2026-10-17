import { connection } from "next/server";
import { getClaudeStatus } from "@/lib/ai/claude-cli";
import type { AIStatus } from "@/lib/ai/schemas";
import { isDemoMode } from "@/lib/env";

/** GET /api/ai/status → whether the local Claude Code CLI can be used. */
export async function GET(request: Request) {
  // Spawns processes, so it must run per request and never be prerendered at build time.
  await connection();

  if (isDemoMode) {
    return Response.json({
      available: false,
      code: "demo-mode",
      reason: "AI features run on your own machine with Claude Code. Run Growloop locally to enable them.",
    } satisfies AIStatus);
  }

  const fresh = new URL(request.url).searchParams.has("fresh");
  return Response.json(await getClaudeStatus({ fresh }));
}
