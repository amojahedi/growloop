# Navigation and empty states

PRD: NAV-1 to NAV-4, H-1 · Visual reference: Linen (`design/directions/2-warm.html`)

## User story

As a user, I want a calm, predictable frame where I always know where I am, and pages that tell me what to do when they're empty, so that nothing feels broken or confusing on day one.

## App shell

```
┌ sidebar (252 px) ──────────┐┌ top bar ─────────────────────────────────────────┐
│ [sprout] Growloop          ││ Growloop / Board                       (?)  (☀) │
│                            │├──────────────────────────────────────────────────┤
│ ▣ Dashboard                ││ [sample banner, when on]                         │
│ ▥ Board                    ││                                                  │
│ ▤ Library                  ││ page                                             │
│ ✎ Notebook             2   ││                                                  │
│ ◎ OKRs                     ││                                                  │
│                            ││                                                  │
│ Q4 2026                    ││                                                  │
│ ◔ Lead roadmap convers… 53%││                                                  │
│                            ││                                                  │
│ ⚙ Settings                 ││                                                  │
│ Saved on this device       ││                                                  │
│ ● Claude on                ││                                                  │
└────────────────────────────┘└──────────────────────────────────────────────────┘
```

### Navigation (NAV-1)

| Order | Label | Route | Icon | Badge |
|---|---|---|---|---|
| 1 | Dashboard | `/` | layout-dashboard | — |
| 2 | Board | `/board` | kanban | — |
| 3 | Library | `/library` | library | — |
| 4 | Notebook | `/notebook` | notebook-pen | Due notes count (hidden at 0) |
| 5 | OKRs | `/okrs` | target | — |
| bottom | Settings | `/settings` | settings | — |

- Order follows use: the month (Dashboard, Board) first, then where things come from and go to (Library, Notebook), then the yearly view (OKRs).
- One-word labels; "My" prefixes dropped. "Library" is the merged Resources + My Library page (built; "Show: In my library" covers My Library).
- **Removed:** Skills (now the skill sheet + Settings → Skills). **Not added:** Help (top bar), Guide (via Help).
- Nav items carry `data-tour="nav-<label lowercased>"`.

### Sidebar objectives slot (NAV-2)

- Under the nav: the **current quarter's active objectives** ("Q4 2026"), each a progress ring + title (one line, truncated) + %, linking to `/okrs`. At most 3; "+ n more" beyond.
- No objectives at all: **Set your year** → `/okrs/plan`. Objectives exist but none this quarter: "Nothing set for Q4 · Plan it" → `/okrs/plan`.

### Sidebar footer (NAV-3)

"Saved on this device" (muted) and the Claude status dot + label ("Claude on" / "Claude off" / "Claude…"), linking to `/settings#claude`. Settings sits just above.

### Top bar

- Left: breadcrumb "Growloop / {Page}" (the page title only; no deeper levels).
- Right: Help (?) and the color-mode toggle (built).
- **Removed from the global top bar:** the month switcher (now in Dashboard and Board headers only).
- **Cut from the Linen mockup for MVP:** ⌘K search and the global "Add material" button. The Library's search and Add your own cover both; a global path can come later.

### Mobile (< 768 px) (NAV-4)

The sidebar collapses into a top bar: logo, page title, menu button. The menu opens a left sheet with the full sidebar (nav, objectives slot, footer). Help and the color toggle stay in the top bar. Drawers become full-screen sheets.

### Routes

| Route | Page |
|---|---|
| `/` | Dashboard |
| `/board` | Board (`?item=` opens a card) |
| `/library` | Library (built) |
| `/notebook` | Notebook |
| `/okrs` | OKRs (`?year=`) |
| `/okrs/plan` | OKR wizard |
| `/settings` | Settings |
| `/guide` | How Growloop works |
| `/skills`, `/skills/*` | Redirect to `/settings#skills` |
| anything else | Not found: "This page doesn't exist." [Go to your dashboard] |

## Empty states

Rule: at most two short sentences and one action. Icon-sized line illustrations only (lucide), no large artwork.

<a id="dashboard"></a>

### Dashboard

| Widget | Empty copy | Action |
|---|---|---|
| Header momentum line | A fresh month. Pick something worth your time. | link to Library |
| Items completed (hero) | 0 · Your first finished item will show up here. | — |
| OKR progress | **Set your year** · Two questions, then a draft plan you can edit. | Plan my year |
| Skill radar | Add something to your board to see which skills it grows. | — |
| Due for review | Nothing to review. Mark a note Review later to see it here. | — |
| Upcoming reminders | No reminders. Add one from any card. | — |
| Learning streak | Finish a task to start your streak. | — |
| Notes & summaries | Summaries you write land here. | — |

<a id="board"></a>

### Board

| Situation | Copy | Action |
|---|---|---|
| Nothing on the board and nothing in Backlog | **Nothing on your October board yet.** Three to five things is a good month. | [Find something to learn] → `/library` |
| To do empty, Backlog has items | Pick 3 for October. Drag from Backlog, or use ⋯ → Move to To do. (inside the To do column) | — |
| To do empty, Backlog empty | Add from the Library to plan this month. | link to Library |
| Backlog column empty | Things you'll do, just not this month. | — |
| In progress empty | Drag a card here when you start. | — |
| Done empty | Finished cards land here. | — |
| Filters match nothing | No cards match these filters. | [Clear filters] |
| Past month with nothing | Nothing was planned for September. | [Back to October] |

### Library (built; copy aligned)

| Situation | Copy | Action |
|---|---|---|
| Filters/search match nothing | **Nothing matches.** Try fewer filters, or add the thing you have in mind. | [Clear filters] [Add your own] |
| Show: In my library, empty | **Your library is empty.** Save anything that looks good, or add your own. | [Add your own] |

### OKRs, Notebook, skill sheet

See [okrs-and-wizard.md](okrs-and-wizard.md#empty-state), [notebook.md](notebook.md#states), [skills.md](skills.md#skill-sheet).

## Loading

- All data pages render inside the data gate: a page-shaped skeleton until saved data is loaded (built). No spinners for local data.
- Claude actions show inline progress on the button ("Asking Claude…", "Reading your summary…", "Claude is drafting your plan…") and always offer Cancel.

<a id="errors"></a>

## Errors

| Situation | Treatment |
|---|---|
| Saved data unreadable | Existing backup banner: "Your saved data couldn't be read, so Growloop started fresh. A copy of the old data was kept." [Download backup] [Delete backup] (delete uses an undo toast, not confirm). |
| Storage blocked or full | Banner (new): "Your browser is blocking storage, so changes last only until you close this tab." Not dismissible for the session. |
| Data from a newer version | Same as unreadable (built: migration refuses newer versions and backs up). |
| Claude errors | Inline next to the action, specific when known (rejected key, timeout, busy, offline), with Try again. Never a modal. |
| Unknown deep link (`?item=`, `?note=`) | Toast or in-pane message as specified per page. |

## Acceptance criteria

- [ ] Sidebar nav is Dashboard, Board, Library, Notebook, OKRs, with Settings at the bottom; no Skills item.
- [ ] The Notebook item shows the due count when > 0.
- [ ] The objectives slot shows the current quarter's objectives with rings and %, or the right "Set your year"/"Plan it" link.
- [ ] The footer shows "Saved on this device" and the live Claude status linking to Settings.
- [ ] The top bar has the breadcrumb, Help and color toggle only; no month switcher, search or global Add.
- [ ] Below 768 px the sidebar becomes a menu sheet and drawers become full-screen sheets.
- [ ] Every route in the table exists; `/skills*` redirects; unknown routes show the not-found page.
- [ ] Every empty state above uses the given copy and action.
- [ ] Blocked storage shows the new banner; the backup banner no longer uses `window.confirm`.
