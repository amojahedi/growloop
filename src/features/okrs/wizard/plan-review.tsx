"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { formatQuarter, quarterOfDay, weeksLeftInQuarter, yearOf, type DayKey } from "@/lib/domain/dates";
import { MIN_WEEKS_TO_PLAN_CURRENT_QUARTER, roomInYear } from "@/lib/domain/okrs";
import type { DraftSource } from "@/lib/domain/plan-draft";
import type { Material, Objective, QuarterKey, Skill } from "@/lib/domain/types";
import {
  allProblems,
  blankObjective,
  fieldIds,
  fixLabel,
  type EditorLookup,
  type ObjectiveForm,
  type ReviewDraft,
} from "../editor-model";
import { focusSoon } from "../focus";
import { ObjectiveEditor } from "../objective-editor";
import { ObjectiveMenu } from "../objective-menu";
import { AddObjectiveButton, EmptyQuarter, QuarterColumn, QuarterGrid, quartersOf } from "../quarter-grid";

/**
 * The review (okrs-and-wizard.md §Review screen): the draft in quarter
 * columns like the OKR page, every objective editable inline with the shared
 * ObjectiveEditor, and one "Accept all" that saves nothing while problems remain.
 */
export function PlanReview({
  draft,
  source,
  scope,
  today,
  saved,
  lookup,
  skills,
  materials,
  showAllProblems,
  onChange,
  onBack,
  onAccept,
  onRestore,
}: {
  draft: ReviewDraft;
  source: DraftSource;
  scope: readonly QuarterKey[];
  today: DayKey;
  /** Objectives already saved (for the yearly cap and the other quarters' columns). */
  saved: readonly Objective[];
  lookup: EditorLookup;
  skills: readonly Skill[];
  materials: readonly Material[];
  showAllProblems: boolean;
  onChange: (draft: ReviewDraft) => void;
  onBack: () => void;
  onAccept: () => void;
  /** Puts a removed objective back into the current draft (Undo). */
  onRestore: (form: ObjectiveForm, index: number) => void;
}) {
  const forms = draft.objectives;
  const problems = allProblems(forms, saved, lookup);
  const inScope = new Set(scope);
  const years = [...new Set(scope.map(yearOf))];
  const now = quarterOfDay(today);

  const setForms = (objectives: ObjectiveForm[]) => onChange({ ...draft, objectives });
  const replace = (form: ObjectiveForm) => setForms(forms.map((candidate) => (candidate.key === form.key ? form : candidate)));
  const roomLeft = (year: number) => roomInYear(saved, year) - forms.filter((form) => yearOf(form.quarter) === year).length;

  const add = (quarter: QuarterKey) => {
    const form = blankObjective(quarter);
    setForms([...forms, form]);
    focusSoon(fieldIds.title(form));
  };
  const move = (form: ObjectiveForm, quarter: QuarterKey) => {
    replace({ ...form, quarter });
    focusSoon(fieldIds.menu(form));
  };
  const remove = (form: ObjectiveForm) => {
    const index = forms.indexOf(form);
    setForms(forms.filter((candidate) => candidate.key !== form.key));
    focusSoon(`review-add-${form.quarter}`);
    toast({
      message: "Objective removed.",
      action: {
        label: "Undo",
        onClick: () => onRestore(form, index),
      },
    });
  };

  const acceptLabel = forms.length === 0 ? "Add an objective to accept" : problems.length > 0 ? fixLabel(problems.length) : "Accept all";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 text-sm">
        {draft.rationale && <p>{draft.rationale}</p>}
        {source === "quick" && (
          <p className="text-muted-foreground">
            Quick draft from your answers.{" "}
            <Link href="/settings#claude" className="font-semibold text-foreground underline underline-offset-4 hover:text-primary">
              Turn on Claude
            </Link>{" "}
            for a more personal plan.
          </p>
        )}
      </div>

      {years.map((year) => (
        <section key={year} aria-labelledby={`review-year-${year}`} className="flex flex-col gap-3">
          <h2 id={`review-year-${year}`} className="font-display text-lg font-semibold">
            {year}
          </h2>
          <QuarterGrid label={`${year} by quarter`} roomy>
            {quartersOf(year).map((quarter) => {
              const here = forms.filter((form) => form.quarter === quarter);
              const existing = saved.filter((objective) => objective.quarter === quarter);
              return (
                <QuarterColumn key={quarter} quarter={quarter} isNow={quarter === now} heading="h3">
                  {existing.map((objective) => (
                    <div key={objective.id} className="rounded-xl border border-dashed bg-card/60 px-3 py-2 text-sm">
                      <p className="font-medium leading-snug">{objective.title}</p>
                      <p className="text-xs text-muted-foreground">Already in your plan</p>
                    </div>
                  ))}
                  {here.map((form) => (
                    <ObjectiveEditor
                      key={form.key}
                      label={`Objective for ${formatQuarter(quarter)}`}
                      value={form}
                      onChange={replace}
                      lookup={lookup}
                      skills={skills}
                      materials={materials}
                      problems={problems.filter((problem) => problem.fieldId.startsWith(`objective-${form.key}-`))}
                      showAllProblems={showAllProblems}
                      menu={
                        <ObjectiveMenu
                          triggerId={fieldIds.menu(form)}
                          objectiveTitle={form.title}
                          moveTargets={scope.filter((target) => target !== quarter && !forms.some((other) => other.quarter === target))}
                          onMove={(target) => move(form, target)}
                          removeLabel="Remove objective"
                          onRemove={() => remove(form)}
                        />
                      }
                    />
                  ))}
                  {inScope.has(quarter) && roomLeft(year) > 0 && (
                    <AddObjectiveButton id={`review-add-${quarter}`} quarter={quarter} onClick={() => add(quarter)} />
                  )}
                  {!inScope.has(quarter) && here.length === 0 && existing.length === 0 && (
                    <EmptyQuarter>
                      {quarter === now && weeksLeftInQuarter(today) < MIN_WEEKS_TO_PLAN_CURRENT_QUARTER
                        ? "Fewer than 6 weeks left, so it's skipped."
                        : "—"}
                    </EmptyQuarter>
                  )}
                </QuarterColumn>
              );
            })}
          </QuarterGrid>
        </section>
      ))}

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <Button variant="ghost" size="lg" onClick={onBack}>
          Back
        </Button>
        <Button size="lg" onClick={onAccept} aria-describedby={problems.length > 0 ? "review-accept-hint" : undefined}>
          {acceptLabel}
        </Button>
        {problems.length > 0 && (
          <span id="review-accept-hint" className="sr-only">
            Nothing is saved until every problem is fixed.
          </span>
        )}
      </div>
    </div>
  );
}
