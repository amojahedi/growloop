import { DataGate } from "@/components/app/data-gate";
import { PageHeader } from "@/components/app/page-header";
import { DashboardView } from "@/features/dashboard/dashboard-view";

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" description="Your learning this month." />
      <DataGate>
        <DashboardView />
      </DataGate>
    </>
  );
}
