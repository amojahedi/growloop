# 010 — Writing lives in notes, as plain text

**Status:** Accepted · 2026-10-18

## Context
Summaries and notes were stored as fields on plan items. The Notebook needs free notes, review dates and search across everything written, and writing must survive when a card is removed, dropped or archived.

## Decision
- A **Note** is its own record: `kind` summary | item_note | free, optional `planItemId` and `materialId`, `body`, `skillIds`, `reviewAt`, `lastReviewedAt`, `refinedAt`, timestamps.
- A card's summary and notes **are** notes (one of each per card), not copies. The card and the Notebook edit the same record.
- Notes keep `materialId`, so they stay readable after their card is gone. Removing or dropping a card never deletes its notes.
- Bodies are **plain text**: no rich text, no Markdown rendering, no editor dependency. Line breaks are kept; links are made clickable when displayed.
- No tags in MVP: skills and search organize notes.
- Schema v4 moves existing `notes` and `summary` fields into Note records.

## Alternatives considered
- Keep fields on plan items and derive the Notebook: can't hold free notes or survive card removal without special cases.
- Rich text or Markdown: heavier, harder to keep accessible, and short "in my own words" summaries don't need it. Adding formatting later needs no data migration.
- Tags: a second organizing system next to skills, with its own input and filter UI, for little gain at this size.

## Consequences
- One source of truth for knowledge; archiving freezes plans, never writing.
- The activity log records summary and note edits from note changes instead of plan-item fields.
