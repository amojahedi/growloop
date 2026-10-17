import type { Metadata } from "next";
import { DataGate } from "@/components/app/data-gate";
import { PageHeader } from "@/components/app/page-header";
import { SkillsView } from "@/features/skills/skills-view";

export const metadata: Metadata = { title: "Skills" };

export default function SkillsPage() {
  return (
    <>
      <PageHeader title="Skills" description="The product skills you're investing in." />
      <DataGate>
        <SkillsView />
      </DataGate>
    </>
  );
}
