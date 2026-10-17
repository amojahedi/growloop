# Growloop — Product Requirements (MVP)

> **Growloop** — a growth loop for yourself: plan → learn → reflect → repeat.

| | |
|---|---|
| **Owner** | Aisan Mojahedi |
| **Status** | MVP in development |
| **Last updated** | 2026-10-18 |
| **Build specs** | [`docs/product/specs/`](product/specs/README.md) · [build plan](product/build-plan.md) |

---

## 1. Problem

Product people invest a lot in self-development — courses, books, newsletters, podcasts — but the effort is scattered across tabs, notes apps and good intentions. There is no single place to:

- connect learning to **goals** (what am I trying to get better at, and why?),
- **plan** a realistic amount of learning per month,
- **track** what was actually completed and what stuck,
- **reflect** on it in a way that makes knowledge retrievable later.

Generic task tools (Jira, Notion, Trello) can be bent into this shape, but they don't understand skills, learning materials or reflection.

## 2. Target users

**Phase 1 (this MVP): Product people** — PMs, APMs, product owners, aspiring PMs.

| Persona | Need |
|---|---|
| **Growing PM** (2–5 yrs) | Wants a structured plan to level up specific skills (e.g. stakeholder management, roadmapping) before a promotion conversation. |
| **Career switcher** | Needs a curated path through overwhelming PM content and a way to prove progress. |
| **Senior PM / lead** | Learns continuously, wants a lightweight log of what was learned and applied. |

Later phases will extend the skill taxonomy and library to other roles.

## 3. Goals & non-goals

**Goals**
1. Set **yearly growth OKRs**, organized by quarter and tied to skills — drafted in two questions, with or without Claude.
2. Pick from **gold-standard resources** into a personal **library**.
3. Execute on a **monthly board**, wrapped up by a short month-end review.
4. See a **dashboard** of learning output and skill growth.
5. Keep a **notebook** of summaries and notes worth reviewing later.

**Non-goals (MVP)**
- Daily task management / general to-do lists.
- Accounts, sync, collaboration.
- AI paid for by the project or run on its servers (users bring their own Claude key or Claude Code).
- Rich-text notes, tags, global search.
- Mobile-first design (responsive is enough).
- Internationalization (English only).

## 4. Core concepts

```
Year (archived when finished)
 └─ Quarter
     └─ Objective                 3–4 per year, one quarter each; closes with a score or moves once
         └─ Key Result            2–3 per objective; exactly one Skill
                                  type: material | certification | count (N items in the skill)

Resources (curated) ──save──► Library (saved + user-added) ──Add──► this month's board
Month
 └─ Board: Backlog → To do → In progress → Done        (Backlog is a rolling pool)
     └─ Plan item (material, skills, optional KR link, tasks, reminder, optional time)

Note ◄── a card's summary and notes are notes; plus free notes        (Notebook)
Profile: optional name, role, goal, skill levels (Now / Goal, 1–5)
```

Storage scopes (ADR 009): the **workspace** (exported), **device preferences** (welcome/tour seen, sample mode) and the **Claude key** are stored separately.

## 5. Functional requirements

### 5.1 Dashboard (home) — [spec](product/specs/dashboard.md)
| ID | Requirement | Priority |
|---|---|---|
| D-1 | **Items completed** this month, with delta vs last month (core metric), type breakdown, summarized count and six-month bars. | Must |
| D-2 | **Skill radar**: completed vs projected skill impact this month; axis labels open the skill sheet. | Must |
| D-3 | **OKR progress** for the viewed month's quarter. | Must |
| D-4 | **Learning streak** calendar. | Should |
| D-5 | **Latest notes** and a **Due for review** widget. | Must |
| D-6 | **Upcoming reminders**. | Must |
| D-7 | Month switcher (Dashboard and Board only) to look **back** at past months. | Must |
| D-8 | **Customize dashboard** (Jira-style): add/remove widgets from a gallery, drag to reorder, resize (S/M/L), reset to default. Hours are not shown on the dashboard. | Must |
| D-9 | Linen header: date, serif time-of-day greeting (with optional name), one friendly **momentum line**, Open board, and a Wrap up button when a review is pending. | Must |

### 5.2 Skills — [spec](product/specs/skills.md)
| ID | Requirement | Priority |
|---|---|---|
| S-1 | Ship with 12 curated PM skills. | Must |
| S-2 | In Settings → Skills: add, rename, recolor and hide skills; delete own skills (not while a KR uses them). 3–16 visible. | Must |
| S-3 | **Skill sheet** opens from any skill chip or radar axis: description, level, this year's KRs, items on the board, notes, Browse resources. No Skills page or nav item. | Must |
| S-4 | **Skill impact**: every material shows which skills it builds and how strongly; the radar shows completed vs projected growth, with a hover preview of any item's impact. | Must |
| S-5 | **Skill levels** (Now / Goal, 1–5) are captured in the wizard, saved to the profile and editable in the skill sheet. | Must |

### 5.3 Library (Resources + My Library on one page)
| ID | Requirement | Priority |
|---|---|---|
| RS-1 | Gold-standard catalog of courses, certifications, books, articles and podcasts, tagged by skill. | Must |
| RS-2 | Multi-select filters (skill, type, level, cost, length), search, sort, and Show: All / Not in my library / In my library. | Must |
| RS-3 | Brief on click: what it covers, who it's for, key takeaways, length, link. | Must |
| RS-4 | Primary **Add** puts the item on the **current month's board** (To do) and saves it to the library; secondary **Save to library**. KR link offered in place, never forced; adding a KR's target material links it automatically. "On board" opens the card. | Must |
| RS-5 | Claude: **Recommend** resources for a filtered skill. | Should |
| ML-1 | My Library = everything saved from Resources or added by the user. | Must |
| ML-2 | **Add your own**: paste a title or link; Claude fills type, author, summary, skills and length for review. Without Claude, a pre-filled form. | Must |
| ML-3 | **Add** on library items puts them on the current month's board. | Must |

### 5.4 Personal OKRs — [spec](product/specs/okrs-and-wizard.md)
| ID | Requirement | Priority |
|---|---|---|
| O-1 | Plannable window: from the current quarter through Q4 of next year (in Oct 2026: Q4 2026 and Q1–Q4 2027). At most 4 objectives per calendar year. | Must |
| O-2 | A finished year is **archived** from the month-end review (read-only, under the Archive tab). | Must |
| O-3 | **OKR wizard** (`/okrs/plan`): step 1 role and 12-month goal (+ optional LinkedIn/CV paste, only when Claude is available, never saved); step 2 two to four focus skills with Now/Goal level. Drafts one objective per empty quarter in scope. | Must |
| O-4 | Each KR targets one skill with a type: finish a material, earn a certification, or complete N items in the skill. | Must |
| O-5 | KR progress is computed: material/certification from the linked card (certifications need "earned"); count KRs from done items tagged with the skill inside the objective's quarter. No manual progress. | Must |
| O-6 | **Soft gate**: objectives are skippable; a single "Set your year" prompt shows where objectives would appear until one exists. | Must |
| O-7 | **Two drafting engines, one review**: Claude drafts when available; otherwise a deterministic quick draft from the same answers. Both pass the same repair step and land on an inline-editable review with **Accept all**. | Must |
| O-8 | **OKR page**: year tabs (current, next, Archive) with four quarter columns; objective cards with KRs, progress and pace; add, edit, move and delete objectives with the shared editor. | Must |
| O-9 | Objectives **close at quarter end** with their score, or **move once** to the next quarter, in the month-end review. | Must |

### 5.5 Board — [spec](product/specs/board.md)
| ID | Requirement | Priority |
|---|---|---|
| B-1 | Columns: **Backlog → To do → In progress → Done**. | Must |
| B-2 | Drag & drop with keyboard support, plus a **⋯ menu** on every card (Open, Move to, Move up/down, Remove from board) as the non-drag alternative (WCAG 2.5.7). | Must |
| B-3 | Filter by skills (multi-select) and objective. | Must |
| B-4 | Card: title, type icon, skill impact, task progress, reminder, KR tag. | Must |
| B-5 | Opens on the **current month**; looks back only; past months are read-only (notes stay editable). | Must |
| B-6 | **Remove from board** is undoable and keeps the card's notes. | Must |
| B-7 | `/board?item=<id>` opens any card from anywhere. | Must |

### 5.6 Card detail — [spec](product/specs/card-detail.md)
| ID | Requirement | Priority |
|---|---|---|
| C-1 | Material brief + link (collapsed). | Must |
| C-2 | Tasks: milestones, "Summarize in my words" (ticks itself on first summary) + custom. | Must |
| C-3 | Summary ("In my words") and notes, which are Notebook notes; Claude **Get feedback** on the summary. | Must |
| C-4 | Reminder (date + note). | Must |
| C-5 | Optional time estimate and log (collapsed; the only place hours appear). | Should |
| C-6 | Per-card skills (1–3, one primary). | Must |
| C-7 | Certification items ask "Did you earn it?" when done; can be marked earned later. | Must |
| C-8 | KR link row with Change/Unlink, and the automatic "Also counts toward" line. | Must |

### 5.7 Month-end review — [spec](product/specs/board.md#month-end-review)
| ID | Requirement | Priority |
|---|---|---|
| R-1 | Unfinished To do / In progress items from past months: carry over, back to backlog, or drop (defaults: In progress → carry, To do → backlog, carried twice → backlog). | Must |
| R-2 | One non-blocking dialog with a recap; shown via a Board banner and a Dashboard button; missed months combine. | Must |
| R-3 | Quarter close: each active objective in an ended quarter closes with its score or moves once (O-9). | Must |
| R-4 | Year wrap: offers to archive a finished year (O-2). | Must |

### 5.8 Notebook — [spec](product/specs/notebook.md)
| ID | Requirement | Priority |
|---|---|---|
| N-1 | Create, edit and delete free notes (title, body, optional skills). | Must |
| N-2 | Card summaries and notes appear automatically, linked to their card, and survive card removal. | Must |
| N-3 | **Review later**: a review date per note; due notes show on the dashboard, as a Due filter and a nav badge. | Must |
| N-4 | Search and filter by source, skill and due. | Must |
| N-5 | Plain-text editor with autosave. | Must |

### 5.9 Help & onboarding — [onboarding](product/specs/onboarding.md) · [help](product/specs/help-and-guide.md) · [sample data](product/specs/sample-data.md)
| ID | Requirement | Priority |
|---|---|---|
| H-1 | A persistent **Help** button in the top bar: Take the tour, How Growloop works, Turn on Claude. | Must |
| H-2 | **Guided tour** on the Dashboard: 7 steps (hero, radar, OKRs, Library, Board, Notebook, Help); Back/Next/Skip, "3 of 7", keyboard accessible. | Must |
| H-3 | The tour **starts automatically on the first visit** (right after the first-launch screen; skippable at any step) and can always be replayed from Help. Seen/done is remembered per device. | Must |
| H-4 | **Guide page** (`/guide`): the loop, OKRs, monthly planning, reflection, month-end review, skills and radar, Claude, data and privacy. | Must |
| H-5 | Help content is written as data, not hard-coded into components. | Should |
| H-6 | **First-launch screen** (no questions): Set your year · Try sample data · Skip for now. | Must |
| H-7 | **Sample mode**: a separate sample workspace with a "You're viewing sample data · Start fresh" banner; the user's own data is untouched and restored on exit. | Must |

### 5.10 Appearance & themes
| ID | Requirement | Priority |
|---|---|---|
| T-1 | MVP ships one style theme, **Linen** (warm & soft), from `design/directions/2-warm.html`. | Must |
| T-2 | Light, dark and system mode; follows the system by default, with a quick toggle in the top bar and the same setting in Settings. | Must |
| T-3 | Theming is implemented as design tokens (CSS variables) only; components never hard-code theme values. | Must |
| T-4 | Meets WCAG AA contrast in both modes. | Must |
| T-5 | *Later:* additional style themes selectable in Settings; **Nocturne** (`design/directions/4-moon.html`) is next. | Later |

### 5.11 Settings — [spec](product/specs/settings-and-ai-keys.md)
| ID | Requirement | Priority |
|---|---|---|
| ST-1 | One page with sections Profile, Skills, Claude, Appearance, Your data, each with an anchor. | Must |
| ST-2 | Profile: optional name (used in the greeting). | Must |
| ST-3 | Claude: status, save/validate/forget an API key with a clear security notice, Claude Code status and setup steps when local. | Must |
| ST-4 | Your data: export, import (with a replace dialog), try sample data, erase everything. | Must |
| ST-5 | Appearance: light / dark / system. | Must |

### 5.12 Navigation — [spec](product/specs/navigation-and-empty-states.md)
| ID | Requirement | Priority |
|---|---|---|
| NAV-1 | Sidebar: Dashboard, Board, Library, Notebook (due badge), OKRs; Settings at the bottom. | Must |
| NAV-2 | Sidebar shows the current quarter's objectives with progress rings, or "Set your year". | Must |
| NAV-3 | Sidebar footer: "Saved on this device" and the live Claude status. | Must |
| NAV-4 | Below 768 px the sidebar becomes a menu sheet; drawers become full-screen sheets. | Must |

## 6. AI integration (Claude)

| ID | Requirement | Priority |
|---|---|---|
| AI-1 | Provider order: the user's **own Claude API key** (stored only in their browser, sent only to Anthropic) → **Claude Code** on the user's machine (local runs only) → off. One shared status. | Must |
| AI-2 | **Draft my plan** in the OKR wizard. | Must |
| AI-3 | **Add your own**: fill in a resource from a pasted title or link. | Must |
| AI-4 | **Recommend** resources for a skill. | Should |
| AI-5 | **Get feedback** on a summary (strengths, gaps, suggestions, optional tighter version). | Must |
| AI-6 | Without Claude, every feature works; each Claude action shows a short "Turn on Claude" hint next to a working fallback. Claude output is always reviewed before saving. | Must |

Details: [settings-and-ai-keys.md](product/specs/settings-and-ai-keys.md), ADR 004 and 008.

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Data | Local-first, no login. Data stays in the user's browser. Export/import JSON. Schema-versioned with migrations. |
| Security | Strict Content Security Policy (connect only to self and `api.anthropic.com`), no third-party scripts, the Claude key never in exports, logs, URLs or requests to the app's server. |
| Platform | Desktop-first, responsive down to 375 px. |
| Theme | Light + dark, follows system, manual toggle. |
| Accessibility | Keyboard navigable, WCAG AA contrast, every drag has a non-drag alternative, focus managed in drawers and dialogs, reduced motion respected. |
| Quality | TypeScript strict, unit tests for domain logic, CI on every push. |
| Distribution | Open source. One build, hosted on Vercel as a real, empty workspace with **Try sample data**; local install also supported. |

## 8. Success metrics (for when real users arrive)

- **Activation**: % of new users who accept a wizard draft or add ≥ 3 items in the first session.
- **Monthly learning output**: median items completed per active user per month.
- **Reflection rate**: % of done items with a written summary.
- **Retention**: % of users who complete a month-end review.

## 9. Out of scope / future phases

- Other personas and skill taxonomies beyond product.
- Cloud sync and accounts.
- Browser/calendar reminders.
- Skill level chart (from the levels saved now), self-check quizzes, AI month planning, spaced repetition.
- Global search and a global Add from the top bar.
- Sharing a learning profile publicly.
