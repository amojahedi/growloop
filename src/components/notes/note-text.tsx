import { cn } from "cn";
import { linkify } from "./note-labels";

/**
 * A note's plain text for reading (ADR 010): line breaks kept, web addresses
 * made clickable. Rendered as text nodes and anchors only, never as HTML.
 */
export function NoteText({ text, className }: { text: string; className?: string }) {
  return (
    <p className={cn("whitespace-pre-line", className)}>
      {linkify(text).map((segment, index) =>
        segment.kind === "link" ? (
          <a
            key={index}
            href={segment.href}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-foreground underline underline-offset-2"
          >
            {segment.text}
          </a>
        ) : (
          segment.text
        ),
      )}
    </p>
  );
}
