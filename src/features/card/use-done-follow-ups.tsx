"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { findMaterial } from "@/lib/catalog";
import { isSummarized } from "@/lib/domain/notes";
import type { BoardStatus, ID, PlanItem } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";

/**
 * What happens after a card moves to Done (board.md §Moving to Done), shared
 * so the drawer's status select behaves like the board: certifications ask
 * "Did you earn {short title}?", and a card without a summary gets the
 * summary toast, at most once per card.
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
  /** The certification card being asked about, if any. */
  asking: ID | null;
  /** Call after moving `before` to `status`. */
  afterMove: (before: PlanItem, status: BoardStatus) => void;
  /** The answer to "Did you earn…?"; `undefined` when dismissed. */
  answer: (earned: boolean | undefined) => void;
}

export function useDoneFollowUps({ onWriteSummary }: { onWriteSummary: (itemId: ID) => void }): DoneFollowUps {
  const [asking, setAsking] = useState<ID | null>(null);

  const afterMove = (before: PlanItem, status: BoardStatus) => {
    if (before.status === "done" || status !== "done") return;
    const material = findMaterial(before.materialId, useAppStore.getState().data.customMaterials);
    if (material?.type === "certification" && !before.earnedAt) {
      setAsking(before.id);
      return;
    }
    nudgeSummary(before.id, onWriteSummary);
  };

  const answer = (earned: boolean | undefined) => {
    if (!asking) return;
    const id = asking;
    setAsking(null);
    if (earned) useAppStore.getState().setItemEarned(id, true);
    nudgeSummary(id, onWriteSummary);
  };

  return { asking, afterMove, answer };
}

/** "Did you earn {short title}?" [Yes, I earned it] [Not yet]. */
export function EarnedDialog({ title, onAnswer }: { title: string | null; onAnswer: (earned: boolean | undefined) => void }) {
  return (
    <Dialog open={title !== null} onOpenChange={(open) => !open && onAnswer(undefined)}>
      {title !== null && (
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Did you earn {shortTitle(title)}?</DialogTitle>
            <DialogDescription>You can mark it as earned later too.</DialogDescription>
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
