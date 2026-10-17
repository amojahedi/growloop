import type { Metadata } from "next";
import { DataGate } from "@/components/app/data-gate";
import { PageHeader } from "@/components/app/page-header";
import { OkrsView } from "@/features/okrs/okrs-view";

export const metadata: Metadata = { title: "OKRs" };

export default function OkrsPage() {
  return (
    <>
      <PageHeader title="OKRs" description="Quarterly objectives and the key results that measure them." />
      <DataGate>
        <OkrsView />
      </DataGate>
    </>
  );
}
