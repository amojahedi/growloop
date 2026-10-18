import { CompassIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Not found" };

/** Unknown routes (navigation-and-empty-states.md §Routes), inside the app shell. */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <CompassIcon className="size-6" aria-hidden />
      </span>
      <h1 className="font-display text-2xl font-semibold tracking-tight">This page doesn&apos;t exist.</h1>
      <Link href="/" className={cn(buttonVariants({ size: "lg" }), "h-10 rounded-full px-4")}>
        Go to your dashboard
      </Link>
    </div>
  );
}
