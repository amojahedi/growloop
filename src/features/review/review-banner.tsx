"use client";

import { CalendarCheckIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { usePendingReview } from "@/lib/store/hooks";
import { monthsLabel } from "./labels";
import { MonthReviewDialog } from "./month-review-dialog";
import { banner } from "./review-model";

/**
 * "September is done. Wrap it up in a minute." Shown above the board columns
 * (and on the Dashboard until its header gets the Wrap up button) while a
 * month-end review is pending (board.md §Where it shows). Never blocks
 * anything; renders nothing otherwise. Must be inside `<DataGate>`.
 */
export function ReviewBanner() {
  const pending = usePendingReview();
  const [open, setOpen] = useState(false);
  if (!pending) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-soft-foreground">
      <CalendarCheckIcon aria-hidden className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">{banner(pending.months)}</p>
      <Button size="sm" onClick={() => setOpen(true)}>
        Wrap up {monthsLabel(pending.months)}
      </Button>
      <MonthReviewDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
