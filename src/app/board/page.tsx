import type { Metadata } from "next";
import { DataGate } from "@/components/app/data-gate";
import { PageHeader } from "@/components/app/page-header";
import { BoardView } from "@/features/board/board-view";

export const metadata: Metadata = { title: "Board" };

export default function BoardPage() {
  return (
    <>
      <PageHeader title="Board" description="Move learning items from backlog to done." />
      <DataGate>
        <BoardView />
      </DataGate>
    </>
  );
}
