# Dashboard

PRD: D-1 to D-9 · ADR [006](../../decisions/006-core-metric.md)

Already built: the customizable widget grid (gallery, reorder, S/M/L, reset), the locked items-completed widget, OKR progress, skill radar with completed vs projected and hover preview, reminders, streak, notes. This spec covers the Linen header, the hero, one new widget and the review entry.

## User story

As a learner opening Growloop, I want a warm, one-glance answer to "how is my month going?", so that I feel momentum and know what to do next.

## Header

```
Sunday, 18 October                                 ‹ October 2026 ›
Good afternoon, Aisan                     (Fraunces, display size)
You've finished 7 things this month, 3 more than September. Lovely momentum.
[Open board]  [Wrap up September]  [Customize]
```

- **Date line:** weekday, day and month, muted.
- **Greeting:** "Good morning" (05:00–11:59), "Good afternoon" (12:00–17:59), "Good evening" (otherwise), plus ", {name}" when a name is set in Settings.
- **Momentum line** (one line, never guilt). For the current month, with n = finished this month, d = n − last month, k = To do + In progress:

| Case | Copy |
|---|---|
| n > 0, d > 0 | You've finished {n} things this month, {d} more than {Prev}. Lovely momentum. |
| n > 0, d = 0 | You've finished {n} things this month, same as {Prev}. Steady does it. |
| n > 0, d < 0 | You've finished {n} things this month. {days} days to go. |
| n = 0, k > 0 | {k} things lined up for {Month}. Pick one to start. |
| n = 0, k = 0 | A fresh month. Pick something worth your time. ([Library](/library) link on "Pick something") |
| Past month viewed | In {Month} you finished {n} things. |

  "thing/things" agrees with the number; "1 more", not "1 more things".
- **Actions:** **Open board** (primary) · **Wrap up {Month}** (brand-soft, only when a review is pending; opens the review dialog) · **Customize** (built).
- The month switcher sits at the header's right (back only, shared with the Board).

## Hero (the locked items-completed widget)

```
Items completed
7                 +3 vs Sep
3 books · 2 articles · 2 other · 5 of 7 summarized
▁ ▂ ▃ ▂ ▅ █        May Jun Jul Aug Sep Oct
```
- Big number in the display serif (Linen hero size). Delta chip: "+3 vs Sep", "Same as Sep", "−2 vs Sep" (neutral color for negative, never red).
- Breakdown by type (top two types + "other"), then "{summarized} of {n} summarized" (reflection rate; omitted when n = 0).
- Six-month bars ending at the viewed month; the viewed month is highlighted; each bar has an accessible label ("September: 4 finished"). Hidden at size Small; shown at Medium and Large.
- n = 0: big "0" and "Your first finished item will show up here."
- `data-tour="widget-items-completed"`.

## New widget: Due for review

- Registry id `due-for-review`, title "Due for review", gallery line "Notes you asked to see again.", default size Small, in the default layout after Skill radar.
- Lists the 3 oldest due notes (source title, kind, due date as "today", "yesterday" or "Oct 12") each linking to `/notebook?note=<id>`; then "{n} more" → `/notebook?due=1`.
- Empty: "Nothing to review. Mark a note Review later to see it here."
- Saved layouts from before this widget don't get it automatically; it appears in the Add widget gallery (registry rule: never inject into saved layouts).

## Other widget changes

| Widget | Change |
|---|---|
| OKR progress | New KR model (type icons, "2 of 3", "In progress · 60%"); no objectives → the "Set your year" prompt ([onboarding.md](onboarding.md#soft-gate-set-your-year)). |
| Skill radar | Axis labels are buttons that open the skill sheet. |
| Notes & summaries | Reads Notebook notes (all kinds, latest 5); each item opens `/notebook?note=<id>`; "View all" → `/notebook`. |

Default order: Items completed (locked) · OKR progress · Skill radar · Due for review · Upcoming reminders · Learning streak · Notes & summaries. Hours never appear (ADR 006).

## States

| State | Behavior |
|---|---|
| New user, empty | Greeting + "A fresh month…" line; widget empty states per [navigation-and-empty-states.md](navigation-and-empty-states.md#dashboard). |
| Past month | Momentum line in past tense; Wrap up button still shows if pending. |
| Loading | Header skeleton (two lines) + grid skeleton. |
| Sample mode | Seeded data; no Wrap up button (no pending review). |

## Acceptance criteria

- [ ] The greeting follows the time windows and includes the name only when set.
- [ ] The momentum line picks the right case from the table, agrees in number, and never shows hours.
- [ ] Open board is primary; Wrap up {Month} appears only when a review is pending and opens the review dialog.
- [ ] The hero shows the big number, delta chip, type breakdown, summarized count and six-month bars (Medium and Large).
- [ ] Due for review lists the 3 oldest due notes with links, shows "n more", and has the empty copy; it is in the default layout and the gallery but not injected into saved layouts.
- [ ] Radar axis labels open the skill sheet; the notes widget reads notes.
