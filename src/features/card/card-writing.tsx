"use client";

import type { Ref } from "react";
import { NoteEditor } from "@/components/notes/note-editor";
import { RefinePanel } from "@/components/notes/refine-panel";
import { ReviewLaterMenu } from "@/components/notes/review-later-menu";
import { findCardNote, hasContent } from "@/lib/domain/notes";
import type { CardNoteKind, Material, PlanItem } from "@/lib/domain/types";
import { useActions, useNotes } from "@/lib/store/hooks";

export const SUMMARY_PLACEHOLDER = "What's the one idea you'll use? Two or three sentences is plenty.";
export const NOTES_PLACEHOLDER = "Quotes, ideas, things to try…";

/** Writes a card note; on a read-only card its frozen tasks are left alone. */
function useWriteCardNote(item: PlanItem, kind: CardNoteKind, readOnly: boolean) {
  const { setCardNote, setReadOnlyCardNote } = useActions();
  return (body: string) => {
    if (readOnly) setReadOnlyCardNote(item.id, kind, body);
    else setCardNote(item.id, kind, body);
  };
}

/**
 * "In my words" (C-3): the card's summary note, the same record the Notebook
 * shows. Always editable, also on read-only cards: knowledge is never frozen.
 */
export function CardSummary({
  item,
  material,
  materialTitle,
  readOnly,
  textareaRef,
}: {
  item: PlanItem;
  material?: Material;
  materialTitle: string;
  readOnly: boolean;
  textareaRef?: Ref<HTMLTextAreaElement>;
}) {
  const write = useWriteCardNote(item, "summary", readOnly);
  const summary = findCardNote(useNotes(), item.id, "summary");

  return (
    <NoteEditor
      label="In my words"
      value={summary?.body ?? ""}
      onSave={write}
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
export function CardNotes({ item, readOnly, textareaRef }: { item: PlanItem; readOnly: boolean; textareaRef?: Ref<HTMLTextAreaElement> }) {
  const write = useWriteCardNote(item, "item_note", readOnly);
  const note = findCardNote(useNotes(), item.id, "item_note");

  return <NoteEditor label="Notes" value={note?.body ?? ""} onSave={write} placeholder={NOTES_PLACEHOLDER} textareaRef={textareaRef} />;
}
