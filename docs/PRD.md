# Growloop — Product Requirements (MVP)

> **Growloop** — a growth loop for yourself: plan → learn → reflect → repeat.

| | |
|---|---|
| **Owner** | Aisan Mojahedi |
| **Status** | MVP in development |
| **Last updated** | 2026-10-17 |

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
1. Set **yearly growth OKRs**, organized by quarter and tied to skills — with Claude's help.
2. Pick from **gold-standard resources** into a personal **library** and **backlog**.
3. Execute on a **board** in monthly or quarterly cycles.
4. See a **dashboard** of learning output.
5. Keep a **notebook** for summaries and notes worth reviewing later.

**Non-goals (MVP)**
- Daily task management / general to-do lists.
- Accounts, sync, collaboration.
- Hosted AI (no API keys, no server-side LLM costs).
- Mobile-first design (responsive is enough).
- Internationalization (English only).

## 4. Core concepts

```
Year (archived when finished)
 └─ Quarter
     └─ Objective                 3–4 per year
         └─ Key Result            2–3 per objective; each targets one Skill
                                  type: certification | material (course/book…) | count (N items)

Resources (curated) ──save──► My Library (saved + user-added) ──plan──► Backlog
Cycle (monthly or quarterly, user setting)
 └─ Board: Backlog → To Do → In Progress → Done
     └─ Plan Item (material + skills + optional KR, tasks, notes, summary, reminder)

Notebook ◄── free notes + summaries/notes collected from plan items
```

## 5. Functional requirements

### 5.1 Dashboard (home)
| ID | Requirement | Priority |
|---|---|---|
| D-1 | **Items completed** this cycle, with delta vs previous cycle (core metric). | Must |
| D-2 | **Skill radar**: activity per skill this cycle. | Must |
| D-3 | **OKR progress** for the current quarter. | Must |
| D-4 | **Learning streak** calendar. | Should |
| D-5 | **Latest notes** and notes due for review. | Should |
| D-6 | **Upcoming reminders**. | Must |
| D-7 | Cycle switcher to view past cycles. | Must |
| D-8 | **Customize dashboard**: show/hide and reorder widgets; reset to default. Hours learned is an optional widget, hidden by default. | Must |

### 5.2 Skills
| ID | Requirement | Priority |
|---|---|---|
| S-1 | Ship with 12 curated PM skills. | Must |
| S-2 | Users can add, rename and hide skills. | Must |
| S-3 | Skill page: description, linked KRs, related resources, progress. | Must |

### 5.3 Resources (curated)
| ID | Requirement | Priority |
|---|---|---|
| RS-1 | Gold-standard catalog of courses, certifications, books, articles and podcasts, tagged by skill. | Must |
| RS-2 | Filters: skill, type, level, cost, length, plus search. | Must |
| RS-3 | Brief on click: what it covers, who it's for, key takeaways, length, link. | Must |
| RS-4 | Actions: **Save to library** or **Add to backlog** (optionally linked to a KR). | Must |
| RS-5 | AI: **Recommend resources** for a skill or KR. | Should |

### 5.4 My Library
| ID | Requirement | Priority |
|---|---|---|
| ML-1 | Everything the user saved from Resources or added themselves. | Must |
| ML-2 | **Paste to add**: paste a title or link; Claude fills type, author, summary, skills and length for review. Without Claude, a pre-filled form. | Must |
| ML-3 | Move an item to the backlog. | Must |

### 5.5 Personal OKRs
| ID | Requirement | Priority |
|---|---|---|
| O-1 | Plannable quarters: the rest of the current year plus next year (e.g. in Oct 2026: Q4 2026 and Q1–Q4 2027). | Must |
| O-2 | When a year ends, it can be **archived** (read-only, still viewable). | Must |
| O-3 | **OKR wizard**: Claude asks a fixed set of questions, then proposes 3–4 objectives with 2–3 KRs each, spread across quarters and covering the user's skills. User edits and accepts. Without Claude, a manual form. | Must |
| O-4 | Each KR targets one skill with a measurable type: earn a certification, finish a specific material, or complete N items in the skill. | Must |
| O-5 | KR progress is automatic from linked plan items. | Must |

### 5.6 My Board
| ID | Requirement | Priority |
|---|---|---|
| B-1 | Columns: **Backlog → To Do → In Progress → Done**. | Must |
| B-2 | Drag & drop, keyboard accessible. | Must |
| B-3 | Filter by skill and objective. | Must |
| B-4 | Card: title, type icon, skills, task progress, reminder. | Must |
| B-5 | **Cycle length** (monthly or quarterly) chosen at setup, changeable in Settings. | Must |

### 5.7 Card detail
| ID | Requirement | Priority |
|---|---|---|
| C-1 | Material brief + link. | Must |
| C-2 | Tasks: suggested "Summarize in my words" + custom. | Must |
| C-3 | Notes and summary; AI **Refine my summary**. | Must |
| C-4 | Reminder (date + note). | Must |
| C-5 | Optional time estimate and log. | Should |

### 5.8 Cycle review
| ID | Requirement | Priority |
|---|---|---|
| R-1 | At the end of a cycle, unfinished To Do / In Progress items get a review: carry over, back to backlog, or drop. | Must |

### 5.9 Notebook
| ID | Requirement | Priority |
|---|---|---|
| N-1 | Create, edit and organize free notes (title, body, tags, optional skill). | Must |
| N-2 | Summaries and notes from plan items appear automatically, linked to their item. | Must |
| N-3 | **Review later**: mark a note with a review date; due notes show on the dashboard. | Must |
| N-4 | Search and filter by tag, skill and source. | Should |

### 5.10 Help & onboarding
| ID | Requirement | Priority |
|---|---|---|
| H-1 | A persistent **Help** button in the app shell, reachable from every page. | Must |
| H-2 | **Guided tour**: step-by-step highlights of the main areas (dashboard, skills, library, OKRs, board, card detail, month review). Skippable, with back/next and progress ("3 of 8"). Keyboard accessible. | Must |
| H-3 | The tour starts automatically on the **first visit only**; afterwards it can be replayed from the Help button. Completion/skip is remembered locally. | Must |
| H-4 | **Guide page** ("How Growloop works"): explains the loop — set quarterly OKRs → pick materials → plan the month → learn on the board → summarize in your own words → monthly review — with short visuals and links into each area. Also covers enabling AI via local Claude Code and data/privacy (local-first, export/import). | Must |
| H-5 | Help content is written as data (not hard-coded into components) so it can be edited and extended without touching UI code. | Should |

### 5.11 Appearance & themes
| ID | Requirement | Priority |
|---|---|---|
| T-1 | MVP ships one style theme, **Linen** (warm & soft), from the design exploration in `design/directions/`. | Must |
| T-2 | Light, dark and system mode; follows the system setting by default, with a quick toggle in the app shell. | Must |
| T-3 | Theming is implemented as design tokens (CSS variables) only; components never hard-code theme values, so more style themes can be added later as token sets. | Must |
| T-4 | Meets WCAG AA contrast in both modes. | Must |
| T-5 | *Later phase:* additional style themes (**Graphite** — minimal, **Prism** — bold) selectable in **Settings → Theme** with live previews. | Later |

## 6. AI integration

- AI runs on the **user's own machine via their installed Claude Code CLI** (headless `claude -p`), using their own Claude subscription. No API keys, no hosted LLM.
- Features in MVP:
  1. **OKR wizard** — fixed questions → 3–4 objectives with 2–3 skill-linked KRs.
  2. **Paste to add** — fill in a resource's details from a pasted title or link.
  3. **Recommend resources** for a skill or KR.
  4. **Refine my summary** — feedback on a user-written summary.
- If Claude Code is not installed / not signed in, AI buttons show a friendly setup hint. **Everything else works without AI.**
- On the hosted demo, AI is disabled with an explanation of how to enable it locally.

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Data | Local-first, no login. Data stays on the user's machine. Export/import JSON. |
| Platform | Desktop-first, responsive down to mobile. |
| Theme | Light + dark, follows system, manual toggle. |
| Accessibility | Keyboard navigable, WCAG AA contrast, drag & drop with keyboard alternative. |
| Quality | TypeScript strict, unit tests for domain logic, CI on every push. |
| Distribution | Open source. Local install (`npm install && npm run dev`) for full features; Vercel demo with sample data. |

## 8. Success metrics (for when real users arrive)

- **Activation**: % of new users who create ≥1 objective and add ≥3 items in first session.
- **Monthly learning output**: median items completed per active user per month.
- **Reflection rate**: % of done items with a written summary.
- **Retention**: % of users who complete a month rollover review.

## 9. Out of scope / future phases

- Other personas and skill taxonomies beyond product.
- Cloud sync and accounts.
- Browser/calendar reminders.
- Self-check quizzes, AI month planning, spaced repetition.
- Sharing a learning profile publicly.
