"use client";

import { ExternalLinkIcon } from "lucide-react";
import { SkillImpact } from "@/components/skills/skill-impact";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Material } from "@/lib/domain/types";
import { ResourceActions } from "./resource-actions";
import { metaLine, ResourceBadges } from "./resource-meta";

/**
 * The brief drawer (RS-3): what it covers, who it's for, takeaways, length,
 * link, the same two actions, and which skills it builds and how strongly (S-4).
 */
export function ResourceBrief({
  material,
  onClose,
}: {
  material: Material | undefined;
  onClose: () => void;
}) {
  return (
    <Dialog open={material !== undefined} onOpenChange={(open) => !open && onClose()}>
      {material && (
        <DialogContent side="right">
          <DialogHeader>
            <ResourceBadges material={material} />
            <DialogTitle className="text-lg">{material.title}</DialogTitle>
            <DialogDescription>{metaLine(material)}</DialogDescription>
          </DialogHeader>

          <ResourceActions material={material} />
          {material.skillIds.length > 0 && (
            <BriefSection title="Skill impact">
              <SkillImpact material={material} className="max-w-sm" />
            </BriefSection>
          )}

          {material.summary && <BriefSection title="What it covers">{material.summary}</BriefSection>}
          {material.audience && <BriefSection title="Who it's for">{material.audience}</BriefSection>}
          {material.keyTakeaways.length > 0 && (
            <BriefSection title="Key takeaways">
              <ul className="list-disc space-y-1 pl-4">
                {material.keyTakeaways.map((takeaway) => (
                  <li key={takeaway}>{takeaway}</li>
                ))}
              </ul>
            </BriefSection>
          )}

          {material.url && (
            <a
              href={material.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Open resource
              <ExternalLinkIcon aria-hidden className="size-3.5" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </DialogContent>
      )}
    </Dialog>
  );
}

function BriefSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-medium text-muted-foreground uppercase">{title}</h3>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}
