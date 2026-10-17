# Build plan: remaining MVP

| | |
|---|---|
| **Specs** | [`specs/`](specs/README.md) · [PRD](../PRD.md) · [UX flows](../design/ux-flows.md) · ADR 009–011 |
| **Date** | 2026-10-18 |

## What I decided and why

1. **Straight in.** One first-launch screen (Set your year · Try sample data · Skip), no questions; the tour starts once on the first visit (skippable) and is replayable from Help. Visitors reach the product in one click.
2. **Sample data is a separate workspace** with an exit banner, so trying it can never touch your own data. One build for hosted and local; the demo flag is retired.
3. **Key results are typed and computed** (material, certification, count; one skill each; no manual progress). Count KRs count by skill, so linking a card is optional, and material KRs link themselves.
4. **The wizard is two steps with two engines:** role + goal, then skills + levels. Claude or a deterministic quick draft produce the same plan and the same inline review, so the no-AI path is good, not a bare form.
5. **Writing lives in notes.** A card's summary and notes are Notebook notes, in plain text, and survive when the card goes. No tags, no rich text.
6. **One drawer per card**, ordered by what you do while learning: tasks, summary, notes, reminder; reference material and hours collapsed at the bottom.
7. **Accessible without clutter:** a ⋯ menu on each card (Move to, up/down, remove) replaces visible arrows and the trash icon, and satisfies WCAG 2.5.7.
8. **One month-end ritual:** a single dialog, shown only when a decision is needed, that also closes quarters and archives years. The separate "plan next month" step is cut.
9. **Skills are a lens, not a page:** a skill sheet from any chip or radar axis, management in Settings. Nav is Dashboard, Board, Library, Notebook, OKRs; no global search or Add yet.
10. **Claude stays optional and private:** own key kept in the browser and sent only to Anthropic (strict CSP, Forget key), Claude Code when local, and a working fallback next to every Claude action.

## Starting point

Built and staying: app shell and tokens (Linen light/dark), local store with migrations (schema v3), Library (catalog + my items, multi-select filters, Add, Save, brief, Add your own with Claude), board with drag and drop, customizable dashboard with skill radar and skill impact, local Claude Code bridge.

Missing: card detail, Notebook, OKR model and wizard, OKR page, month-end review beyond a basic list, Settings beyond data, skill sheet, onboarding, sample mode, help, own-key Claude, Linen dashboard header.

## Phases

```
Phase 0   WP0 Foundation (one agent, serial) ── merge ──┐
                                                         ├─ WP1 Shell, onboarding, help & sample
Phase 1   five packages in parallel, each on its own     ├─ WP2 OKRs & wizard
          branch from main after WP0                     ├─ WP3 Board & month-end review
                                                         ├─ WP4 Card detail & Notebook
                                                         └─ WP5 Settings, skills & Claude key
Phase 2   WP6 Linen polish (after all of Phase 1) ── QA checklist ── release
```

WP0 does every data-model, store and AI-plumbing change at once and leaves **stubs** for cross-package components, so the Phase 1 packages share contracts instead of files.

Relative size: WP0 **L** · WP1 **M** · WP2 **L** · WP3 **M** · WP4 **M** · WP5 **M** · WP6 **M**. WP0 is the critical path; give it the strongest agent and review it hardest.

---

### WP0 Foundation

**Goal:** schema v4, the store actions and domain logic every feature needs, the Claude provider layer, platform pieces and stubs. The app compiles and all tests pass at the end, with existing screens adapted minimally to the new types.

**Schema migration: yes, v3 → v4 (the only schema bump in this plan).** Model and migration: [ux-flows.md §5](../design/ux-flows.md#5-data-model-schema-v4).

Scope:
1. **Model:** types, zod schema, migration v3 → v4 with tests (notes extracted, KRs converted, profile, archivedYears, `earnedAt`, `summaryNudgedAt`); seed still loads via migrations.
2. **Domain (pure, unit-tested):** `okrs.ts` (KR progress per type incl. moved objectives and the 99% cap, objective progress, pace, plannable window, quarter scope for the wizard, year caps); `notes.ts` (due notes, latest notes, search match); `month-review.ts` (replaces `rollover.ts`: pending rules 1–3, defaults, apply incl. close/move/archive); activity sync driven by note changes; dashboard selectors read notes; dates helpers (weeks left in quarter).
3. **Store actions:** profile and skill levels; notes CRUD and review; objectives/KRs in the new shape, close, move, archive; `acceptPlan(draft)` (returns ids for Undo) and `undoAcceptPlan`; `setItemEarned`; `removePlanItem` keeping notes; auto-link KR targets in `addPlanItem`; per-card skills; sample mode enter/exit with the `growloop:sample` key and cross-tab sync; device preferences module (`src/lib/store/device.ts`).
4. **Claude provider layer** (`src/lib/ai/providers/`): own key (browser, `@anthropic-ai/sdk` with `dangerouslyAllowBrowser`, `output_config.format`, models/effort per [settings spec](specs/settings-and-ai-keys.md#model), refusal fallback) → local bridge → off; key storage module (`growloop:claude-key`, validate/save/forget); one shared status hook with `provider: "key" | "local" | null`; prompts split into `src/lib/ai/prompts/*.ts`; new **draft-plan** feature: request/response schemas, prompt v1 per the [wizard spec](specs/okrs-and-wizard.md#claude-prompt-intent-srclibaipromptsdraft-plants), local route `/api/ai/draft-plan`, hook action.
5. **Platform:** CSP and `/skills*` redirects in `next.config.ts`; retire `NEXT_PUBLIC_DEMO_MODE` (env, AI client, route helpers, store merge, README, `.env.example`); toast primitive + Toaster in providers; sheet/drawer primitive; `data-tour="widget-<id>"` on widget frames; UI store additions (`openSkillSheet`, wizard session answers); dev-only clock override (`growloop:dev-now` in development builds) so QA can simulate month, quarter and year ends.
6. **Skill data:** `objectivePhrases` on built-in skills (table in the wizard spec).
7. **Stubs, already mounted** (minimal, typed, replaced in Phase 1, so every package's work is live on `main` as soon as it merges): `CardDetailDrawer({ itemId, onClose })` in `src/features/card/`; `SkillSheet()` in `src/features/skills/`, mounted once in the app shell; `ReviewBanner()` and `MonthReviewDialog({ open, onOpenChange })` in `src/features/review/`, with `ReviewBanner` rendered where the old rollover list was on the Dashboard.
8. Prompts stay isomorphic (no server-only imports) because the own-key provider runs them in the browser.

**Owns (Phase 0):** `src/lib/**`, `src/app/api/**`, `src/components/ui/**` (new primitives only), `src/components/providers.tsx`, `src/data/skills.ts`, `next.config.ts`, `package.json` + lockfile, `README.md`, `.env.example`, the stub files and their two mount points (`src/components/layout/app-shell.tsx`, `src/features/dashboard/dashboard-view.tsx`), and minimal compile fixes anywhere in `src/features/**`.
**Done when:** v3 fixture migrates with zero data loss; all domain rules above have tests; app runs with no visible regressions; CSP produces no console violations.

---

### WP1 Shell, onboarding, help & sample

**Specs:** [navigation-and-empty-states](specs/navigation-and-empty-states.md) (shell, routes, errors), [onboarding](specs/onboarding.md), [sample-data](specs/sample-data.md), [help-and-guide](specs/help-and-guide.md).
**Schema migration:** no (device preferences only).

| Owns | Notes |
|---|---|
| `src/components/layout/**` | Nav order and labels, Notebook badge, sidebar objectives slot, footer Claude status, breadcrumb, Help menu, mobile menu sheet. The month switcher becomes back-only and leaves the top bar. |
| `src/app/layout.tsx`, `src/app/not-found.tsx`, `src/app/guide/**` | |
| `src/app/page.tsx` (one line) | Puts the month switcher in the Dashboard header (WP3 does the same on the Board). |
| `src/features/onboarding/**` | First-launch screen, tour offer. |
| `src/features/help/**`, `src/content/help/**` | Tour engine and steps, guide content as data. |
| `src/features/sample/**` | Sample banner. |
| `src/components/app/backup-banner.tsx`, new `storage-banner.tsx` | Undo instead of confirm; blocked-storage banner. |
| `src/data/demo.ts`, `src/lib/store/seed.ts` (+ test) | Seed rewritten in the v4 shape per the sample spec; shifting covers notes and review dates. |

Merges **last in Phase 1**, so the tour targets and seed cover every feature.

---

### WP2 OKRs & wizard

**Specs:** [okrs-and-wizard](specs/okrs-and-wizard.md).
**Schema migration:** no.

| Owns | Notes |
|---|---|
| `src/features/okrs/**` | Wizard steps, drafting states, review, shared `ObjectiveEditor`, OKR page (year tabs, quarter columns, cards, empty state). |
| `src/app/okrs/**` (incl. `plan/`) | |
| `src/lib/domain/plan-drafter.ts`, `plan-repair.ts` (+ tests) | Quick draft (deterministic, snapshot-tested) and the shared repair step. |
| `src/lib/ai/prompts/draft-plan.ts` | The only file in `src/lib/ai/` this package may edit (prompt tuning). |
| `src/features/dashboard/okr-progress-widget.tsx` | New KR display and "Set your year" state. |

---

### WP3 Board & month-end review

**Specs:** [board](specs/board.md).
**Schema migration:** no.

| Owns | Notes |
|---|---|
| `src/features/board/**` | Header with the month switcher, multi-select skill filter (imports the Library filter popover), ⋯ menu, move announcements, past-month mode, certification dialog, summary nudge, `?item=` handling (renders `CardDetailDrawer`). |
| `src/app/board/**` | |
| `src/features/review/**` | Replaces stubs: banner (also used on the Dashboard until WP6 turns it into the header button) and review dialog (recap, unfinished, quarter close, year archive). |
| `src/features/rollover/**` | Deleted. |
| `src/features/library/resource-actions.tsx` | "On board" links to `/board?item=`. The only Library file this package touches. |

---

### WP4 Card detail & Notebook

**Specs:** [card-detail](specs/card-detail.md), [notebook](specs/notebook.md), [dashboard §Due for review](specs/dashboard.md#new-widget-due-for-review).
**Schema migration:** no.

| Owns | Notes |
|---|---|
| `src/features/card/**` | Replaces the stub: drawer, sections, read-only mode. "Edit details" reuses the Library's `OwnMaterialFields` (import only). |
| `src/components/notes/**` | `NoteEditor`, `RefinePanel`, `ReviewLaterMenu`, shared by card and Notebook. |
| `src/features/notebook/**`, `src/app/notebook/**` | |
| `src/features/dashboard/due-for-review-widget.tsx`, `reflections-feed.tsx` | New widget; notes widget reads notes. |
| `src/features/dashboard/widget-registry.ts` | **One entry only** (`due-for-review`) and its default-layout position. |

---

### WP5 Settings, skills & Claude key

**Specs:** [settings-and-ai-keys](specs/settings-and-ai-keys.md), [skills](specs/skills.md).
**Schema migration:** no.

| Owns | Notes |
|---|---|
| `src/features/settings/**`, `src/app/settings/**` | Five sections, key UI on top of the WP0 provider API, data dialogs. |
| `src/features/skills/**` | Replaces the stub skill sheet; deletes the old skills list/detail views. |
| `src/app/skills/**` | Deleted (redirect lives in `next.config.ts` from WP0). |
| `src/components/skills/**` | New `SkillChip` button (opens the sheet), radar axis click. |
| `src/features/dashboard/skill-radar-widget.tsx` | Wires axis clicks. |
| `src/features/library/ai-recommendations.tsx`, `add-own-dialog.tsx`, `src/lib/store/use-data-transfer.ts` | AI-off copy; import/erase dialogs. |

Merges **first in Phase 1**: other packages adopt `SkillChip` and link to Settings anchors after rebasing.

---

### WP6 Linen polish (Phase 2)

**Specs:** [dashboard](specs/dashboard.md) (header and hero), Linen mockup, all specs' copy and states.
**Schema migration:** only if Phase 1 raised a need (then v4 → v5, here, once).

| Owns | Notes |
|---|---|
| `src/features/dashboard/**` (all files, after Phase 1), `src/app/page.tsx` | Greeting, momentum line, hero bars, Wrap up button, header layout. |
| `src/styles/**`, `src/app/globals.css`, `src/app/fonts.ts`, `src/components/ui/**`, `src/components/app/**` | Typography (Fraunces display, serif numbers), spacing and radius per Linen tokens, card and column styling, sidebar rings, drawers, toasts, focus rings. |
| `design/flows/index.html` | Refresh to match the revised flows. |
| Any file, copy only | Voice pass against the specs; small, separate commits. |

Checklist: Linen fidelity on Dashboard, Board, Library, card drawer, OKRs, Notebook, Settings; light and dark parity; AA contrast (skill text colors via `skillTextColor`); reduced motion; 375 px layouts; empty states use the spec copy; no hours outside the card.

---

## Shared files and rules

| File(s) | Owner | Others may |
|---|---|---|
| `src/lib/domain/types.ts`, `src/lib/store/schema.ts`, `migrations.ts` | WP0 | Nothing. New persisted fields go through WP6 (v5). |
| `src/lib/store/app-store.ts`, `hooks.ts`, `ui-store.ts` | WP0 | Add selectors/actions only, in a marked section per package, as a separate commit; rebase before merge. No changes to existing actions. |
| `src/lib/ai/**`, `src/app/api/**` | WP0 | WP2: `prompts/draft-plan.ts` only. |
| `src/features/dashboard/widget-registry.ts` | WP6 | WP4: one entry. |
| `src/app/page.tsx` | WP6 | WP1: add the month switcher to the header. |
| `src/features/library/**` | frozen | WP3: `resource-actions.tsx`. WP5: `ai-recommendations.tsx`, `add-own-dialog.tsx`. |
| `src/components/layout/month-switcher.tsx` | WP1 | WP3 and WP6 import it. |
| `next.config.ts`, `package.json` | WP0 | New dependencies only if essential, in their own commit; resolve lockfile conflicts by reinstalling. |
| `docs/**` | Product lead | Packages don't edit specs; spec questions go in the PR description. |

**Persisted state rule for Phase 1:** prefer derived state; device-only state goes in device preferences (no migration needed); anything else is raised in the PR and batched into one v5 migration in WP6. No package other than WP0 (and possibly WP6) changes the schema version.

## Merge order

1. **WP0** (blocks everything).
2. **WP5**: brings `SkillChip`, Settings anchors and key UI that others link to; smallest blast radius.
3. **WP4**: real card drawer replaces the stub WP3 renders.
4. **WP3**: board and review, now opening the real drawer.
5. **WP2**: OKRs and wizard; review's quarter close already in place.
6. **WP1**: shell, onboarding, sample seed and tour over the finished features.
7. **WP6**: polish, optional v5.
8. **QA** (below), then release.

Each package branches from `main` after WP0 (`feat/<package>`), rebases before merging, keeps CI green (lint, typecheck, tests, build), lists the PRD IDs it implements, attaches light and dark screenshots, and ticks the acceptance criteria of its specs in the PR.

## QA checklist (release gate)

Run on a production build, light and dark, at 1280 px and 375 px. Use the dev clock override for time-based checks.

**Journeys**
- [ ] Hosted first visit: first-launch screen → Try sample data → banner → tour offer → full tour → Start fresh → empty workspace with "Set your year" prompts.
- [ ] Own data exists → Try sample data → edit sample → Back to my data: own data byte-identical.
- [ ] No Claude: wizard quick draft (same answers twice → same plan) → Accept all → Undo → Accept all → current-quarter material KR card in Backlog, linked.
- [ ] Own key: invalid key rejected without storing; valid key → Claude draft → repair handles a bad material id → accept; Forget key → status off; export contains no key.
- [ ] Local with Claude Code: status "Claude Code on this computer"; key added → key wins.
- [ ] Library Add of a KR target auto-links; "On board" opens the card.
- [ ] Card: tasks, summary (task ticks itself), Get feedback → Use this version → Undo, notes, review later, reminder, time; summary visible and editable in the Notebook.
- [ ] Board keyboard-only: move a card through all columns with the ⋯ menu and with keyboard drag; announcements read; Remove → Undo; certification "earned?" flow.
- [ ] Month end (clock to the 1st): banner and Dashboard button; defaults correct; carry/backlog/drop applied; dropped card's notes still in the Notebook.
- [ ] Quarter end: close and move once; second quarter end disallows a second move.
- [ ] Year end (clock to January): archive 2026 → Archive tab read-only; unticked → "Archive 2026" button on the tab.
- [ ] Notebook: search, chips, skills, Due; reviewed / again; new empty note discarded.
- [ ] Skills: rename, recolor, hide (min 3), delete guarded by KR, undo; sheet from chip, radar axis and Settings; levels shared with the wizard.

**Data and security**
- [ ] v1, v2 and v3 exports import and migrate to v4 with no data loss; a v5 file is refused and backed up.
- [ ] CSP header present; no console CSP violations; network log shows only same-origin and `api.anthropic.com`.
- [ ] Storage blocked (private window with storage disabled): storage banner; app usable in memory.
- [ ] Two tabs: switching sample mode in one switches the other.

**Quality bar**
- [ ] axe: no serious or critical issues on every route, both modes.
- [ ] Every drag has a working non-drag alternative; drawers and dialogs trap and restore focus.
- [ ] Reduced motion removes animations.
- [ ] No hours on the dashboard; no "AI assistant" wording; copy matches the specs.
- [ ] No hydration warnings or layout shift on load.
