# Product specs

Build specs for the remaining MVP work. Each spec has a user story, behavior, states, UI copy and acceptance criteria. Requirement IDs refer to [`docs/PRD.md`](../../PRD.md); the build split is in [`../build-plan.md`](../build-plan.md).

| Spec | Covers |
|---|---|
| [onboarding.md](onboarding.md) | First-launch screen, soft gate, returning users |
| [sample-data.md](sample-data.md) | Sample mode, Exit sample banner, own data kept safe |
| [okrs-and-wizard.md](okrs-and-wizard.md) | KR model, wizard questions and copy, both drafting engines, review, OKR page |
| [board.md](board.md) | Board, Move to… menu, past months, month-end review (incl. quarter close, year archive) |
| [card-detail.md](card-detail.md) | Card drawer: tasks, summary, Refine, notes, reminder, time |
| [notebook.md](notebook.md) | Notes model, editor, organization, review later |
| [dashboard.md](dashboard.md) | Greeting, momentum line, hero, Due for review widget |
| [skills.md](skills.md) | Skill sheet, skill management, skill levels |
| [settings-and-ai-keys.md](settings-and-ai-keys.md) | Settings page, Claude API key, provider status, AI-off copy |
| [help-and-guide.md](help-and-guide.md) | Help menu, tour steps, guide page content |
| [navigation-and-empty-states.md](navigation-and-empty-states.md) | Shell, nav, URLs, every empty/loading/error state |

## Shared conventions (apply everywhere)

**Voice (Linen).** Warm, plain and short. Sentence case. Second person. Digits for numbers. One idea per sentence; empty states are at most two sentences plus one action. No guilt ("You're behind"), no hype, no exclamation marks. Buttons are verbs. "Claude" is the name of the optional feature; never "AI assistant". Separators are " · ".

**Saving.** Everything autosaves locally (debounced ~400 ms for text). There are no Save buttons except in dialogs that create something. A quiet "Saved" appears next to the field for 1.5 s after a text change is stored.

**Undo over confirm.** Reversible actions (remove card, delete note, exit a draft) act immediately and show a toast with **Undo** (8 s). `window.confirm` is replaced everywhere by either an undo toast or, for destructive whole-workspace actions (Import, Erase everything), a proper dialog.

**Toasts.** Bottom-right on desktop, bottom-center on mobile, `aria-live="polite"`, 6 s (8 s with an action), at most one visible; a new toast replaces the old one.

**Claude off.** Every Claude action has a working path without Claude (see [settings-and-ai-keys.md §AI-off copy](settings-and-ai-keys.md#ai-off-copy)). Claude output is always shown for review before anything is saved.

**Deep links (contract between packages).**

| URL | Opens |
|---|---|
| `/board?item=<planItemId>` | Board on that item's month, card drawer open |
| `/okrs/plan` | OKR wizard |
| `/okrs?year=2027` | OKR page on a year tab |
| `/library?skill=<id>` | Library filtered to a skill (already built) |
| `/notebook?note=<id>` · `/notebook?skill=<id>` · `/notebook?due=1` | Notebook on a note, or filtered |
| `/settings#profile` `#skills` `#claude` `#appearance` `#data` | Settings section |
| `/guide` | How Growloop works |

The skill sheet has no URL; any component opens it with `openSkillSheet(skillId)` from the UI store.

**Accessibility baseline.** Keyboard reachable, visible focus, WCAG AA contrast in light and dark, `prefers-reduced-motion` respected, every drag has a non-drag alternative (WCAG 2.5.7), drawers and dialogs trap focus and return it on close.
