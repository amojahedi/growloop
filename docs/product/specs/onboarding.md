# Onboarding

PRD: H-6, O-6 · Owner decision: "straight in", no welcome questions.

## User story

As a first-time visitor (local install or the hosted link), I want to start in one click, either by planning my year, by looking around a filled-in workspace, or by just exploring, so that I get value before I invest effort.

## Behavior

### First-launch screen

Shown once per device, on whatever page the visitor lands, when **both** are true:
- the device has no `welcomeDoneAt` (device preference, not part of the workspace), and
- the own workspace is empty (no objectives, plan items, notes, saved or own materials).

Existing users with data never see it; the empty-workspace check covers them without a migration.

It is a centered card over the dimmed, empty app shell (not a separate route), so the product is visible behind it. It is a modal dialog: focus starts on the primary button; Esc equals **Skip for now**.

```
        [sprout] Growloop

   Grow on purpose, a month at a time.
   Set a few goals for the year, learn a little each month,
   and keep what sticks.

   [ Set your year ]          ← primary
   [ Try sample data ]        ← secondary
     Skip for now             ← text link

   No account. Your data stays in this browser.
```

| Choice | Result |
|---|---|
| **Set your year** | Sets `welcomeDoneAt`; navigates to `/okrs/plan` (wizard). Cancelling the wizard lands on the Dashboard. |
| **Try sample data** | Sets `welcomeDoneAt`; enters sample mode ([sample-data.md](sample-data.md)); lands on the Dashboard. |
| **Skip for now** / Esc | Sets `welcomeDoneAt`; closes; stays on the current page. |

No name prompt. The greeting works without a name; a name can be added in Settings → Profile.

### Tour offer (not an auto-started tour)

After the first-launch screen closes and the visitor is on the Dashboard (immediately for Skip and Try sample data; after accepting or cancelling the wizard for Set your year), a small non-modal card appears bottom-left, above the sidebar footer, once per device:

> **New here?** Take the one-minute tour.  [Start tour]  [×]

Start tour runs the tour ([help-and-guide.md](help-and-guide.md)). × or Start sets `tourOfferDismissedAt`. It never reappears; the tour stays available from Help.

*Why not auto-start (changes H-3):* the owner asked for "straight in". A one-line offer keeps the tour discoverable without putting a modal sequence between the visitor and the product.

### Soft gate: "Set your year"

Objectives are asked for, never forced (O-6). Until at least one active objective exists, the app shows one calm prompt in each place objectives would appear, all linking to `/okrs/plan`:

| Place | Copy |
|---|---|
| Sidebar objectives slot | **Set your year** → |
| Dashboard OKR widget | **Set your year** · Two questions, then a draft plan you can edit. [Plan my year] |
| OKR page | Empty state, see [okrs-and-wizard.md](okrs-and-wizard.md#empty-state) |
| Add toast (Library) | "Added to October · Set your year" instead of the KR link |

Nothing is locked. There is no nagging beyond these slots.

### Closed mid-way

The wizard keeps answers for the browser session (UI store), so reopening `/okrs/plan` in the same session resumes on the same step. The first-launch screen is already done once a choice was made.

## States

| State | Behavior |
|---|---|
| Storage blocked (private mode) | First-launch screen shows every load (no `welcomeDoneAt` can persist) plus the storage banner ([navigation-and-empty-states.md](navigation-and-empty-states.md#errors)). Acceptable. |
| Deep link on first visit (`/board?item=…`) | Screen shows over that page; after Skip the page renders its empty state. |
| Claude available or not | No difference on this screen. The wizard decides how to draft. |
| Sample mode already active (other tab) | Screen not shown; sample banner instead. |

## Acceptance criteria

- [ ] A brand-new device with an empty workspace shows the first-launch screen once, on any route.
- [ ] A device with existing workspace data never shows it, even without `welcomeDoneAt`.
- [ ] Set your year opens `/okrs/plan`; Try sample data enters sample mode; Skip and Esc close it; all three set `welcomeDoneAt`.
- [ ] No name or other question is asked.
- [ ] The tour offer appears once on the Dashboard after the first-launch choice, never during the wizard, and never again after Start or ×.
- [ ] Until an active objective exists, the sidebar, OKR widget, OKR page and Add toast show the "Set your year" prompt; nothing is blocked.
- [ ] The dialog traps focus, is labelled by its heading, and returns focus to the page on close.
- [ ] `welcomeDoneAt` and `tourOfferDismissedAt` live in device preferences and are not in exports.
