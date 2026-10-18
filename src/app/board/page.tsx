import type { Metadata } from "next";
import { Suspense } from "react";
import { DataGate } from "@/components/app/data-gate";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BoardMonthSwitcher } from "@/features/board/board-month-switcher";
import { BoardView } from "@/features/board/board-view";

export const metadata: Metadata = { title: "Board" };

/** Board-shaped placeholder while the URL and saved data load. */
function BoardSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-7 w-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((column) => (
          <Skeleton key={column} className="h-80 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

export default function BoardPage() {
  return (
    <>
      <PageHeader
        title="Board"
        action={
          <DataGate fallback={<Skeleton className="h-9 w-52" />}>
            <BoardMonthSwitcher />
          </DataGate>
        }
      />
      {/* BoardView reads the open card from the URL (useSearchParams), which needs a Suspense boundary when prerendering. */}
      <Suspense fallback={<BoardSkeleton />}>
        <DataGate fallback={<BoardSkeleton />}>
          <BoardView />
        </DataGate>
      </Suspense>
    </>
  );
}
