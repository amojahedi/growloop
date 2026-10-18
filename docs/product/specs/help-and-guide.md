# Help, tour and guide

PRD: H-1 to H-5

## User story

As a new or returning user, I want a short tour of the main areas and a plain explanation of how Growloop works, available whenever I need it, so that I understand the loop without reading a manual.

## Help button (H-1)

- In the top bar on every page, right side, before the color-mode toggle: a "?" icon button with visible tooltip and accessible name "Help". `data-tour="help"`.
- Opens a small menu:
  - **Take the tour** (starts the tour; navigates to the Dashboard first if elsewhere)
  - **How Growloop works** (`/guide`)
  - **Turn on Claude** (`/settings#claude`; only while Claude is off)

## Guided tour (H-2, H-3)

- Runs on the **Dashboard only**, highlighting dashboard widgets and nav items instead of navigating between pages. Why: no route changes mid-tour, no empty pages for new users, and it stays robust as pages change.
- **Auto-starts on the first visit** (owner decision, 2026-10-17), right after the first-launch screen; skippable at every step and never shown again once seen or skipped; always available from Help.
- UI: dimmed backdrop with a spotlight cut-out around the target, a popover next to it (title, body, "3 of 7", **Back**, **Next** / **Done**, **Skip tour**). Esc skips. Focus moves into the popover; the target gets `aria-describedby` to the popover body. Reduced motion: no transitions.
- Steps whose target isn't on screen are skipped and the count adjusts (e.g. the user removed the radar widget). On < 768 px, nav steps anchor to the menu button with the same copy.
- Showing it sets `tourSeenAt`, so it auto-starts only once; completion or skip sets `tourCompletedAt` (both device preferences). It never auto-starts outside the Dashboard (so never during the wizard), and a link followed before it appears wins: it waits for the next Dashboard visit. Replaying is always possible.

| # | Target (`data-tour`) | Title | Body |
|---|---|---|---|
| 1 | `widget-items-completed` | Your month at a glance | The big number is what you've finished this month. It's the one that counts. |
| 2 | `widget-skill-radar` | Where you're growing | Solid shows what you've finished, dashed what's planned. Hover a card or resource to preview what it adds. |
| 3 | `nav-okrs` | Set your year | A few goals, each tied to a skill. Progress fills in as you finish things. |
| 4 | `nav-library` | Find something good | Hand-picked courses, books, articles and podcasts. Add puts one straight on this month's board. |
| 5 | `nav-board` | Learn on your board | Drag cards as you go, or use ⋯ to move them. Open a card to take notes and write a summary. |
| 6 | `nav-notebook` | Keep what sticks | Your summaries land here. Mark one Review later and it comes back when it's due. |
| 7 | `help` | Here when you need it | Replay this tour or read how Growloop works. |

Content lives in `src/content/help/tour.ts` as data (H-5), including target ids, so copy changes never touch components. Widget frames expose `data-tour="widget-<id>"` automatically; nav items expose `data-tour="nav-<name>"`.

## Guide page: "How Growloop works" (`/guide`, H-4)

A single readable page (max ~680 px text column, Linen typography), linked from the Help menu. Content lives in `src/content/help/guide.ts` as data (sections with heading, body, optional link). Copy below is the content to ship; keep it this short.

**Header.** How Growloop works · "A growth loop for yourself: plan, learn, reflect, repeat."

**1. The loop.** A small horizontal diagram of six steps, each a link: Set your year (`/okrs`) → Find something (`/library`) → Plan the month (`/board`) → Learn (`/board`) → Summarize (`/notebook`) → Wrap up the month (`/board`). Caption: "The year gives direction. The month is the rhythm."

**2. Set your year.** "Pick a few objectives for the year, one per quarter is plenty. Each has two or three key results tied to one skill: finish a specific book or course, earn a certification, or finish a number of things in that skill. Progress fills in by itself as you finish cards. At the end of a quarter you close each objective with its score, or move it once to the next quarter." Link: Plan my year.

**3. Plan the month.** "**Add** puts something on this month's board, ready to start. **Save to library** keeps it for some other time. **Backlog** on the board is for things you've committed to, just not this month. Three to five things a month is a good start."

**4. Learn and reflect.** "Open a card to tick off chapters, take notes and write a summary in your own words. Two or three sentences is plenty; writing it is what makes it stick. Every summary and note also lives in your Notebook. Mark one Review later and it comes back on your dashboard when it's due."

**5. Wrap up the month.** "When a month ends, Growloop asks about anything unfinished: carry it over, park it in the backlog, or drop it. Nothing moves silently, so you learn how much a month really holds."

**6. Skills and the radar.** "Every material builds one main skill and maybe a few others. The radar adds them up: solid for what you finished this month, dashed for what's still planned. Longer materials count a little more. Click any skill to see your level, your goals and what's on your board for it."

**7. Claude (optional).** "Claude can draft your yearly plan, fill in details for something you paste, recommend what to learn for a skill and give feedback on your summaries. Turn it on with your own Claude API key in Settings; it stays in your browser and goes only to Anthropic. Running Growloop on your computer with Claude Code works too. Only what a feature needs is sent, never your whole workspace. Without Claude, everything still works." Link: Turn on Claude.

**8. Your data.** "Everything is stored in this browser. There's no account and no server copy. Export a JSON file to back up or move to another browser, and import it there. Want to look around first? Try the sample data; your own data stays safe and comes back when you exit." Link: Settings → Your data.

**Footer.** "Take the tour" button.

## States

| State | Behavior |
|---|---|
| Tour started from another page | Navigates to the Dashboard, waits for the data gate, then starts. |
| Tour target missing | Step skipped, count adjusted. |
| Window resized mid-tour | Popover repositions; spotlight follows the target. |
| Sample mode | Tour and guide work unchanged. |

## Acceptance criteria

- [ ] A Help button is in the top bar on every page with Take the tour, How Growloop works, and Turn on Claude (only when off).
- [ ] The tour runs on the Dashboard with the 7 steps above, skips missing targets, shows "n of N", and supports Back, Next, Done, Skip and Esc.
- [ ] The tour auto-starts once per device on the Dashboard after the first-launch choice (`tourSeenAt`), never during the wizard, and never again after that; completion/skip is stored as a device preference (`tourCompletedAt`).
- [ ] Tour and guide content come from `src/content/help/*` data files, not components.
- [ ] `/guide` renders the eight sections with working links and a Take the tour button.
- [ ] Tour popovers are keyboard accessible with focus management and work at 375 px.
