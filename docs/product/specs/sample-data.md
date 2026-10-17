# Sample data

PRD: H-7 · ADR [009](../../decisions/009-sample-mode-and-device-preferences.md)

## User story

As a visitor (often a hiring manager on the hosted link), I want to see Growloop full of realistic data in one click, and get back to my own workspace just as easily, so I can judge the product without setting anything up and without risking my real data.

## Behavior

### Two workspaces, one switch

- The **own workspace** is stored under `growloop:data` (unchanged).
- The **sample workspace** is generated from the seed, dated around today, and stored under `growloop:sample` while sample mode is on.
- `sampleMode: true` in device preferences (`growloop:device`) selects which one the store loads. While it is on, nothing is ever written to `growloop:data`.
- Sample data is fully editable, so visitors can drag, write and plan. Edits last until they exit.
- Every entry starts from a fresh sample (`growloop:sample` is overwritten on entry and deleted on exit).
- Switching in one tab switches all open tabs (storage event on `growloop:device`).

### Entry points

1. First-launch screen: **Try sample data**.
2. Settings → Your data: **Try sample data** with the line "Your own data stays safe and comes back when you exit."

There is no separate demo build. The hosted app and a local install behave the same (`NEXT_PUBLIC_DEMO_MODE` is retired; see ADR 009).

### The banner

A slim, full-width band at the top of the content column on every page while sample mode is on. Brand-soft background, not dismissible.

> You're viewing sample data · **Start fresh**

If the own workspace already has data, the action reads **Back to my data** instead. Both do the same thing: leave sample mode, delete the sample, load the own workspace, go to the Dashboard, toast "Back to your own data." (or "Fresh start. It's all yours." when the own workspace is empty).

### What sample mode changes

| Area | In sample mode |
|---|---|
| Import JSON | Disabled: "Leave sample data to import." |
| Export JSON | Allowed; file name `growloop-sample-YYYY-MM-DD.json`. |
| Erase everything | Hidden (Start fresh does the job). |
| Claude | Works normally if a key or Claude Code is available; prompts send sample content only. |
| Profile name | Empty, so the greeting is "Good afternoon". |
| Tour | Available; the tour offer shows if not yet dismissed on this device. |
| First-launch screen | Never shown. |

### Seed content (authored in the current schema, shifted to today)

The seed tells one coherent story: a mid-level PM working toward a promotion.

- **Profile:** role Product Manager, goal "A promotion", skill levels Roadmapping 2 → 4, Stakeholder Management 2 → 4, Product Discovery 3 → 4.
- **Objectives** (one per quarter, current quarter = Q0):
  - Q-1 "Make customer discovery a weekly habit", **closed at 80%** (shows quarter close history).
  - Q0 "Lead roadmap conversations with confidence": material KR (Product Roadmaps Relaunched, in progress) and count KR (3 Roadmapping items, 2 done).
  - Q+1…Q+4: "Bring stakeholders along on big decisions", "Test ideas before they cost engineering time", "Run an outcome-based roadmap", "Lead hard conversations with calm", each with 2 KRs.
  - If Q-1 falls in the previous calendar year, that year is seeded as archived, so no year wrap is pending.
- **Board, current month:** Backlog 2 · To do 2 · In progress 2 · Done 7 (the existing demo items), 1 card carried over from last month. No certification cards, so a first drag to Done never surprises a visitor with the "earned?" question.
- **History:** 3 previous months with done items and month reviews recorded, so the hero bars, streak and radar look lived-in. No review is pending.
- **Notes:** 5 card summaries (2 refined), 2 card notes, 2 free notes ("Questions for my 1:1", "Roadmap review prep"); 1 note due for review today, 1 due in 3 days.
- **Reminders:** 3 in the next two weeks.
- **Library:** 6 saved catalog items plus the existing own item (team interview playbook).
- **Dashboard layout:** default.

## States

| State | Behavior |
|---|---|
| Entering | Instant; no loading state beyond the normal data gate. |
| Storage blocked | Sample works in memory for the session; the storage banner explains changes won't last. |
| Own data invalid on exit | Normal invalid-data path (backup banner); sample is still deleted. |
| Seed fails validation (dev bug) | Sample mode is not entered; toast "Couldn't load the sample. Try again." and an error in the console. Covered by a unit test so it can't ship. |

## Acceptance criteria

- [ ] Entering sample mode never modifies `growloop:data`; a byte-for-byte check before and after a sample session passes.
- [ ] The banner shows on every page in sample mode, with "Start fresh" when own data is empty and "Back to my data" otherwise.
- [ ] Exiting deletes `growloop:sample`, restores the own workspace and shows the matching toast.
- [ ] Re-entering starts from a fresh sample.
- [ ] Sample dates are relative to today: current quarter has the in-progress objective, the board's current month is populated, one note is due today.
- [ ] Import is disabled and Erase everything is hidden in sample mode.
- [ ] Switching modes in one tab updates other open tabs.
- [ ] The seed validates against the current schema in a unit test.
- [ ] The hosted build and a local build behave identically on first visit; `NEXT_PUBLIC_DEMO_MODE` no longer exists in code, README or `.env.example`.
