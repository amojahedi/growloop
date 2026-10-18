"use client";

import { ArrowRightIcon } from "lucide-react";
import Link from "next/link";
import { useId, useMemo } from "react";
import { DataGate } from "@/components/app/data-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { formatQuarter, parseQuarterKey, quarterOfDay } from "@/lib/domain/dates";
import { activeObjectives, objectiveProgress } from "@/lib/domain/okrs";
import type { Objective, PlanItem, QuarterKey } from "@/lib/domain/types";
import { useObjectives, usePlanItems, useToday } from "@/lib/store/hooks";

/** At most this many objectives are listed; the rest collapse into "+ n more". */
export const MAX_SIDEBAR_OBJECTIVES = 3;

export type SidebarObjectivesState =
  | { kind: "set-your-year" }
  | { kind: "plan-quarter"; quarter: QuarterKey }
  | { kind: "list"; quarter: QuarterKey; shown: { objective: Objective; progress: number }[]; more: number };

/**
 * What the sidebar objectives slot shows (NAV-2, O-6): this quarter's active
 * objectives with their progress, "Set your year" until any active objective
 * exists, or "Plan it" when none falls in this quarter. Pure, for tests.
 */
export function sidebarObjectives(objectives: readonly Objective[], items: readonly PlanItem[], quarter: QuarterKey): SidebarObjectivesState {
  const active = activeObjectives(objectives);
  if (active.length === 0) return { kind: "set-your-year" };
  const current = active.filter((objective) => objective.quarter === quarter);
  if (current.length === 0) return { kind: "plan-quarter", quarter };
  return {
    kind: "list",
    quarter,
    shown: current.slice(0, MAX_SIDEBAR_OBJECTIVES).map((objective) => ({ objective, progress: objectiveProgress(objective, items) })),
    more: Math.max(0, current.length - MAX_SIDEBAR_OBJECTIVES),
  };
}

export function SidebarObjectives({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <DataGate fallback={<Skeleton className="mx-2.5 h-16" />}>
      <SidebarObjectivesContent onNavigate={onNavigate} />
    </DataGate>
  );
}

const linkClass =
  "flex items-center gap-2.5 rounded-xl px-2.5 py-[7px] text-sm leading-snug text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground motion-reduce:transition-none";

function SidebarObjectivesContent({ onNavigate }: { onNavigate?: () => void }) {
  const objectives = useObjectives();
  const items = usePlanItems();
  const quarter = quarterOfDay(useToday());
  const state = useMemo(() => sidebarObjectives(objectives, items, quarter), [objectives, items, quarter]);
  const headingId = useId();

  if (state.kind === "set-your-year") {
    return (
      <Link href="/okrs/plan" onClick={onNavigate} className={`${linkClass} font-semibold text-sidebar-foreground`}>
        Set your year
        <ArrowRightIcon className="size-4" aria-hidden />
      </Link>
    );
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-0.5">
      <h2 id={headingId} className="px-2.5 pb-1.5 text-xs font-semibold text-muted-foreground">
        {formatQuarter(state.quarter)}
      </h2>
      {state.kind === "plan-quarter" ? (
        <p className="px-2.5 text-sm text-muted-foreground">
          Nothing set for Q{parseQuarterKey(state.quarter).quarter} ·{" "}
          <Link href="/okrs/plan" onClick={onNavigate} className="font-medium text-brand-soft-foreground underline-offset-4 hover:underline">
            Plan it
          </Link>
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {state.shown.map(({ objective, progress }) => (
            <li key={objective.id}>
              <Link href="/okrs" onClick={onNavigate} className={linkClass} title={objective.title}>
                <ProgressRing value={progress} />
                <span className="min-w-0 flex-1 truncate">{objective.title}</span>
                <span className="text-xs text-muted-foreground tabular-nums">{progress}%</span>
              </Link>
            </li>
          ))}
          {state.more > 0 && (
            <li>
              <Link href="/okrs" onClick={onNavigate} className={`${linkClass} text-xs`}>
                + {state.more} more
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

const RADIUS = 7;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** An 18 px progress ring (Linen sidebar). Decorative: the percentage is written next to it. */
export function ProgressRing({ value }: { value: number }) {
  const filled = (Math.min(100, Math.max(0, value)) / 100) * CIRCUMFERENCE;
  return (
    <svg viewBox="0 0 18 18" className="size-[18px] shrink-0" aria-hidden>
      <circle cx="9" cy="9" r={RADIUS} fill="none" className="stroke-input" strokeWidth="2.5" />
      {filled > 0 && (
        <circle
          cx="9"
          cy="9"
          r={RADIUS}
          fill="none"
          className="stroke-chart-2"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${filled.toFixed(2)} ${CIRCUMFERENCE.toFixed(2)}`}
          transform="rotate(-90 9 9)"
        />
      )}
    </svg>
  );
}
