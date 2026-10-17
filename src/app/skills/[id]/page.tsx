import type { Metadata } from "next";
import { Suspense } from "react";
import { DataGate } from "@/components/app/data-gate";
import { SkillDetailView } from "@/features/skills/skill-detail-view";

export const metadata: Metadata = { title: "Skill" };

export default function SkillPage({ params }: PageProps<"/skills/[id]">) {
  // Skills live in the browser, so the id is only known at request time; Suspense keeps the shell static.
  return (
    <Suspense>
      {params.then(({ id }) => (
        <DataGate>
          <SkillDetailView skillId={decodeURIComponent(id)} />
        </DataGate>
      ))}
    </Suspense>
  );
}
