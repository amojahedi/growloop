import { DataGate } from "@/components/app/data-gate";
import { PageHeader } from "@/components/app/page-header";
import { MonthSwitcher } from "@/components/layout/month-switcher";
import { CustomizeToolbar } from "@/features/dashboard/customize-toolbar";
import { DashboardView } from "@/features/dashboard/dashboard-view";

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your learning this month."
        action={
          <div className="flex flex-wrap items-center gap-2">
            <MonthSwitcher />
            <DataGate fallback={null}>
              <CustomizeToolbar />
            </DataGate>
          </div>
        }
      />
      <DataGate>
        <DashboardView />
      </DataGate>
    </>
  );
}
