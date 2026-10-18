import type { Metadata } from "next";
import { Suspense } from "react";
import { DataGate } from "@/components/app/data-gate";
import { PageHeader } from "@/components/app/page-header";
import { OkrsHeaderAction, OkrsView } from "@/features/okrs/okrs-view";

export const metadata: Metadata = { title: "OKRs" };

export default function OkrsPage() {
  return (
    <>
      <PageHeader
        title="OKRs"
        description="Your year, a quarter at a time."
        action={
          <DataGate fallback={null}>
            <OkrsHeaderAction />
          </DataGate>
        }
      />
      {/* The year tab comes from ?year= (useSearchParams), which needs a Suspense boundary when prerendering. */}
      <Suspense>
        <DataGate>
          <OkrsView />
        </DataGate>
      </Suspense>
    </>
  );
}
