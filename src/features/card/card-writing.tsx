"use client";

import type { Ref } from "react";
import { NoteEditor } from "@/components/notes/note-editor";
import { RefinePanel } from "@/components/notes/refine-panel";
import { ReviewLaterMenu } from "@/components/notes/review-later-menu";
import { findCardNote, hasContent } from "@/lib/domain/notes";
import type { Material, PlanItem } from "@/lib/domain/types";
import { useActions, useNotes } from "@/lib/store/hooks";

export const SUMMARY_PLACEHOLDER = "What's the one idea you'll use? Two or three sentences is plenty.";
export const NOTES_PLACEHOLDER = "Quotes, ideas, things to try…";

/**
 * "In my words" (C-3): the card's summary note, the same record the Notebook
 * shows. Always editable, also on read-only cards: knowledge is never frozen.
 */
export function CardSummary({
  item,
  material,
  materialTitle,
  textareaRef,
}: {
  item: PlanItem;
  material?: Material;
  materialTitle: string;
  textareaRef?: Ref<HTMLTextAreaElement>;
}) {
  const { setCardNote } = useActions();
  const summary = findCardNote(useNotes(), item.id, "summary");

  return (
    <NoteEditor
      label="In my words"
      value={summary?.body ?? ""}
      onSave={(body) => setCardNote(item.id, "summary", body)}
      placeholder={SUMMARY_PLACEHOLDER}
      textareaRef={textareaRef}
      actions={
        <ReviewLaterMenu
          noteId={summary && hasContent(summary) ? summary.id : undefined}
          reviewAt={summary?.reviewAt}
          subject="your summary"
        />
      }
    >
      {(editor) => (
        <RefinePanel
          itemId={item.id}
          summary={editor.draft}
          flush={editor.flush}
          material={{ title: materialTitle, author: material?.author, brief: material?.summary }}
        />
      )}
    </NoteEditor>
  );
}

/** Notes: the card's item note in the Notebook (same record). */
export function CardNotes({ item, textareaRef }: { item: PlanItem; textareaRef?: Ref<HTMLTextAreaElement> }) {
  const { setCardNote } = useActions();
  const note = findCardNote(useNotes(), item.id, "item_note");

  return (
    <NoteEditor
      label="Notes"
      value={note?.body ?? ""}
      onSave={(body) => setCardNote(item.id, "item_note", body)}
      placeholder={NOTES_PLACEHOLDER}
      textareaRef={textareaRef}
    />
  );
}
