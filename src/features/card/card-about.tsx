"use client";

import { CheckIcon, PencilIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Material } from "@/lib/domain/types";
import { COST_LABELS, LEVEL_LABELS } from "../library/labels";
import { Disclosure } from "./card-section";
import { EditDetailsDialog } from "./edit-details-dialog";

/**
 * About this material (C-1), collapsed by default: the brief from the catalog
 * or the user's own material. Own materials offer Edit details. The length is
 * in hours, so it lives in the Time section (hours appear nowhere else, ADR 006).
 */
export function CardAbout({ material }: { material: Material }) {
  const [editing, setEditing] = useState(false);
  const facts: [string, string][] = [
    ["Level", LEVEL_LABELS[material.level]],
    ["Cost", COST_LABELS[material.cost]],
  ];

  return (
    <Disclosure title="About this material">
      {material.tagline && (
        <p className="border-l-3 border-brand/40 pl-3 font-display text-base leading-relaxed italic">{material.tagline}</p>
      )}
      {material.summary && <BriefBlock title="What it covers">{material.summary}</BriefBlock>}
      {material.audience && <BriefBlock title="Who it's for">{material.audience}</BriefBlock>}
      {material.keyTakeaways.length > 0 && (
        <BriefBlock title="Key takeaways">
          <ul className="flex flex-col gap-1.5">
            {material.keyTakeaways.map((takeaway) => (
              <li key={takeaway} className="flex gap-2">
                <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-chart-2" />
                {takeaway}
              </li>
            ))}
          </ul>
        </BriefBlock>
      )}
      <dl className="grid grid-cols-2 gap-2">
        {facts.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-muted/50 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      {!material.curated && (
        <>
          <Button variant="outline" size="sm" className="self-start" onClick={() => setEditing(true)}>
            <PencilIcon aria-hidden />
            Edit details
          </Button>
          <EditDetailsDialog material={material} open={editing} onOpenChange={setEditing} />
        </>
      )}
    </Disclosure>
  );
}

function BriefBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <h4 className="text-xs font-medium text-muted-foreground">{title}</h4>
      <div className="text-sm leading-relaxed">{children}</div>
    </div>
  );
}
