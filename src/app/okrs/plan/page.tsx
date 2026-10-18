import type { Metadata } from "next";
import { Suspense } from "react";
import { DataGate } from "@/components/app/data-gate";
import { PlanWizard } from "@/features/okrs/wizard/plan-wizard";

export const metadata: Metadata = { title: "Set your year" };

export default function PlanYourYearPage() {
  return (
    // The wizard reads ?from= (useSearchParams), which needs a Suspense boundary when prerendering.
    <Suspense>
      <DataGate>
        <PlanWizard />
      </DataGate>
    </Suspense>
  );
}
