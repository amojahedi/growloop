"use client";

import { CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { requestTour } from "./tour-store";

/** Starts the tour; it goes to the Dashboard first when needed. */
export function TakeTourButton({ label }: { label: string }) {
  return (
    <Button size="lg" className="h-10 rounded-full px-4" onClick={() => requestTour("help")}>
      <CompassIcon aria-hidden />
      {label}
    </Button>
  );
}
