"use client";

import { Button } from "@/components/ui/button";
import { formatMonth } from "@/lib/domain/dates";
import type { ID } from "@/lib/domain/types";
import { useActions, useMonthNavigation, usePlanItems } from "@/lib/store/hooks";

/** One-click "Add to month" (L-4, S-3) for the month being viewed. */
export function AddToMonthButton({ materialId, keyResultId }: { materialId: ID; keyResultId?: ID }) {
  const { month } = useMonthNavigation();
  const { addPlanItem } = useActions();
  const alreadyPlanned = usePlanItems().some((item) => item.materialId === materialId && item.month === month);

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={alreadyPlanned}
      onClick={() => addPlanItem(materialId, month, { keyResultId })}
    >
      {alreadyPlanned ? "In plan" : `Add to ${formatMonth(month)}`}
    </Button>
  );
}
