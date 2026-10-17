"use client";

import { useEffect } from "react";
import { RolloverReview } from "../rollover/rollover-review";
import { DashboardGrid } from "./dashboard-grid";
import { useLayoutEditor } from "./layout-editor";

export function DashboardView() {
  const stopEditing = useLayoutEditor((state) => state.stop);
  // Leaving the page mid-edit discards the draft, like Cancel.
  useEffect(() => stopEditing, [stopEditing]);

  return (
    <div className="flex flex-col gap-6">
      <RolloverReview />
      <DashboardGrid />
    </div>
  );
}
