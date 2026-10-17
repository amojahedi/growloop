"use client";

import { useState } from "react";
import { Section } from "@/components/app/section";
import { Button } from "@/components/ui/button";
import { formatMonth, monthOf } from "@/lib/domain/dates";
import { bulkDecisions, pendingRollover } from "@/lib/domain/rollover";
import type { ID, RolloverDecision } from "@/lib/domain/types";
import { useActions, useMaterialMap, usePlanItems, useToday } from "@/lib/store/hooks";

const DECISIONS: { value: RolloverDecision; label: string }[] = [
  { value: "carry_over", label: "Carry over" },
  { value: "backlog", label: "Backlog" },
  { value: "drop", label: "Drop" },
];

/** Month-end review of unfinished items (R-1). Renders nothing when there is nothing to review. */
export function RolloverReview() {
  const items = usePlanItems();
  const materials = useMaterialMap();
  const currentMonth = monthOf(useToday());
  const { applyRollover } = useActions();
  const [decisions, setDecisions] = useState<Record<ID, RolloverDecision>>({});

  const pending = pendingRollover(items, currentMonth);
  if (!pending) return null;

  const decided = pending.items.filter((item) => decisions[item.id]).length;
  const apply = () => {
    applyRollover(currentMonth, decisions);
    setDecisions({});
  };

  return (
    <Section
      title={`Review unfinished items before ${formatMonth(currentMonth)}`}
      description={`${pending.items.length} item(s) from ${pending.fromMonths.map((m) => formatMonth(m)).join(", ")}`}
    >
      <div className="mb-3 flex flex-wrap gap-2">
        {DECISIONS.map(({ value, label }) => (
          <Button key={value} variant="outline" size="sm" onClick={() => setDecisions(bulkDecisions(pending.items, value))}>
            {label} all
          </Button>
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {pending.items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>{materials.get(item.materialId)?.title ?? "Unknown material"}</span>
            <select
              aria-label="Decision"
              className="rounded-md border bg-background px-2 py-1"
              value={decisions[item.id] ?? ""}
              onChange={(event) =>
                setDecisions((current) => ({ ...current, [item.id]: event.target.value as RolloverDecision }))
              }
            >
              <option value="" disabled>
                Decide…
              </option>
              {DECISIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
      <Button className="mt-4" onClick={apply} disabled={decided === 0}>
        Apply {decided > 0 ? `${decided} decision(s)` : ""}
      </Button>
    </Section>
  );
}
