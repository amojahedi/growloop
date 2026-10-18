"use client";

import { cn } from "cn";
import { ArrowRightIcon, AwardIcon, CheckIcon, CornerDownRightIcon, HashIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { MATERIAL_TYPE_ICONS } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatMonth } from "@/lib/domain/dates";
import { keyResultProgress } from "@/lib/domain/okrs";
import type { KeyResult, Material, Objective, PlanItem, Skill } from "@/lib/domain/types";
import { useActions, useLibraryIds, useMonthNavigation } from "@/lib/store/hooks";
import { SkillChip } from "./controls/skill-controls";
import { BOARD_STATUS_LABELS, keyResultStatus } from "./labels";

/**
 * One key result on the OKR page (okrs-and-wizard.md §Objective card): skill,
 * type, title and computed progress, the linked card, and the one next step:
 * Add (a target not on the board), Find resources (count) or Mark as earned.
 */
export function KeyResultRow({
  keyResult,
  objective,
  items,
  material,
  skill,
  editable,
  onPickAnother,
}: {
  keyResult: KeyResult;
  objective: Objective;
  items: readonly PlanItem[];
  /** The target material (material and certification KRs), if it still exists. */
  material: Material | undefined;
  skill: Skill | undefined;
  /** Active and not archived: actions are offered. */
  editable: boolean;
  /** Opens the editor ("Material missing" → Pick another). */
  onPickAnother?: () => void;
}) {
  const { addPlanItem, removePlanItem, saveMaterial, unsaveMaterial, setItemEarned } = useActions();
  const { currentMonth } = useMonthNavigation();
  const libraryIds = useLibraryIds();
  const progress = keyResultProgress(keyResult, objective, items);
  const missing = keyResult.type !== "count" && !material;

  const TypeIcon =
    keyResult.type === "count" ? HashIcon : material ? MATERIAL_TYPE_ICONS[material.type] : keyResult.type === "certification" ? AwardIcon : HashIcon;
  const typeName = keyResult.type === "count" ? "Count" : keyResult.type === "certification" ? "Certification" : "Material";

  const add = () => {
    if (!material) return;
    const itemId = addPlanItem(material.id, currentMonth, { keyResultId: keyResult.id });
    if (!itemId) return;
    const savedByAdd = material.curated && !libraryIds.has(material.id);
    if (savedByAdd) saveMaterial(material.id);
    toast({
      message: `Added to ${formatMonth(currentMonth).split(" ")[0]}.`,
      action: {
        label: "Undo",
        onClick: () => {
          removePlanItem(itemId);
          if (savedByAdd) unsaveMaterial(material.id);
        },
      },
    });
  };

  const linked = progress.type !== "count" ? progress.item : undefined;
  const status = missing ? "Material missing" : keyResultStatus(progress);

  return (
    <li className="flex flex-col gap-1 border-t pt-2.5 first:border-t-0 first:pt-0">
      <SkillChip skill={skill} skillId={keyResult.skillId} className="self-start" />
      <div className="flex items-start gap-2 text-sm">
        <TypeIcon aria-hidden className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
        <span className="sr-only">{typeName}:</span>
        <span className="min-w-0 flex-1 leading-snug">{keyResult.title}</span>
      </div>
      <p className={cn("flex items-center gap-1 pl-5.5 text-xs font-medium tabular-nums", progress.met ? "text-foreground" : "text-muted-foreground", missing && "text-destructive")}>
        {progress.met && <CheckIcon aria-hidden className="size-3.5 text-chart-2" />}
        {status}
      </p>

      {linked && (
        <Link
          href={`/board?item=${encodeURIComponent(linked.id)}`}
          className="ml-5.5 flex min-w-0 items-center gap-1 rounded-sm text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <CornerDownRightIcon aria-hidden className="size-3 shrink-0" />
          <span className="truncate">{material?.title ?? "Linked card"}</span>
          <span className="shrink-0">· {BOARD_STATUS_LABELS[linked.status]}</span>
        </Link>
      )}

      {editable && (
        <div className="pl-5">
          {missing ? (
            onPickAnother && (
              <Button variant="link" size="xs" className="px-0.5" onClick={onPickAnother}>
                Pick another
              </Button>
            )
          ) : keyResult.type === "count" ? (
            <Button variant="link" size="xs" className="px-0.5" asChild>
              <Link href={`/library?skill=${encodeURIComponent(keyResult.skillId)}`}>
                Find resources
                <ArrowRightIcon aria-hidden />
              </Link>
            </Button>
          ) : !linked ? (
            <Button variant="outline" size="xs" onClick={add} aria-label={`Add "${material?.title}" to your board`}>
              <PlusIcon aria-hidden />
              Add
            </Button>
          ) : progress.type === "certification" && progress.awaitingEarned ? (
            <Button variant="outline" size="xs" onClick={() => setItemEarned(linked.id, true)}>
              <AwardIcon aria-hidden />
              Mark as earned
            </Button>
          ) : null}
        </div>
      )}
    </li>
  );
}
