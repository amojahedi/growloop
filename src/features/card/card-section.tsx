"use client";

import { cn } from "cn";
import { ChevronRightIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { SECTION_HEADING } from "@/components/notes/note-editor";

/** A titled drawer section: small muted heading, optional detail on the right. */
export function CardSection({
  title,
  detail,
  children,
  className,
}: {
  title: string;
  detail?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className={cn("flex flex-col gap-2", className)}>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <h3 id={headingId} className={SECTION_HEADING}>
          {title}
        </h3>
        {detail}
      </div>
      {children}
    </section>
  );
}

/** A collapsed-by-default section (About this material, Time): a heading button that shows and hides it. */
export function Disclosure({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const contentId = useId();

  return (
    <section className="flex flex-col gap-3 border-t pt-4">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={contentId}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            SECTION_HEADING,
            "flex w-full items-center gap-1.5 rounded-md py-1 text-left outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
          )}
        >
          <ChevronRightIcon aria-hidden className={cn("size-4 transition-transform motion-reduce:transition-none", open && "rotate-90")} />
          {title}
        </button>
      </h3>
      <div id={contentId} hidden={!open} className="flex flex-col gap-3">
        {open && children}
      </div>
    </section>
  );
}
