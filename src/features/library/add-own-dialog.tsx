"use client";

import { SparklesIcon } from "lucide-react";
import { useId, useRef, useState } from "react";
import { AISetupHint } from "@/components/app/ai-setup-hint";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAI } from "@/lib/ai/use-ai";
import { formatMonth } from "@/lib/domain/dates";
import type { ID } from "@/lib/domain/types";
import { useActions, useMaterials, useMonthNavigation, useSkills } from "@/lib/store/hooks";
import {
  findExisting,
  firstLine,
  initialForm,
  toNewMaterial,
  validateForm,
  type FilledField,
  type OwnMaterialForm,
} from "./own-material";
import { OwnMaterialFields } from "./own-material-form";

/**
 * "Add your own" (ML-2, flow d): paste a title or link; with AI (own key or Claude Code) the
 * details are drafted for review, without it the form is pre-filled from the
 * paste. Saved items are the user's own materials, which are always in My Library.
 */
export function AddOwnDialog({
  open,
  onOpenChange,
  onOpenExisting,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Shows a material the paste already matches. */
  onOpenExisting: (id: ID) => void;
  onSaved: (message: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Content unmounts when closed, so every opening starts fresh. */}
      <DialogContent className="sm:max-w-xl">
        <AddOwnFlow
          onOpenExisting={(id) => {
            onOpenChange(false);
            onOpenExisting(id);
          }}
          onSaved={(message) => {
            onOpenChange(false);
            onSaved(message);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

type Review = { form: OwnMaterialForm; filled: Set<FilledField>; notice?: string };

function AddOwnFlow({ onOpenExisting, onSaved }: { onOpenExisting: (id: ID) => void; onSaved: (message: string) => void }) {
  const [pasted, setPasted] = useState("");
  const [review, setReview] = useState<Review>();

  if (review) {
    return <ReviewStep review={review} onChange={setReview} onBack={() => setReview(undefined)} onSaved={onSaved} />;
  }
  return (
    <PasteStep
      pasted={pasted}
      onPastedChange={setPasted}
      onOpenExisting={onOpenExisting}
      onReview={(next) => setReview(next)}
    />
  );
}

function PasteStep({
  pasted,
  onPastedChange,
  onOpenExisting,
  onReview,
}: {
  pasted: string;
  onPastedChange: (value: string) => void;
  onOpenExisting: (id: ID) => void;
  onReview: (review: Review) => void;
}) {
  const inputId = useId();
  const { status, recheck, enrichMaterial } = useAI();
  const materials = useMaterials();
  const skills = useSkills();

  const text = firstLine(pasted);
  const multiLine = pasted.split(/\r?\n/).filter((line) => line.trim()).length > 1;
  const existing = findExisting(pasted, materials);
  const canUseClaude = status.state === "available";
  const cancelled = useRef(false);

  const fillWithClaude = async () => {
    cancelled.current = false;
    const draft = await enrichMaterial.run({ input: text, skills: skills.map(({ id, name }) => ({ id, name })) });
    if (cancelled.current) return;
    // A failure never loses the paste: fall back to the pre-filled form and say why.
    onReview(
      draft
        ? initialForm(pasted, draft)
        : { ...initialForm(pasted), notice: "Claude couldn't fill this in, so the form starts from what you pasted." },
    );
  };

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!text || enrichMaterial.loading) return;
        if (canUseClaude) void fillWithClaude();
        else onReview(initialForm(pasted));
      }}
    >
      <DialogHeader>
        <DialogTitle>Add your own</DialogTitle>
        <DialogDescription>Paste a title or a link to a course, book, article or podcast.</DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-1">
        <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
          Title or link
        </label>
        <Input
          id={inputId}
          autoFocus
          placeholder="e.g. Shape Up, or https://…"
          value={pasted}
          onChange={(event) => onPastedChange(event.target.value)}
        />
        {multiLine && <p className="text-xs text-muted-foreground">One item at a time: only the first line is used.</p>}
      </div>

      {existing && (
        <p className="text-sm" role="status">
          {existing.curated ? "This is already in Resources." : "This is already in your library."}{" "}
          <Button type="button" variant="link" size="xs" className="px-0" onClick={() => onOpenExisting(existing.id)}>
            Open “{existing.title}”
          </Button>
        </p>
      )}

      {status.state === "checking" && <p className="text-xs text-muted-foreground">Checking AI…</p>}
      {status.state === "unavailable" && (
        <AISetupHint status={status} onRecheck={recheck} suffix="You can still fill in the details yourself." />
      )}

      <DialogFooter>
        {canUseClaude && (
          <Button type="button" variant="outline" disabled={!text || enrichMaterial.loading} onClick={() => onReview(initialForm(pasted))}>
            Fill in myself
          </Button>
        )}
        {enrichMaterial.loading ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              cancelled.current = true;
              enrichMaterial.reset();
            }}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={!text || enrichMaterial.loading}>
          {canUseClaude && <SparklesIcon aria-hidden />}
          {enrichMaterial.loading ? "Asking Claude…" : canUseClaude ? "Fill in with Claude" : "Continue"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ReviewStep({
  review,
  onChange,
  onBack,
  onSaved,
}: {
  review: Review;
  onChange: (review: Review) => void;
  onBack: () => void;
  onSaved: (message: string) => void;
}) {
  const skills = useSkills();
  const { addCustomMaterial, addPlanItem } = useActions();
  const { currentMonth } = useMonthNavigation();
  const [showProblems, setShowProblems] = useState(false);
  const problems = validateForm(review.form);

  const save = (addToBoard: boolean) => {
    if (Object.keys(problems).length > 0) {
      setShowProblems(true);
      return;
    }
    const material = toNewMaterial(review.form);
    const id = addCustomMaterial(material);
    if (addToBoard) addPlanItem(id, currentMonth);
    onSaved(
      addToBoard
        ? `Saved “${material.title}” to your library and added it to ${formatMonth(currentMonth)}.`
        : `Saved “${material.title}” to your library.`,
    );
  };

  return (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        save(true);
      }}
    >
      <DialogHeader>
        <DialogTitle>Check the details</DialogTitle>
        <DialogDescription>
          {review.filled.size > 0
            ? "Claude filled the marked fields from what it knows. Check them, and fix anything that's off."
            : "Fill in what you know. Only the title and a skill are required."}
        </DialogDescription>
      </DialogHeader>
      {review.notice && (
        <p className="text-sm text-muted-foreground" role="status">
          {review.notice}
        </p>
      )}

      <OwnMaterialFields
        form={review.form}
        filled={review.filled}
        problems={showProblems ? problems : {}}
        skills={skills}
        onChange={(patch) => onChange({ ...review, form: { ...review.form, ...patch } })}
      />

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onBack} className="sm:mr-auto">
          Back
        </Button>
        <Button type="button" variant="outline" onClick={() => save(false)}>
          Save to library
        </Button>
        <Button type="submit">Save and add to {formatMonth(currentMonth)}</Button>
      </DialogFooter>
    </form>
  );
}
