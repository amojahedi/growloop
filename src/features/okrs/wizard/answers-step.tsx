"use client";

import { ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { GOAL_LABELS, PLAN_DRAFT_LIMITS, ROLE_LABELS } from "@/lib/domain/plan-draft";
import { GOAL_IDS, ROLE_IDS, type GoalId, type RoleId } from "@/lib/domain/types";
import { RadioChips } from "../controls/choice-controls";
import { StepHeading } from "./step-heading";

const ROLE_OPTIONS = ROLE_IDS.map((value) => ({ value, label: ROLE_LABELS[value] }));
const GOAL_OPTIONS = GOAL_IDS.map((value) => ({ value, label: GOAL_LABELS[value] }));

export interface AnswersValue {
  role?: RoleId;
  goal?: GoalId;
  goalText?: string;
}

export const answersComplete = (value: AnswersValue): boolean =>
  Boolean(value.role && value.goal && (value.goal !== "other" || value.goalText?.trim()));

/** Step 1 of 2, "Where are you now?" (okrs-and-wizard.md): role, 12-month goal and, with Claude, an optional CV paste. */
export function AnswersStep({
  value,
  onChange,
  claudeAvailable,
  context,
  onContextChange,
  onNext,
  onCancel,
  focusHeading,
}: {
  focusHeading: boolean;
  value: AnswersValue;
  onChange: (patch: AnswersValue) => void;
  /** The context box only exists when Claude can read it. */
  claudeAvailable: boolean;
  context: string;
  onContextChange: (context: string) => void;
  onNext: () => void;
  onCancel: () => void;
}) {
  const complete = answersComplete(value);
  return (
    <form
      className="flex max-w-2xl flex-col gap-7"
      onSubmit={(event) => {
        event.preventDefault();
        if (complete) onNext();
      }}
    >
      <StepHeading step={1} title="Where are you now?" focusOnMount={focusHeading} />

      <RadioChips legend="Your role" options={ROLE_OPTIONS} value={value.role} onChange={(role) => onChange({ role })} />

      <div className="flex flex-col gap-3">
        <RadioChips
          legend="What should the next 12 months get you?"
          options={GOAL_OPTIONS}
          value={value.goal}
          onChange={(goal) => onChange({ goal })}
        />
        {value.goal === "other" && (
          <Input
            aria-label="Your goal, in a few words"
            placeholder="In a few words"
            maxLength={PLAN_DRAFT_LIMITS.goalText}
            value={value.goalText ?? ""}
            onChange={(event) => onChange({ goalText: event.target.value })}
            className="h-9 max-w-sm"
          />
        )}
      </div>

      {claudeAvailable && (
        <details className="group rounded-xl border bg-card open:shadow-xs">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground transition-transform group-open:rotate-90 motion-reduce:transition-none" />
            Add your LinkedIn or CV
            <span className="font-normal text-muted-foreground">(optional)</span>
          </summary>
          <div className="flex flex-col gap-1.5 px-4 pb-4">
            <Textarea
              aria-label="Your LinkedIn or CV"
              aria-describedby="wizard-context-help"
              placeholder="Paste your About section, experience or CV."
              maxLength={PLAN_DRAFT_LIMITS.context}
              value={context}
              onChange={(event) => onContextChange(event.target.value)}
              className="min-h-32"
            />
            <p id="wizard-context-help" className="text-xs text-muted-foreground">
              Claude reads it once for this draft. It isn&apos;t saved.
            </p>
          </div>
        </details>
      )}

      <div className="flex items-center gap-4">
        <Button type="submit" size="lg" disabled={!complete}>
          Next
        </Button>
        <Button type="button" variant="link" className="px-0 text-muted-foreground" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
