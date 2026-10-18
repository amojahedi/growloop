import type { Metadata } from "next";
import { Suspense } from "react";
import { DataGate } from "@/components/app/data-gate";
import { PageHeader } from "@/components/app/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { BoardMonthSwitcher } from "@/features/board/board-month-switcher";
import { BoardView } from "@/features/board/board-view";

export const metadata: Metadata = { title: "Board" };

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
      <Suspense>
        <DataGate>
          <BoardView />
        </DataGate>
      </Suspense>
    </>
  );
}
