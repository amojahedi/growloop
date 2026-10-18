"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePendingReview } from "@/lib/store/hooks";
import { monthsLabel } from "./labels";
import { MonthReviewDialog } from "./month-review-dialog";

/**
 * "September is done. Wrap it up in a minute." Shown while a month-end review
 * is pending (board.md §Where it shows); never blocks anything. Renders
 * nothing otherwise. Must be inside `<DataGate>`.
 */
export function ReviewBanner() {
  const pending = usePendingReview();
  const [open, setOpen] = useState(false);
  if (!pending) return null;

  const months = monthsLabel(pending.months);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-soft-foreground">
      <p className="flex-1">
        {months} {pending.months.length > 1 ? "are" : "is"} done. Wrap it up in a minute.
      </p>
      <Button size="sm" onClick={() => setOpen(true)}>
        Wrap up {months}
      </Button>
      <MonthReviewDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
