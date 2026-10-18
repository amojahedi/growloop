"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { buildDraftPlanRequest } from "@/lib/ai/draft-plan-request";
import type { AIRequestError } from "@/lib/ai/request-error";
import { useAI } from "@/lib/ai/use-ai";
import { yearOf } from "@/lib/domain/dates";
import { wizardScope } from "@/lib/domain/okrs";
import type { DraftSource, PlanDraft, WizardAnswers } from "@/lib/domain/plan-draft";
import { quickDraft } from "@/lib/domain/plan-drafter";
import { repairDraft } from "@/lib/domain/plan-repair";
import { useActions, useObjectives, usePlanItems, useProfile, useSkills, useToday } from "@/lib/store/hooks";
import { useUIStore, type WizardSession } from "@/lib/store/ui-store";
import { draftFromForms, validateForms, formFromDraft, reviewDraftFrom, type ObjectiveForm, type ReviewDraft } from "../editor-model";
import { focusSoon } from "../focus";
import { pluralize, scopeYearsPhrase, scopeYearsRange } from "../labels";
import { useEditorData } from "../use-editor-data";
import { AnswersStep, answersComplete, type AnswersValue } from "./answers-step";
import { DraftFailedView, DraftingView, QuickDraftFailedView } from "./drafting-view";
import { PlanReview } from "./plan-review";
import { SkillsStep, skillsComplete } from "./skills-step";

/**
 * The OKR wizard at /okrs/plan (okrs-and-wizard.md §2, O-3, O-7): two
 * question steps, then a draft from Claude when it's available or from the
 * quick draft otherwise, both repaired by the same step and reviewed on the
 * same screen. Answers and the draft live in the wizard session (UI store);
 * the pasted CV stays in this component's memory only.
 */

type Drafting =
  | { kind: "idle" }
  | { kind: "drafting" }
  | { kind: "failed"; reason?: string }
  /** The quick draft found nothing to plan (it can't fail otherwise, but the review must never show an empty plan). */
  | { kind: "quick-failed" };

const REVIEW_HEADING_ID = "wizard-review-heading";

/** What a failed Claude draft tells the user, when there's something useful to say. */
function failureReason(error: AIRequestError): string | undefined {
  switch (error.code) {
    case "key-rejected":
    case "rate-limited":
    case "network":
    case "forbidden":
    case "off":
      return error.message;
    case "timeout":
      return "Claude took longer than a minute.";
    default:
      return undefined;
  }
}

export function PlanWizard() {
  const today = useToday();
  const objectives = useObjectives();
  const items = usePlanItems();
  const profile = useProfile();
  const allSkills = useSkills({ includeHidden: true });
  const { materials, visibleSkills, lookup } = useEditorData();
  const { acceptPlan, undoAcceptPlan } = useActions();
  const wizard = useUIStore((state) => state.wizard);
  const updateWizard = useUIStore((state) => state.updateWizard);
  const resetWizard = useUIStore((state) => state.resetWizard);
  const ai = useAI();
  const router = useRouter();
  const fromWelcome = useSearchParams().get("from") === "welcome";

  const claude = ai.provider !== null;
  const checking = ai.provider === null && ai.status.state === "checking";
  const scope = useMemo(() => wizardScope(objectives, today), [objectives, today]);

  // Never stored: kept in memory for this visit only (okrs-and-wizard.md, step 1).
  const [context, setContext] = useState("");
  const contextUsed = useRef("");
  const [drafting, setDrafting] = useState<Drafting>({ kind: "idle" });
  const [showAllProblems, setShowAllProblems] = useState(false);
  // After Accept all the store has the objectives (so the scope empties) until navigation lands.
  const [accepted, setAccepted] = useState(false);
  // Step headings take focus only when a step replaces another, not on the first render.
  const [moved, setMoved] = useState(false);
  const pendingDraft = useRef(false);

  const review = useMemo(() => reviewDraftFrom(wizard.draft?.plan), [wizard.draft]);
  const step = wizard.step === "review" && !review ? "skills" : wizard.step;

  // Answers prefill from the saved profile on re-runs.
  const answersValue: AnswersValue = {
    role: wizard.role ?? profile.role,
    goal: wizard.goal ?? profile.goal,
    goalText: wizard.goalText ?? profile.goalText,
  };
  const answers: WizardAnswers | undefined =
    answersComplete(answersValue) && skillsComplete(wizard.skills)
      ? {
          role: answersValue.role!,
          goal: answersValue.goal!,
          ...(answersValue.goal === "other" ? { goalText: answersValue.goalText?.trim() } : {}),
          skills: wizard.skills,
        }
      : undefined;

  const goTo = (next: WizardSession["step"]) => {
    setMoved(true);
    updateWizard({ step: next });
  };

  const cancel = () => {
    if (fromWelcome || window.history.length <= 1) router.push("/");
    else router.back();
  };

  const repairContext = (forAnswers: WizardAnswers) => ({
    scope,
    answers: forAnswers,
    skills: allSkills,
    materials,
    objectives,
    items,
    today,
  });

  const showDraft = (plan: PlanDraft, source: DraftSource, basis: string) => {
    const replacing = Boolean(wizard.draft);
    const draft: ReviewDraft = { rationale: plan.rationale, objectives: plan.objectives.map(formFromDraft), basis };
    setDrafting({ kind: "idle" });
    setShowAllProblems(false);
    setMoved(true);
    updateWizard({ step: "review", draft: { plan: draft, source } });
    focusSoon(REVIEW_HEADING_ID);
    if (replacing) toast({ message: "New draft ready." });
  };

  const draftQuick = (forAnswers: WizardAnswers, basis: string) => {
    // Cancels a Claude request in flight ("Use the quick draft instead").
    ai.draftPlan.reset();
    const plan = quickDraft({ answers: forAnswers, scope, today, skills: allSkills, materials, items, objectives });
    const repaired = repairDraft(plan, repairContext(forAnswers));
    contextUsed.current = context;
    if (repaired.ok) showDraft(repaired.draft, "quick", basis);
    else setDrafting({ kind: "quick-failed" });
  };

  const draftWithClaude = async (forAnswers: WizardAnswers, basis: string) => {
    setDrafting({ kind: "drafting" });
    const request = buildDraftPlanRequest({ answers: forAnswers, scope, today, skills: allSkills, materials, items, context });
    const result = await ai.draftPlan.run(request);
    if (!result) {
      const error = ai.draftPlan.lastError();
      // No error: cancelled for the quick draft, or the page went away.
      if (error) setDrafting({ kind: "failed", reason: failureReason(error) });
      return;
    }
    const repaired = repairDraft(result, repairContext(forAnswers));
    if (!repaired.ok) return setDrafting({ kind: "failed" });
    contextUsed.current = context;
    showDraft(repaired.draft, "claude", basis);
  };

  const basisOf = (forAnswers: WizardAnswers) => JSON.stringify({ answers: forAnswers, scope });

  const startDraft = (engine: "auto" | "quick" = "auto") => {
    if (!answers) return;
    if (engine === "auto" && checking) {
      // A click while Claude's status is checked waits for the answer.
      pendingDraft.current = true;
      return;
    }
    const basis = basisOf(answers);
    // Same answers as the draft under review: go back to it instead of drafting again.
    if (engine === "auto" && review?.basis === basis && contextUsed.current === context) return goTo("review");
    if (engine === "quick" || !claude) draftQuick(answers, basis);
    else void draftWithClaude(answers, basis);
  };

  const startDraftRef = useRef(startDraft);
  useEffect(() => {
    startDraftRef.current = startDraft;
  });
  useEffect(() => {
    if (checking || !pendingDraft.current) return;
    pendingDraft.current = false;
    startDraftRef.current();
  }, [checking]);

  const accept = () => {
    if (!review || !wizard.draft || review.objectives.length === 0) return;
    const problems = validateForms(review.objectives, { lookup, saved: objectives, today, checkPlacement: true });
    if (problems.length > 0 || !answers) {
      setShowAllProblems(true);
      if (problems[0]) focusSoon(problems[0].fieldId);
      return;
    }
    const previous = wizard;
    const saved = acceptPlan({ draft: draftFromForms(review.rationale, review.objectives, lookup), source: wizard.draft.source, answers });
    setAccepted(true);
    resetWizard();
    const firstYear = Math.min(...review.objectives.map((form) => yearOf(form.quarter)));
    router.push(`/okrs?year=${firstYear}`);
    toast({
      message: `Your year is set. ${pluralize(saved.objectiveIds.length, "objective")} saved.`,
      action: {
        label: "Undo",
        onClick: () => {
          undoAcceptPlan(saved);
          // Back to the review, as it was, if the wizard is opened again.
          updateWizard(previous);
        },
      },
    });
  };

  const changeReview = (draft: ReviewDraft) => {
    if (wizard.draft) updateWizard({ draft: { ...wizard.draft, plan: draft } });
  };
  const restoreObjective = (form: ObjectiveForm, index: number) => {
    const current = useUIStore.getState().wizard.draft;
    const plan = reviewDraftFrom(current?.plan);
    if (!current || !plan || plan.objectives.some((candidate) => candidate.key === form.key)) return;
    const objectivesNow = [...plan.objectives.slice(0, index), form, ...plan.objectives.slice(index)];
    updateWizard({ draft: { ...current, plan: { ...plan, objectives: objectivesNow } } });
  };

  if (accepted) return null;

  const years = scopeYearsRange(scope);
  const nextYear = yearOf(today) + 1;

  if (scope.length === 0 && step !== "review") {
    return (
      <>
        <PageHeader title="Set your year" />
        <div className="flex max-w-md flex-col items-start gap-3 rounded-2xl border bg-card p-6 shadow-xs">
          <p className="text-sm">Every quarter through {nextYear} already has an objective.</p>
          <Button asChild variant="outline">
            <Link href="/okrs">Back to OKRs</Link>
          </Button>
        </div>
      </>
    );
  }

  if (drafting.kind !== "idle" || step === "review") {
    return (
      <>
        <div className="mb-6">
          <h1 id={REVIEW_HEADING_ID} tabIndex={-1} className="font-display text-2xl font-semibold tracking-tight outline-none">
            Your draft for {years || scopeYearsRange(review?.objectives.map((form) => form.quarter) ?? [])}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Edit anything, then accept. Nothing is saved until you do.</p>
        </div>
        {drafting.kind === "drafting" ? (
          <DraftingView scope={scope} today={today} onUseQuickDraft={() => startDraft("quick")} />
        ) : drafting.kind === "quick-failed" ? (
          <QuickDraftFailedView
            onBack={() => {
              setDrafting({ kind: "idle" });
              goTo("skills");
            }}
          />
        ) : drafting.kind === "failed" ? (
          <DraftFailedView reason={drafting.reason} onRetry={() => startDraft("auto")} onUseQuickDraft={() => startDraft("quick")} />
        ) : (
          review &&
          wizard.draft && (
            <PlanReview
              draft={review}
              source={wizard.draft.source}
              scope={scope}
              today={today}
              saved={objectives}
              lookup={lookup}
              skills={visibleSkills}
              materials={materials}
              showAllProblems={showAllProblems}
              onChange={changeReview}
              onBack={() => goTo("skills")}
              onAccept={accept}
              onRestore={restoreObjective}
            />
          )
        )}
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Set your year"
        description={`Two quick questions, then a draft plan for ${scopeYearsPhrase(scope, today)}. You can change everything.`}
      />
      {step === "answers" ? (
        <AnswersStep
          value={answersValue}
          onChange={(patch) => updateWizard(patch)}
          claudeAvailable={claude}
          context={context}
          onContextChange={setContext}
          onNext={() => {
            updateWizard({ role: answersValue.role, goal: answersValue.goal, goalText: answersValue.goalText });
            goTo("skills");
          }}
          onCancel={cancel}
          focusHeading={moved}
        />
      ) : (
        <SkillsStep
          skills={visibleSkills}
          allSkills={allSkills}
          value={wizard.skills}
          savedLevels={profile.skillLevels}
          onChange={(skills) => updateWizard({ skills })}
          draftLabel={claude ? "Draft with Claude" : "Draft my plan"}
          checking={checking}
          onDraft={() => startDraft()}
          onBack={() => goTo("answers")}
          focusHeading={moved}
        />
      )}
    </>
  );
}
