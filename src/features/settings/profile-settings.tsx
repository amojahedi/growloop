"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Section } from "@/components/app/section";
import { Input } from "@/components/ui/input";
import { useAppStore } from "@/lib/store/app-store";
import { useActions, useProfile } from "@/lib/store/hooks";

export const MAX_NAME_LENGTH = 40;
/** Text autosaves after a short pause (specs/README.md §Saving). */
export const SAVE_DELAY_MS = 400;
const SAVED_VISIBLE_MS = 1_500;

/** Settings → Profile (ST-2): an optional name for the greeting, autosaved. */
export function ProfileSettings() {
  const profile = useProfile();
  const { updateProfile } = useActions();
  const inputId = useId();
  const helperId = useId();
  // What the user is typing; null shows the stored name (which may change elsewhere, e.g. an import).
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const pending = useRef<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const savedTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const flush = () => {
    clearTimeout(saveTimer.current);
    const value = pending.current;
    if (value === null) return;
    pending.current = null;
    const name = value.trim() || undefined;
    // Compared with the latest stored value, so only a real change shows "Saved".
    if (name === useAppStore.getState().data.profile.name) return;
    updateProfile({ name });
    setSaved(true);
    clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), SAVED_VISIBLE_MS);
  };
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  });

  // Leaving the page never loses the last keystrokes.
  useEffect(
    () => () => {
      flushRef.current();
      clearTimeout(savedTimer.current);
    },
    [],
  );

  return (
    <Section title="Profile">
      <div className="flex max-w-sm flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
            Your name
          </label>
          <span className="text-xs text-muted-foreground" role="status">
            {saved ? "Saved" : ""}
          </span>
        </div>
        <Input
          id={inputId}
          value={draft ?? profile.name ?? ""}
          maxLength={MAX_NAME_LENGTH}
          autoComplete="given-name"
          aria-describedby={helperId}
          onChange={(event) => {
            setDraft(event.target.value);
            pending.current = event.target.value;
            clearTimeout(saveTimer.current);
            saveTimer.current = setTimeout(flush, SAVE_DELAY_MS);
          }}
          onBlur={() => {
            flush();
            setDraft(null);
          }}
        />
        <p id={helperId} className="text-xs text-muted-foreground">
          Used in your greeting. Stays on this device.
        </p>
      </div>
    </Section>
  );
}
