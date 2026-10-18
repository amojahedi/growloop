"use client";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { shortTitle } from "./board-model";

export interface EarnedDialogProps {
  /** The certification's title; `null` keeps the dialog closed. */
  title: string | null;
  /** The user's answer; `undefined` when the dialog was dismissed (Esc, ×), which counts as "Not yet". */
  onAnswer: (earned: boolean | undefined) => void;
  /** Where focus goes when the dialog closes (the card that moved to Done). */
  onCloseAutoFocus: () => void;
}

/**
 * "Did you earn {short title}?" after a certification moves to Done (board.md
 * §Moving to Done, C-7). Yes sets `earnedAt`; Not yet leaves it Done but not
 * earned, and the card then offers "Mark as earned".
 */
export function EarnedDialog({ title, onAnswer, onCloseAutoFocus }: EarnedDialogProps) {
  return (
    <Dialog open={title !== null} onOpenChange={(open) => !open && onAnswer(undefined)}>
      {title !== null && (
        <DialogContent
          className="max-w-sm"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onCloseAutoFocus();
          }}
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
