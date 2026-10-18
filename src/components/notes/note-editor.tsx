"use client";

import { cn } from "cn";
import { useCallback, useId, useLayoutEffect, useRef, type ReactNode, type Ref } from "react";
import { Textarea } from "@/components/ui/input";
import { useAutosave, type Autosave } from "./use-autosave";

/**
 * The one plain-text editor for everything the user writes (notebook.md
 * §Editor choice, ADR 010): no toolbar and no formatting, line breaks kept,
 * auto-growing, autosaved after a pause with a quiet "Saved". Used by the card
 * drawer (summary, notes) and the Notebook.
 */
export interface NoteEditorProps {
  value: string;
  onSave: (body: string) => void;
  /** The field's label, shown as the section heading. */
  label: string;
  /** Keep the label for screen readers only (the Notebook shows the source above instead). */
  hideLabel?: boolean;
  placeholder?: string;
  /** Controls next to "Saved", e.g. Review later. */
  actions?: ReactNode;
  /** Where the actions and "Saved" sit: next to the label (card) or under the text (Notebook). */
  toolbar?: "header" | "footer";
  autoFocus?: boolean;
  textareaRef?: Ref<HTMLTextAreaElement>;
  className?: string;
  textareaClassName?: string;
  /** Rendered under the text with the editor's state, e.g. the Get feedback panel that reads the draft. */
  children?: (editor: Autosave) => ReactNode;
}

export function NoteEditor({
  value,
  onSave,
  label,
  hideLabel = false,
  placeholder,
  actions,
  toolbar = "header",
  autoFocus,
  textareaRef,
  className,
  textareaClassName,
  children,
}: NoteEditorProps) {
  const id = useId();
  const editor = useAutosave(value, onSave);
  const toolbarRow = (
    <div className={toolbar === "footer" ? "flex w-full flex-wrap items-center justify-end gap-2" : "ml-auto flex shrink-0 items-center gap-2"}>
      {actions}
      <SavedHint saved={editor.saved} />
    </div>
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className={cn("flex min-h-7 items-center gap-2", hideLabel && toolbar === "footer" && "sr-only")}>
        <label htmlFor={id} className={cn(SECTION_HEADING, hideLabel && "sr-only")}>
          {label}
        </label>
        {toolbar === "header" && toolbarRow}
      </div>
      <AutoGrowTextarea
        id={id}
        ref={textareaRef}
        value={editor.draft}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={textareaClassName}
        onChange={editor.change}
        onBlur={editor.flush}
      />
      {toolbar === "footer" && <div className="flex min-h-7 items-center gap-2">{toolbarRow}</div>}
      {children?.(editor)}
    </div>
  );
}

/** Section headings in the drawer and the Notebook (Linen: small, muted, uppercase). */
export const SECTION_HEADING = "text-xs font-semibold tracking-wide text-muted-foreground uppercase";

/** The quiet "Saved" after a text change is stored (specs/README.md §Saving). */
export function SavedHint({ saved }: { saved: boolean }) {
  return (
    <span role="status" className="min-w-10 text-right text-xs text-muted-foreground">
      {saved ? "Saved" : ""}
    </span>
  );
}

/** A plain textarea that grows with its text, so long notes never scroll inside a box. */
export function AutoGrowTextarea({
  ref,
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<"textarea">, "onChange" | "value"> & {
  ref?: Ref<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
}) {
  const inner = useRef<HTMLTextAreaElement | null>(null);
  const setRefs = useCallback(
    (node: HTMLTextAreaElement | null) => {
      inner.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return;
    node.style.height = "auto";
    // +2 for the borders, so the last line never hides behind a scrollbar.
    node.style.height = `${node.scrollHeight + 2}px`;
  }, [value]);

  return (
    <Textarea
      ref={setRefs}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={cn("resize-none overflow-hidden leading-relaxed", className)}
      {...props}
    />
  );
}
