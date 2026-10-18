"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** specs/README.md §Saving: text autosaves after a short pause. */
export const AUTOSAVE_DELAY_MS = 400;
/** How long the quiet "Saved" stays next to the field. */
export const SAVED_VISIBLE_MS = 1_500;

export interface Autosave {
  /** What the field shows: the user's latest text. */
  draft: string;
  /** Call on every keystroke; the text is stored after a pause. */
  change: (next: string) => void;
  /** Stores pending text now (on blur, before Claude reads it, before navigating away). */
  flush: () => void;
  /** True for 1.5 s after a change is stored. */
  saved: boolean;
  /** True while typed text hasn't been stored (including when the last save couldn't store it). */
  dirty: boolean;
}

/**
 * Debounced autosave for one text field. `save` returns `false` when it
 * couldn't store the text (e.g. a reminder note without a date); the text then
 * stays pending and "Saved" doesn't show.
 *
 * Outside changes to `value` (Use this version, Undo, an edit in another
 * place) replace the text only while nothing typed is pending; while it is,
 * the typing wins and is stored next. Pending text is stored when the field
 * unmounts, so nothing typed is lost when the drawer closes or the Notebook
 * switches notes.
 */
export function useAutosave(
  value: string,
  save: (next: string) => boolean | void,
  { delay = AUTOSAVE_DELAY_MS } = {},
): Autosave {
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  // The last text this field stored, so the store echoing it back isn't taken for an outside change.
  const [stored, setStored] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);

  if (value !== synced) {
    setSynced(value);
    if (!dirty && value !== stored) setDraft(value);
    // Either way the echo is consumed: a later change back to the same text (Undo) is an outside change.
    setStored(null);
  }

  // Handlers and timers read the latest values through refs, never a stale render.
  const draftRef = useRef(draft);
  const dirtyRef = useRef(false);
  const saveRef = useRef(save);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    saveRef.current = save;
  });
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    if (!dirtyRef.current) return;
    const text = draftRef.current;
    if (saveRef.current(text) === false) return;
    dirtyRef.current = false;
    setDirty(false);
    setStored(text);
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), SAVED_VISIBLE_MS);
  }, []);

  const change = useCallback(
    (next: string) => {
      draftRef.current = next;
      dirtyRef.current = true;
      setDirty(true);
      setDraft(next);
      clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush, delay],
  );

  // Store anything still pending when the field goes away.
  useEffect(
    () => () => {
      flush();
      clearTimeout(savedTimer.current);
    },
    [flush],
  );

  return { draft, change, flush, saved, dirty };
}
