"use client";

import { useEffect } from "react";
import { ReviewBanner } from "../review/review-banner";
import { DashboardGrid } from "./dashboard-grid";
import { useLayoutEditor } from "./layout-editor";

export function DashboardView() {
  const stopEditing = useLayoutEditor((state) => state.stop);
  // Leaving the page mid-edit discards the draft, like Cancel.
  useEffect(() => stopEditing, [stopEditing]);

  return (
    <div className="flex flex-col gap-6">
      <ReviewBanner />
      <DashboardGrid />
    </div>
  );
}
