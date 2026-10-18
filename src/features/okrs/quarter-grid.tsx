import { cn } from "cn";
import { PlusIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatQuarter, quarterKey } from "@/lib/domain/dates";
import type { QuarterKey } from "@/lib/domain/types";
import { quarterLabel } from "./labels";

/** Q1–Q4 of a year, the layout shared by the OKR page and the wizard's review (so a draft shows the shape of the year). */
export const quartersOf = (year: number): QuarterKey[] => [1, 2, 3, 4].map((quarter) => quarterKey(year, quarter));

export function QuarterGrid({
  children,
  label,
  roomy = false,
}: {
  children: ReactNode;
  label?: string;
  /** For editing (the wizard's review): two columns until the screen has room for four editors. */
  roomy?: boolean;
}) {
  return (
    <div role="list" aria-label={label} className={cn("grid items-start gap-4 md:grid-cols-2", roomy ? "2xl:grid-cols-4" : "xl:grid-cols-4")}>
      {children}
    </div>
  );
}

export function QuarterColumn({
  quarter,
  isNow,
  heading: Heading = "h2",
  collapseOnMobile = false,
  children,
}: {
  quarter: QuarterKey;
  /** The current quarter: labelled "Now" and tinted. */
  isNow: boolean;
  heading?: "h2" | "h3";
  /** A past quarter with nothing in it: hidden on small screens, where columns stack. */
  collapseOnMobile?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      role="listitem"
      aria-label={formatQuarter(quarter)}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-2xl p-2",
        isNow ? "bg-brand-soft/60 ring-1 ring-primary/15" : "bg-muted/40",
        collapseOnMobile && "max-md:hidden",
      )}
    >
      <Heading className="flex items-center gap-2 px-1.5 pt-1 text-sm font-semibold">
        <span>{quarterLabel(quarter)}</span>
        <span className="sr-only">{quarter.slice(0, 4)}</span>
        {isNow && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-semibold text-primary-foreground">Now</span>
        )}
      </Heading>
      {children}
    </section>
  );
}

/** A past quarter with nothing in it. */
export function EmptyQuarter({ children = "—" }: { children?: ReactNode }) {
  return <p className="px-1.5 pb-2 text-sm text-muted-foreground">{children}</p>;
}

/** The dashed "+ Add objective" at the end of a column. */
export function AddObjectiveButton({ onClick, quarter, id }: { onClick: () => void; quarter: QuarterKey; id?: string }) {
  return (
    <button
      id={id}
      type="button"
      onClick={onClick}
      aria-label={`Add objective to ${formatQuarter(quarter)}`}
      className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-dashed border-input text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/50 hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      <PlusIcon className="size-4" aria-hidden />
      Add objective
    </button>
  );
}
