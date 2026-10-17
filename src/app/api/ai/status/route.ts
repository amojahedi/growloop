import { connection } from "next/server";
import { getClaudeStatus } from "@/lib/ai/claude-cli";
import { aiAccessDenial } from "@/lib/ai/route-helpers";
import type { AIStatus } from "@/lib/ai/schemas";

/** GET /api/ai/status → whether the local Claude Code CLI can be used. */
export async function GET(request: Request) {
  // Spawns processes, so it must run per request and never be prerendered at build time.
  await connection();

  const denial = aiAccessDenial(request);
  if (denial) {
    return Response.json({
      available: false,
      code: denial.code === "demo-mode" ? "demo-mode" : "disabled",
      reason: denial.error,
    } satisfies AIStatus);
  }

  // A forced re-check spawns processes, so only the app itself may ask for one.
  const fresh =
    new URL(request.url).searchParams.has("fresh") && request.headers.get("sec-fetch-site") === "same-origin";
  return Response.json(await getClaudeStatus({ fresh }));
}
