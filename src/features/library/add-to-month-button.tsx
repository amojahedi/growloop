"use client";

import { Button } from "@/components/ui/button";
import { formatMonth } from "@/lib/domain/dates";
import type { ID } from "@/lib/domain/types";
import { useActions, useMonthNavigation, usePlanItems } from "@/lib/store/hooks";

/** One-click "Add to month" (L-4, S-3) for the month being viewed. */
export function AddToMonthButton({
  materialId,
  materialTitle,
  keyResultId,
}: {
  materialId: ID;
  /** Makes the button's accessible name unique in lists. */
  materialTitle: string;
  keyResultId?: ID;
}) {
  const { month } = useMonthNavigation();
  const { addPlanItem } = useActions();
  const alreadyPlanned = usePlanItems().some((item) => item.materialId === materialId && item.month === month);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={alreadyPlanned}
      onClick={() => addPlanItem(materialId, month, { keyResultId })}
      aria-label={
        alreadyPlanned ? `"${materialTitle}" is in your plan` : `Add "${materialTitle}" to ${formatMonth(month)}`
      }
    >
      {alreadyPlanned ? "In plan" : `Add to ${formatMonth(month)}`}
    </Button>
  );
}
