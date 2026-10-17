# Notebook

PRD: N-1 to N-5 · ADR [010](../../decisions/010-writing-lives-in-notes.md)

## User story

As a learner, I want everything I've written, card summaries, card notes and my own free notes, in one searchable place, and I want chosen notes to come back to me later, so that knowledge outlives the board.

## The model

```
Note
  kind          summary | item_note | free
  planItemId?   summary and item_note: the card they belong to (one of each per card)
  materialId?   summary and item_note: kept so the note stays readable after the card is removed
  title?        free notes only (summaries and item notes show the material title)
  body          plain text
  skillIds[]    free notes: chosen (0–3); summaries and item notes: follow the card's skills
  reviewAt?     day the note is due for review
  lastReviewedAt?, refinedAt?, createdAt, updatedAt
```

- A card's summary and notes **are** notes (not copies). Editing in the card or the Notebook edits the same record.
- A note appears in the Notebook once its body has text. Clearing a card note's text removes it.
- Removing a card from the board, dropping it in the review or archiving a year never deletes its notes.

## Behavior (`/notebook`)

### Layout

Two panes on desktop (list 360 px · reader/editor), one pane with back navigation below 1024 px.

```
Notebook                                              [+ New note]
[Search notes            ] [All] [Summaries] [Notes] [Due 2]  [Skills ▾]

┌ list ─────────────────────────┐ ┌ editor ──────────────────────────────┐
│ Summary · Inspired      Oct 15│ │ Summary · Inspired · Marty Cagan     │
│ Good teams are handed…   ✦    │ │ Open card →                          │
│ ● Discovery  ● Strategy       │ │ (body, plain text, auto-growing)     │
│                               │ │                                      │
│ Note · Questions for my 1:1   │ │ ● Discovery ● Strategy               │
│ Due today                     │ │ Review later ▾        Saved          │
└───────────────────────────────┘ └──────────────────────────────────────┘
```

- **List item:** kind label · source (material title or free-note title) · date (updated) · two-line preview · skill dots · "Refined" ✦ marker · due chip ("Due today", "Due Oct 25"). Newest updated first; with the Due filter, oldest due first.
- **Filters:** search (title, material title and body; case- and accent-insensitive), source chips **All · Summaries · Notes** (single choice; "Notes" = card notes and free notes), a **Due** toggle chip with the count that combines with the source, **Skills** multi-select (shared Library popover). Filters live in the URL (`?q=`, `?show=`, `?skill=`, `?due=1`). `?note=<id>` selects a note.
- **Editor:** the same NoteEditor as the card (plain text, autosave, "Saved"). Header shows kind and source; card notes link **Open card →** (`/board?item=…`), or "Card removed" when gone. Summaries offer **Get feedback from Claude** exactly as in the card. Free notes add an editable title (placeholder "Untitled note") and a skills picker (0–3).
- **New note:** creates a free note immediately with the cursor in the title; if it's left with no title and no body, it is discarded silently when the user navigates away.
- **Delete:** free notes: ⋯ → Delete (undo toast "Note deleted · Undo"). Summaries and card notes: ⋯ → Clear (empties the body, removing it from the Notebook; undo toast).

### Editor choice: plain text

No rich text, no Markdown rendering, no toolbar. Line breaks are kept; URLs become links in read display. Why: summaries are short, "in my own words" writing; plain text is fast, accessible, exports cleanly to JSON, and avoids an editor dependency. Formatting can come later without a data migration.

### Review later (N-3)

- On any note: **Review later ▾** → Tomorrow · In a week · In a month · Pick a date…
- A note is **due** when `reviewAt` ≤ today. Due notes show in the Dashboard **Due for review** widget ([dashboard.md](dashboard.md)), as the Due chip count, and as a count badge on the Notebook nav item.
- Opening a due note shows a slim bar above the editor: "Due for review" [Reviewed] [Again ▾ (Tomorrow · In a week · In a month)]. Reviewed clears `reviewAt` and sets `lastReviewedAt`; Again sets a new date. Toast: "Nice. See you in a week." when rescheduled.

### Claude in the Notebook

Only **Get feedback from Claude** on summaries (same component and rules as the card). No AI on free notes, no auto-tagging, no AI search. Kept deliberately small.

## States

| State | Copy / behavior |
|---|---|
| Empty Notebook | **Your notebook is empty.** Summaries you write on cards land here automatically. [New note] |
| No matches | "No notes match." [Clear filters] |
| Due filter empty | "Nothing due. Nice." |
| Note selected that no longer exists | List shows; editor pane: "That note is gone." |
| Read-only? | Never. Notes from past months and archived years stay editable. |
| Claude off | Summaries show "Want feedback on this? Turn on Claude". |
| Loading | Data gate skeleton (two panes). |

## Acceptance criteria

- [ ] Summaries and card notes from the v3 data are migrated into notes (v4) with `planItemId` and `materialId`; nothing is lost (migration test).
- [ ] Editing a summary in the Notebook updates the card, and vice versa, with no duplicate records.
- [ ] Notes survive Remove from board, Drop and year archive.
- [ ] Search, source chips, skills filter and Due work together and are reflected in the URL.
- [ ] New note creates a free note with title focus; an untouched empty note is discarded.
- [ ] Review later sets a date; due notes appear in the widget, the Due chip and the nav badge; Reviewed and Again behave as specified.
- [ ] Free notes can be deleted, card notes cleared, both undoable.
- [ ] Get feedback from Claude is available on summaries only and follows the card's rules.
- [ ] Two panes ≥ 1024 px, single pane with back navigation below; keyboard: list is a listbox (↑/↓ to move, Enter to open).
