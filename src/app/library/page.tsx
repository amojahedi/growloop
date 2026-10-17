import type { Metadata } from "next";
import { DataGate } from "@/components/app/data-gate";
import { PageHeader } from "@/components/app/page-header";
import { LibraryView } from "@/features/library/library-view";

export const metadata: Metadata = { title: "Library" };

export default function LibraryPage() {
  return (
    <>
      <PageHeader title="Library" description="Curated courses, books, articles and podcasts for product people." />
      <DataGate>
        <LibraryView />
      </DataGate>
    </>
  );
}
