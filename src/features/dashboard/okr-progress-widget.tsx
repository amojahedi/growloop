"use client";

import { ArrowRightIcon, TargetIcon } from "lucide-react";
import Link from "next/link";
import { Section } from "@/components/app/section";
import { Button } from "@/components/ui/button";
import { formatQuarter, yearOf } from "@/lib/domain/dates";
import { activeObjectives, isPlannable, objectivesForQuarter } from "@/lib/domain/okrs";
import { useMaterialMap, useMonthNavigation, useObjectives, usePlanItems, useToday } from "@/lib/store/hooks";
import { ObjectiveProgressList } from "../okrs/objective-progress-list";

/**
 * Objectives of the viewed month's quarter (D-3). Until an active objective
 * exists it shows the "Set your year" prompt instead (soft gate, O-6).
 */
export function OkrProgressWidget() {
  const items = usePlanItems();
  const objectives = useObjectives();
  const materials = useMaterialMap();
  const today = useToday();
  const { quarter } = useMonthNavigation();

  if (activeObjectives(objectives).length === 0) {
    return (
      <Section title="OKR progress" className="h-full">
        <div className="flex flex-col items-start gap-2">
          <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground">
            <TargetIcon className="size-4" aria-hidden />
          </span>
          <p className="font-display text-base font-semibold">Set your year</p>
          <p className="text-sm text-muted-foreground">Two questions, then a draft plan you can edit.</p>
          <Button asChild size="sm" className="mt-1">
            <Link href="/okrs/plan">Plan my year</Link>
          </Button>
        </div>
      </Section>
    );
  }

  const inQuarter = objectivesForQuarter(objectives, quarter);
  return (
    <Section
      title="OKR progress"
      description={formatQuarter(quarter)}
      className="h-full"
      action={
        <Button asChild variant="ghost" size="sm">
          <Link href={`/okrs?year=${yearOf(quarter)}`}>
            Open OKRs
            <ArrowRightIcon aria-hidden />
          </Link>
        </Button>
      }
    >
      {inQuarter.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing set for {formatQuarter(quarter)}.
          {isPlannable(quarter, today) && (
            <>
              {" "}
              <Link href="/okrs/plan" className="font-semibold text-foreground underline underline-offset-4 hover:text-primary">
                Plan it
              </Link>
            </>
          )}
        </p>
      ) : (
        <ObjectiveProgressList objectives={inQuarter} items={items} materials={materials} today={today} />
      )}
    </Section>
  );
}
