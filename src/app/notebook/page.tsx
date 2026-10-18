import type { Metadata } from "next";
import { Suspense } from "react";
import { DataGate } from "@/components/app/data-gate";
import { PageHeader } from "@/components/app/page-header";
import { NewNoteButton, NotebookSkeleton } from "@/features/notebook/new-note-button";
import { NotebookView } from "@/features/notebook/notebook-view";

export const metadata: Metadata = { title: "Notebook" };

export default function NotebookPage() {
  return (
    <>
      <PageHeader title="Notebook" action={<NewNoteButton />} />
      {/* NotebookView reads filters and the selected note from the URL (useSearchParams), which needs a Suspense boundary when prerendering. */}
      <Suspense fallback={<NotebookSkeleton />}>
        <DataGate fallback={<NotebookSkeleton />}>
          <NotebookView />
        </DataGate>
      </Suspense>
    </>
  );
}
