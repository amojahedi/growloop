# Card detail

PRD: C-1 to C-8 · Related: [notebook.md](notebook.md), [board.md](board.md)

## User story

As a learner working through a book or course, I want one place per card for my checklist, my notes and a summary in my own words, so that what I learn sticks and I can find it again.

## Behavior

### Container

- A **drawer** from the right, 480 px wide on desktop; a full-screen sheet below 768 px. Opens from a card click, Enter on a focused card, ⋯ → Open, or `/board?item=<id>` from anywhere.
- The URL carries `?item=<id>` while open; Esc, the × button, a click on the scrim or browser Back closes it and returns focus to the card.
- Everything autosaves. No Save button.

### Layout (top to bottom)

Written in order of what people do most while learning; reference material sits at the bottom, collapsed.

```
[book] Book · Melissa Perri                         [In progress ▾]     ×
Escaping the Build Trap                                  (serif title)
Open link ↗
● Roadmapping  ● Product Strategy  [Edit]
Counts toward  Lead roadmap… · Finish Escaping the Build Trap   Change · Unlink
Also counts toward Complete 3 Roadmapping items                 (muted, automatic)

Tasks                                                      3 of 5
[x] Part 1: The build trap
[ ] Part 2: The product manager
[ ] Summarize in my words
+ Add a task

In my words                          Review later ▾     Saved
┌──────────────────────────────────────────────────────────┐
│ What's the one idea you'll use? Two or three sentences   │
│ is plenty.                                               │
└──────────────────────────────────────────────────────────┘
[✦ Get feedback from Claude]

Notes
┌ Quotes, ideas, things to try… ┐

Reminder   + Add reminder        (or: Oct 24 · Finish the strategy section  Edit · Clear)

▸ About this material      (collapsed: tagline, what it covers, who it's for, takeaways, length, level, cost)
▸ Time (optional)          (collapsed: estimate, time logs; the only place hours appear)

Carried over from September                     Remove from board
```

### Sections

| Section | Behavior |
|---|---|
| **Header** | Type, author, title, link (opens in a new tab, `rel="noopener"`). Status select mirrors the board columns and moves the card (same rules as Move to). |
| **Footer** | "Carried over from {months}" when carried; **Remove from board** (quiet destructive link; same undo toast as the board, closes the drawer). |
| **Skills** | Chips open the skill sheet. **Edit** opens a popover with checkboxes for visible skills (1–3) and a **Primary** radio among the checked ones (the primary skill gets full impact weight). Changes affect only this card (not the material) and update radar and count KRs immediately. |
| **KR link** (C-8) | Linked: "Counts toward {objective} · {KR}" with Change · Unlink. Not linked and active KRs exist: "Link to a key result ▾" (KRs whose skill matches come first). No objectives: "Set your year to connect this to a goal" → `/okrs/plan`. Below it, muted and automatic: "Also counts toward {count KR titles}" for current-quarter count KRs whose skill is on the card. |
| **Tasks** (C-2) | Milestone tasks and "Summarize in my words" are created on Add (built). Check, rename on click, delete on hover (×), "+ Add a task" (Enter adds and keeps focus for the next). "Summarize in my words" checks itself the first time the summary is saved non-empty, and can be unchecked manually. |
| **In my words** (C-3) | The card's summary **is** its summary note in the Notebook (same record). Plain text, auto-growing. **Review later ▾** (Tomorrow · In a week · In a month · Pick a date…; when set, shows "Review Oct 25" with Clear). **Get feedback from Claude** is enabled at 20+ characters (below). |
| **Notes** | The card's item note in the Notebook (same record). Plain text, auto-growing. |
| **Reminder** (C-4) | Date (today or later) + one-line note (≤ 120 chars). Shows on the dashboard Reminders widget. Clear removes it. |
| **About this material** (C-1) | Collapsed by default; the brief from the catalog or the own material. Own materials show **Edit details** (opens the Add-your-own form in edit mode). |
| **Time** (C-5) | Collapsed by default. Estimate (hours, decimal) and time logs (date + hours, list with delete). Hours are shown nowhere else (ADR 006). |

### Get feedback from Claude

- Sends material title, author, brief and the summary (existing `refine-summary` feature).
- Loading: button reads "Reading your summary…", the textarea stays editable; Cancel link.
- Result appears in a panel under the summary, never replacing it:
  ```
  What works      · You name the core trade-off clearly.
  What's missing  · The book's point about outcome metrics.
  Try             · Lead with the idea, then the example.
  A tighter version (optional)
    "…"                                  [Use this version]  [Keep mine]
  ```
- **Use this version** replaces the summary (undo toast "Summary replaced · Undo") and sets `refinedAt`. Keep mine or closing the panel discards the suggestion. Feedback is not stored.
- Errors: inline under the button with the reason ("Claude couldn't respond this time. Try again." / "Your Claude key was rejected. Check it in Settings.").
- Claude off: the button is replaced by a muted line "Want feedback on this? [Turn on Claude](/settings#claude)".

### Read-only mode (past months, archived years)

Header status, Remove from board, skills Edit, KR link, tasks, reminder and time are read-only or hidden. **In my words, Notes and Review later stay editable**: knowledge is never frozen.

## States

| State | Behavior |
|---|---|
| Material missing (e.g. from an imported file) | Title "Removed material", brief hidden; summary and notes still editable. |
| Empty summary/notes | Placeholders as above. A note record is only created once it has text; clearing the text removes it from the Notebook. |
| Unknown `?item=` | Drawer doesn't open; board toasts "That card no longer exists." |
| Long content | Drawer body scrolls; header stays pinned. |
| Sample mode | Fully editable. |

## Acceptance criteria

- [ ] The drawer opens from click, Enter, ⋯ → Open and `/board?item=<id>`; closes with Esc, ×, scrim and Back; focus returns to the card.
- [ ] Sections appear in the order above; About and Time are collapsed by default; hours appear only in the Time section.
- [ ] The summary and notes are the same records the Notebook shows; editing in either place updates both.
- [ ] "Summarize in my words" checks itself on the first non-empty summary save.
- [ ] Skill edits are per card, limited to 1–3 visible skills, and update the radar and count KRs.
- [ ] The KR row shows linked / link / Set your year states and the automatic "Also counts toward" line.
- [ ] Get feedback shows what works, what's missing, suggestions and an optional tighter version, and only replaces the summary on "Use this version" (undoable).
- [ ] With Claude off, the Turn on Claude line replaces the Get feedback button.
- [ ] Past-month and archived cards are read-only except summary, notes and review later.
- [ ] The drawer is a labelled dialog with a focus trap, works at 375 px as a full-screen sheet, and every control is keyboard operable.
