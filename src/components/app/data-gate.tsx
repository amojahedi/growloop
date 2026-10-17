"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { TodayContext, useClockDay } from "@/lib/store/hooks";
import { useStoreHydrated } from "@/lib/store/hydration";

/**
 * Renders its children only on the client, once saved data is loaded and
 * today's date is known. Everything that reads the store or the calendar
 * belongs inside, which keeps server HTML and the first client render identical.
 */
export function DataGate({ children, fallback = <PageSkeleton /> }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const hydrated = useStoreHydrated();
  const today = useClockDay();

  if (!hydrated || !today) return fallback;
  return <TodayContext value={today}>{children}</TodayContext>;
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
