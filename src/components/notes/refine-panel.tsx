"use client";

import { SparklesIcon, XIcon } from "lucide-react";
import { useId } from "react";
import { AIErrorNotice } from "@/components/app/ai-error-notice";
import { TurnOnClaudeLink } from "@/components/app/ai-setup-hint";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import type { SummaryFeedback } from "@/lib/ai/schemas";
import { useAI } from "@/lib/ai/use-ai";
import { findCardNote } from "@/lib/domain/notes";
import type { ID, Note } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";

/** Get feedback needs a little to read (card-detail.md §Get feedback from Claude). */
export const MIN_FEEDBACK_LENGTH = 20;

export interface RefineMaterial {
  title: string;
  author?: string;
  /** What the material covers, so Claude can point out missing ideas. */
  brief?: string;
}

/**
 * "Get feedback from Claude" on a card's summary, shared by the drawer and the
 * Notebook. Feedback appears under the summary and never replaces it: only
 * "Use this version" does, with an undo toast. Feedback is never stored.
 * With Claude off, a muted line links to Settings instead.
 */
export function RefinePanel({
  itemId,
  summary,
  flush,
  material,
}: {
  /** The card the summary belongs to (it may since have been removed). */
  itemId: ID;
  /** The summary as currently typed. */
  summary: string;
  /** Stores pending typing, so Claude and Undo see the latest text. */
  flush: () => void;
  material: RefineMaterial;
}) {
  const { status, refineSummary } = useAI();
  const hintId = useId();
  const tooShort = summary.trim().length < MIN_FEEDBACK_LENGTH;

  if (status.state === "unavailable") {
    return (
      <p className="text-sm text-muted-foreground">
        Want feedback on this? <TurnOnClaudeLink />.
      </p>
    );
  }

  const ask = () => {
    flush();
    void refineSummary.run({
      material: { title: material.title, author: material.author || undefined, brief: material.brief || undefined },
      summary,
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          disabled={status.state !== "available" || tooShort || refineSummary.loading}
          aria-describedby={tooShort ? hintId : undefined}
          onClick={ask}
        >
          <SparklesIcon aria-hidden className="text-brand" />
          {refineSummary.loading ? "Reading your summary…" : "Get feedback from Claude"}
        </Button>
        {refineSummary.loading && (
          <Button variant="link" size="xs" onClick={refineSummary.reset}>
            Cancel
          </Button>
        )}
        {tooShort && (
          <span id={hintId} className="sr-only">
            Write at least {MIN_FEEDBACK_LENGTH} characters to get feedback.
          </span>
        )}
      </div>

      {refineSummary.error && (
        <div className="flex flex-col items-start gap-1">
          <AIErrorNotice error={refineSummary.error} />
          {refineSummary.error.code !== "key-rejected" && (
            <Button variant="outline" size="xs" onClick={ask} disabled={tooShort}>
              Try again
            </Button>
          )}
        </div>
      )}

      {refineSummary.data && (
        <FeedbackPanel
          feedback={refineSummary.data}
          onClose={refineSummary.reset}
          onUse={(version) => {
            flush();
            const previous = findCardNote(useAppStore.getState().data.notes, itemId, "summary");
            useAppStore.getState().setCardNote(itemId, "summary", version, { refined: true });
            refineSummary.reset();
            toast({
              message: "Summary replaced",
              action: { label: "Undo", onClick: () => previous && undoReplace(itemId, previous) },
            });
          }}
        />
      )}
    </div>
  );
}

/**
 * Undo for "Use this version": puts back only the earlier text and its
 * refined mark, so a review date or other change made since is kept.
 */
function undoReplace(itemId: ID, previous: Note) {
  const { setCardNote, restoreNote } = useAppStore.getState();
  setCardNote(itemId, "summary", previous.body);
  const current = findCardNote(useAppStore.getState().data.notes, itemId, "summary");
  if (!current) return;
  // setCardNote never clears refinedAt; when the earlier text wasn't refined, drop the mark too.
  if (previous.refinedAt !== current.refinedAt) {
    const { refinedAt: _dropped, ...rest } = current;
    restoreNote(previous.refinedAt ? { ...rest, refinedAt: previous.refinedAt } : rest);
  }
}

function FeedbackPanel({
  feedback,
  onUse,
  onClose,
}: {
  feedback: SummaryFeedback;
  onUse: (version: string) => void;
  onClose: () => void;
}) {
  const headingId = useId();
  const rows: [string, string[]][] = [
    ["What works", feedback.strengths],
    ["What's missing", feedback.gaps],
    ["Try", feedback.suggestions],
  ];
  const version = feedback.improvedVersion?.trim();

  return (
    <section aria-labelledby={headingId} className="relative flex flex-col gap-3 rounded-lg border bg-muted/50 p-3 pr-9 text-sm">
      <p role="status" className="sr-only">
        Feedback from Claude is ready.
      </p>
      <h3 id={headingId} className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <SparklesIcon aria-hidden className="size-3.5 text-brand" />
        Feedback from Claude
      </h3>
      <Button variant="ghost" size="icon-xs" className="absolute top-2 right-2" aria-label="Close feedback" onClick={onClose}>
        <XIcon aria-hidden />
      </Button>
      <dl className="grid gap-2 sm:grid-cols-[8rem_1fr]">
        {rows
          .filter(([, items]) => items.length > 0)
          .map(([label, items]) => (
            <div key={label} className="contents">
              <dt className="font-medium">{label}</dt>
              <dd>
                <ul className="flex flex-col gap-1 text-muted-foreground">
                  {items.map((text) => (
                    <li key={text}>· {text}</li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
      </dl>
      {version && (
        <div className="flex flex-col gap-2 border-t pt-3">
          <p className="font-medium">
            A tighter version <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
          <blockquote className="border-l-2 border-brand/50 pl-3 font-display leading-relaxed whitespace-pre-line">“{version}”</blockquote>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => onUse(version)}>
              Use this version
            </Button>
            <Button variant="outline" size="sm" onClick={onClose}>
              Keep mine
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
