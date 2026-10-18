"use client";

import { Loader2Icon } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { quarterOfDay, yearOf, type DayKey } from "@/lib/domain/dates";
import type { QuarterKey } from "@/lib/domain/types";
import { QuarterColumn, QuarterGrid, quartersOf } from "../quarter-grid";

/** Claude is drafting: the review's layout as skeleton columns, with a way out to the quick draft. */
export function DraftingView({ scope, today, onUseQuickDraft }: { scope: readonly QuarterKey[]; today: DayKey; onUseQuickDraft: () => void }) {
  // The Draft button is gone: put focus on the way out, next to the status line it is read with.
  const quickRef = useRef<HTMLButtonElement>(null);
  useEffect(() => quickRef.current?.focus(), []);
  return (
    <div className="flex flex-col gap-5" aria-busy="true">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="status">
        <p id="wizard-drafting-status" className="flex items-center gap-2 text-sm">
          <Loader2Icon aria-hidden className="size-4 animate-spin text-primary motion-reduce:animate-none" />
          Claude is drafting your plan. This can take up to a minute.
        </p>
        <Button ref={quickRef} variant="outline" size="sm" onClick={onUseQuickDraft} aria-describedby="wizard-drafting-status">
          Use the quick draft instead
        </Button>
      </div>
      <SkeletonColumns scope={scope} today={today} />
    </div>
  );
}

/** Claude failed: say so (with the reason when known) and offer both ways on. The answers are kept. */
export function DraftFailedView({
  reason,
  onRetry,
  onUseQuickDraft,
}: {
  reason?: string;
  onRetry: () => void;
  onUseQuickDraft: () => void;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div role="alert" className="flex max-w-xl flex-col gap-3 rounded-2xl border bg-card p-5 shadow-xs">
      <h2 ref={ref} tabIndex={-1} className="font-display text-lg font-semibold outline-none">
        Claude couldn&apos;t draft a plan this time.
      </h2>
      {reason && <p className="text-sm text-muted-foreground">{reason}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        <Button onClick={onRetry}>Try again</Button>
        <Button variant="outline" onClick={onUseQuickDraft}>
          Use the quick draft
        </Button>
      </div>
    </div>
  );
}

/** The quick draft had nothing to plan with these answers. */
export function QuickDraftFailedView({ onBack }: { onBack: () => void }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <div role="alert" className="flex max-w-xl flex-col gap-3 rounded-2xl border bg-card p-5 shadow-xs">
      <h2 ref={ref} tabIndex={-1} className="font-display text-lg font-semibold outline-none">
        Couldn&apos;t draft a plan from these answers.
      </h2>
      <p className="text-sm text-muted-foreground">Try other skills, or add objectives yourself on the OKR page.</p>
      <div className="pt-1">
        <Button onClick={onBack}>Back</Button>
      </div>
    </div>
  );
}

function SkeletonColumns({ scope, today }: { scope: readonly QuarterKey[]; today: DayKey }) {
  const years = [...new Set(scope.map(yearOf))];
  const inScope = new Set(scope);
  const now = quarterOfDay(today);
  return (
    <div className="flex flex-col gap-6" aria-hidden>
      {years.map((year) => (
        <div key={year} className="flex flex-col gap-3">
          <Skeleton className="h-5 w-14" />
          <QuarterGrid roomy>
            {quartersOf(year).map((quarter) => (
              <QuarterColumn key={quarter} quarter={quarter} isNow={quarter === now} heading="h3">
                {inScope.has(quarter) ? (
                  <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
                    <Skeleton className="h-4 w-4/5" />
                    <Skeleton className="h-3 w-3/5" />
                    <Skeleton className="mt-2 h-16 w-full" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ) : (
                  <Skeleton className="mx-1.5 mb-2 h-3 w-6" />
                )}
              </QuarterColumn>
            ))}
          </QuarterGrid>
        </div>
      ))}
    </div>
  );
}
