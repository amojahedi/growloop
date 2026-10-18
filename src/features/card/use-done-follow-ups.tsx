"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { findMaterial } from "@/lib/catalog";
import { isSummarized } from "@/lib/domain/notes";
import type { BoardStatus, ID, PlanItem } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";

/**
 * What happens after a card moves to Done (board.md §Moving to Done), shared
 * by the board and the card drawer's status select: certifications ask "Did
 * you earn {short title}?", then a card without a summary gets the summary
 * toast, at most once per card.
 */

export const SUMMARY_NUDGE = "Nice. Add a two-line summary while it's fresh?";

/** A trailing abbreviation in brackets when there is one ("… (CSPO)" → "CSPO"), else the title. */
export function shortTitle(title: string): string {
  const abbreviation = /\(([^()]{2,24})\)\s*$/.exec(title)?.[1]?.trim();
  return abbreviation || title.trim();
}

/** Shows the summary toast if this card has no summary and hasn't been nudged yet. */
export function nudgeSummary(itemId: ID, onWriteSummary: (itemId: ID) => void): void {
  const { data, markSummaryNudged } = useAppStore.getState();
  const item = data.planItems.find((candidate) => candidate.id === itemId);
  if (!item || item.summaryNudgedAt || isSummarized(itemId, data.notes)) return;
  markSummaryNudged(itemId);
  toast({ message: SUMMARY_NUDGE, action: { label: "Write summary", onClick: () => onWriteSummary(itemId) } });
}

export interface DoneFollowUps {
  /** The certification the dialog is asking about while it is open. */
  asking: ID | null;
  /** The last card asked about, kept after the dialog closes so focus can return to it. */
  lastAsked: ID | null;
  /** Call after moving `before` to `status`; true when it opened the "Did you earn…?" dialog. */
  afterMove: (before: PlanItem, status: BoardStatus) => boolean;
  /** The answer to "Did you earn…?"; `undefined` when dismissed, which counts as Not yet. */
  answer: (earned: boolean | undefined) => void;
}

export function useDoneFollowUps({ onWriteSummary }: { onWriteSummary: (itemId: ID) => void }): DoneFollowUps {
  const [asked, setAsked] = useState<{ id: ID; open: boolean } | null>(null);

  const afterMove = (before: PlanItem, status: BoardStatus) => {
    if (before.status === "done" || status !== "done") return false;
    const material = findMaterial(before.materialId, useAppStore.getState().data.customMaterials);
    if (material?.type === "certification" && !before.earnedAt) {
      setAsked({ id: before.id, open: true });
      return true;
    }
    nudgeSummary(before.id, onWriteSummary);
    return false;
  };

  const answer = (earned: boolean | undefined) => {
    if (!asked?.open) return;
    setAsked({ id: asked.id, open: false });
    if (earned) useAppStore.getState().setItemEarned(asked.id, true);
    nudgeSummary(asked.id, onWriteSummary);
  };

  return { asking: asked?.open ? asked.id : null, lastAsked: asked?.id ?? null, afterMove, answer };
}

/**
 * "Did you earn {short title}?" [Not yet] [Yes, I earned it] (C-7). Yes sets
 * `earnedAt`; Not yet leaves the card Done but not earned, and it then offers
 * "Mark as earned".
 */
export function EarnedDialog({
  title,
  onAnswer,
  onCloseAutoFocus,
}: {
  /** The certification's title; `null` keeps the dialog closed. */
  title: string | null;
  onAnswer: (earned: boolean | undefined) => void;
  /** Where focus goes when the dialog closes; by default it returns to where it was. */
  onCloseAutoFocus?: () => void;
}) {
  return (
    <Dialog open={title !== null} onOpenChange={(open) => !open && onAnswer(undefined)}>
      {title !== null && (
        <DialogContent
          className="max-w-sm"
          aria-describedby={undefined}
          onCloseAutoFocus={
            onCloseAutoFocus
              ? (event) => {
                  event.preventDefault();
                  onCloseAutoFocus();
                }
              : undefined
          }
        >
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Did you earn {shortTitle(title)}?</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => onAnswer(false)}>
              Not yet
            </Button>
            <Button onClick={() => onAnswer(true)}>Yes, I earned it</Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
