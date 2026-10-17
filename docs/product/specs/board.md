# Board and month-end review

PRD: B-1 to B-7, R-1 to R-4 · ADR [007](../../decisions/007-yearly-okrs-and-cycles.md)

## User story

As a learner, I want one board for this month where I move things from planned to done, and a short wrap-up when the month ends, so that I commit to a realistic amount and learn from what didn't happen.

## Board behavior (`/board`)

Already built: four columns, drag and drop within and between columns, skill impact bars on cards, skill and objective filters. This spec covers what changes.

### Header

```
Board                                          ‹ October 2026 ›
7 of 14 done                          [Skills ▾] [Objective ▾]
```
- **Month switcher** lives in the Board and Dashboard page headers only (removed from the global top bar). It opens on the current month and goes **back only**: next is disabled on the current month; previous stops at the earliest month that has a plan item. "This month" link appears when viewing the past. The selected month is shared with the Dashboard for the session and resets to the current month on reload.
- **Progress line:** "{done} of {planned} done", where planned = To do + In progress + Done in the month (Backlog excluded). Hidden when planned is 0. No hours.
- **Filters:** Skills uses the Library's multi-select popover (same component, same chips); Objective is a single select of the viewed quarter's objectives. Active filters show as removable chips; "Clear filters".

### Cards

Card content is unchanged (type icon, title, skill impact bars, task count, reminder date, "Carried over" chip, "KR" tag when linked) except:
- The trash button is removed from the card face (it moves into the ⋯ menu).
- A **⋯ button** sits in the card's top-right corner. It is visible on hover and focus-within for fine pointers, and always visible on touch devices (`@media (hover: none)`). Accessible name: "Actions for {title}".
- Clicking the card body or pressing Enter on a focused card opens the card drawer ([card-detail.md](card-detail.md)) and sets `?item=<id>`.

### Move to… (WCAG 2.5.7 alternative to dragging)

The ⋯ menu:
```
Open
─────────
Move to   Backlog
          To do
          In progress
          Done
Move up
Move down
─────────
Remove from board
```
- The current column is omitted from "Move to". Move up/down appear only when the card has a neighbour in that direction.
- Moving appends to the end of the target column (same rules as drag: entering Done stamps completion, leaving Done clears it; leaving Backlog schedules into the viewed month).
- After a move, focus returns to the moved card in its new place and a polite live region announces "Moved {title} to In progress." (same announcer as keyboard drag).
- **Remove from board** removes the card immediately and toasts "Removed from October · Undo". Its summary and notes stay in the Notebook (notes keep `materialId`); its activity history stays.
- The existing keyboard drag (focus card, Space, arrows, Space) stays as the power-user path.

### Moving to Done

- **Certification items:** a small dialog: "Did you earn {short title}?" [Yes, I earned it] [Not yet]. Yes sets `earnedAt` on the plan item. Not yet leaves it Done but not earned; the card and the KR row then offer "Mark as earned".
- **No summary yet:** toast "Nice. Add a two-line summary while it's fresh?" [Write summary] opens the card with the summary field focused. Shown at most once per card.

### Past months

- Read-only: no drag, ⋯ shows only Open; the Backlog column is hidden (Backlog is a rolling pool that belongs to the current month).
- Banner above the columns: "You're looking at September. Cards are read-only, but notes stay editable. [Back to October]".
- Cards open in the drawer in read-only mode except summary, notes and review later ([card-detail.md](card-detail.md)).

### Opening a card from elsewhere

`/board?item=<id>`: if the item belongs to another month (or the rolling Backlog), the board switches to that month (Backlog items open on the current month) and opens the drawer. Unknown id: the board opens normally and toasts "That card no longer exists."

The Library's "On board" button links to `/board?item=<id>` instead of plain `/board`.

## Month-end review

<a id="month-end-review"></a>

### When it is due

A review is **pending** when any of these is true:
1. Items in months before the current month are still To do or In progress (existing rule).
2. Active objectives sit in quarters that have ended (the quarter close).
3. A calendar year before the current one has objectives, is not archived, and has no active objectives left after step 2 (the year wrap).

A month where everything was finished and no quarter ended needs no review. Backlog items are never reviewed.

### Where it shows (never blocking)

- **Board:** banner above the columns: "September is done. Wrap it up in a minute." [Wrap up September]
- **Dashboard:** a "Wrap up September" button next to Open board ([dashboard.md](dashboard.md)).
- Both stay until the review is completed. Several missed months combine into one review ("Wrap up August and September").

### The review dialog

One dialog, sections stacked, one **Done** button. Title: **Wrap up September** (or the combined months).

1. **Recap** (always): one line of three figures, each a small serif number with a label: "7 finished · 5 summarized · Roadmapping grew most". If nothing was finished: "A quiet month. That happens."
2. **Unfinished** (if rule 1): a row per item: title, "To do" or "In progress" chip, "Carried twice" chip when `carriedFrom` has 2+ months, and a segmented control **Carry over · Backlog · Drop**.
   Defaults: In progress → Carry over; To do → Backlog; anything carried twice → Backlog.
   Note under the list: "Dropped items leave the board. Their notes stay in your Notebook."
3. **Close Q3** (if rule 2; one block per ended quarter): a row per active objective with its score and a segmented control **Close at 64% · Move to Q4**. Default: Close. Move is disabled with a hint when `movedFrom` is set ("Already moved once") or the next quarter's year is at its cap ("2027 already has 4 objectives"), and hidden when the next quarter is outside the plannable window. Objectives at 100% show "Met" with no control.
4. **Wrap up 2026** (if rule 3): "2026 is done: 41 things finished, 4 objectives closed. Archive it to keep your OKRs focused on what's next. You can still open it under Archive." Checkbox **Archive 2026**, on by default.

Buttons: **Done** (applies everything, records the review, toasts "September is wrapped up.") · Later (closes; banner stays).

**Applying:**
- Carry over → item moves to the current month, keeps its status, appends the old month to `carriedFrom`.
- Backlog → status Backlog (rolling pool), `carriedFrom` appended.
- Drop → card removed; notes and activity kept.
- Close → `status: closed`, `finalProgress` = current score.
- Move → `quarter` = next quarter, `movedFrom` = old quarter; KRs and links kept.
- Archive → year added to `archivedYears`; its objectives become read-only under the Archive tab. If unticked, the 2026 tab shows a small "Archive 2026" button until done.

*Cut from the earlier flow:* the separate "Plan November" step. The board's empty To do state already prompts picking from Backlog ([navigation-and-empty-states.md](navigation-and-empty-states.md)), so the review stays a one-minute task.

## States

| State | Behavior |
|---|---|
| Empty board / empty columns / no filter matches | See [navigation-and-empty-states.md §Board](navigation-and-empty-states.md#board). |
| Drag in progress | Skill preview paused (built); ⋯ buttons hidden on all cards. |
| Reduced motion | No drop animation (built). |
| Missed a whole quarter and more | Each ended quarter gets its own Close block, oldest first; the move target for an old quarter is the next quarter only if it is in the window, otherwise only Close. |
| Sample mode | No review pending in the seed. |

## Acceptance criteria

- [ ] The month switcher appears only on Board and Dashboard, cannot go past the current month, and shares the selected month between them.
- [ ] The progress line shows done / planned excluding Backlog and never shows hours.
- [ ] Skill filter is multi-select with chips (shared Library component); objective filter lists the viewed quarter's objectives.
- [ ] Every card has a ⋯ menu with Open, Move to (other columns), Move up/down (when possible) and Remove from board; it is reachable by keyboard and visible on touch devices without hover.
- [ ] Moving via the menu announces the move and keeps focus on the moved card.
- [ ] Remove from board is undoable for 8 s and never deletes the card's notes.
- [ ] Moving a certification item to Done asks "Did you earn…?"; moving any item without a summary to Done offers the summary toast once.
- [ ] Past months are read-only, hide Backlog, and show the "You're looking at…" banner.
- [ ] `/board?item=<id>` opens the right month and the drawer; unknown ids toast.
- [ ] A review is pending exactly when rules 1–3 say so; it never blocks the board.
- [ ] The review dialog shows recap, unfinished items with the stated defaults, quarter close with the one-move rule, and the year archive, and applies them as specified in one Done.
- [ ] Multiple missed months produce one combined review.
- [ ] Unit tests cover pending rules, defaults, carry-over counting, close/move and archive.
