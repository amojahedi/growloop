import type { Metadata } from "next";
import { Suspense } from "react";
import { DataGate } from "@/components/app/data-gate";
import { PageHeader } from "@/components/app/page-header";
import { LibraryView } from "@/features/library/library-view";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <>
      <PageHeader
        title="Library"
        description="Curated courses, certifications, books, articles and podcasts for product people, plus your own finds."
      />
      {/* LibraryView reads filters from the URL (useSearchParams), which needs a Suspense boundary when prerendering. */}
      <Suspense>
        <DataGate>
          <LibraryView />
        </DataGate>
      </Suspense>
    </>
  );
}
