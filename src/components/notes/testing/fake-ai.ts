import { useState } from "react";
import { vi } from "vitest";
import type { SummaryFeedback } from "@/lib/ai/schemas";

/**
 * A stand-in for `@/lib/ai/use-ai` in component tests: no network, a status
 * the test sets, and a `refineSummary` action backed by a mock.
 *
 *   vi.mock("@/lib/ai/use-ai", async () => (await import("@/components/notes/testing/fake-ai")).fakeUseAIModule);
 */
export const fakeAI = {
  state: "available" as "available" | "unavailable" | "checking",
  refine: vi.fn<(input: unknown) => Promise<SummaryFeedback>>(),
};

interface ActionState {
  data?: SummaryFeedback;
  error?: Error & { code: string };
  loading: boolean;
}

function useFakeAI() {
  const [state, setState] = useState<ActionState>({ loading: false });
  const run = async (input: unknown) => {
    setState({ loading: true });
    try {
      const data = await fakeAI.refine(input);
      setState({ data, loading: false });
      return data;
    } catch (error) {
      setState({ error: error as ActionState["error"], loading: false });
      return undefined;
    }
  };
  return {
    provider: fakeAI.state === "available" ? ("key" as const) : null,
    status: fakeAI.state === "unavailable" ? { state: "unavailable" as const, code: "disabled" as const } : { state: fakeAI.state },
    recheck: () => {},
    refineSummary: { ...state, run, reset: () => setState({ loading: false }), lastError: () => state.error },
  };
}

export const fakeUseAIModule = {
  useAI: useFakeAI,
  useLocalClaudeStatus: () => ({ status: { state: "unavailable" as const }, recheck: () => {} }),
};

export function resetFakeAI() {
  fakeAI.state = "available";
  fakeAI.refine.mockReset();
}
