"use client";

import { useEffect, useRef } from "react";

/**
 * "Step 1 of 2" and the step's question. The heading takes focus when the
 * step replaces another one, so keyboard and screen-reader users land on the
 * new question instead of on the page body.
 */
export function StepHeading({ step, title, focusOnMount }: { step: 1 | 2; title: string; focusOnMount: boolean }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focusOnMount) ref.current?.focus();
    // Only on mount: a step heading focuses once, when the step appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Step {step} of 2</p>
      <h2 ref={ref} tabIndex={-1} className="font-display text-xl font-semibold outline-none">
        {title}
      </h2>
    </div>
  );
}
