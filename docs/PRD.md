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
1. Plan learning with **quarterly OKRs** broken into **monthly plans**.
2. Discover curated materials per **skill** and add them to the month in one click.
3. Execute on a **kanban board** (Backlog → To Do → In Progress → Done).
4. See a **monthly dashboard** of learning output.
5. Reinforce learning by **summarizing in your own words**, optionally refined with AI.

**Non-goals (MVP)**
- Daily task management / general to-do lists.
- Accounts, sync, collaboration.
- Hosted AI (no API keys, no server-side LLM costs).
- Mobile-first design (responsive is enough).
- Internationalization (English only).

## 4. Core concepts

```
Quarter
 └─ Objective (O)                  e.g. "Become confident leading roadmap discussions"
     ├─ Key Result (KR)            e.g. "Finish 2 roadmapping materials", "Present roadmap to leadership"
     └─ linked Skills              e.g. Roadmapping, Stakeholder Management

Skill ─── has many ──► Materials (course | book | article | podcast | custom)

Month Plan
 └─ Plan Items (a Material placed in a month, linked to Skill(s) and optionally a KR)
     ├─ status: backlog | todo | in_progress | done
     ├─ tasks: suggested + custom (MVP suggestion: "Summarize in my words")
     ├─ notes & summary
     ├─ reminder (date + note)
     └─ time: estimate + logged hours (optional)
```

## 5. Functional requirements

### 5.1 Monthly dashboard (home)
| ID | Requirement | Priority |
|---|---|---|
| D-1 | Show **items completed** this month (essential metric), with delta vs last month. | Must |
| D-2 | Show **hours learned** this month — *optional*: only shown when the user logs time. | Should |
| D-3 | **Skill radar**: investment per skill this month/quarter. | Must |
| D-4 | **OKR progress**: progress per objective and key result for the current quarter. | Must |
| D-5 | **Learning streak** calendar (days with learning activity). | Should |
| D-6 | **Latest summaries & notes** feed. | Should |
| D-7 | **Upcoming reminders** panel. | Must |
| D-8 | Month switcher to view past months. | Must |

### 5.2 Skills
| ID | Requirement | Priority |
|---|---|---|
| S-1 | Ship with a curated PM skill list (e.g. Stakeholder Management, Roadmapping, Product Discovery, Prioritization, Product Analytics, Product Strategy, UX & Design, Communication, Leadership, Go-to-Market, Technical Fluency, Experimentation). | Must |
| S-2 | User can add, rename and hide skills. | Must |
| S-3 | Skill detail page: description, related materials, items in plan, progress. One-click "Add to month". | Must |

### 5.3 Learning library
| ID | Requirement | Priority |
|---|---|---|
| L-1 | Curated catalog of **courses, books, articles and podcasts**, tagged by skill. | Must |
| L-2 | Filter by skill, type, free/paid, length; search by title/author. | Must |
| L-3 | Clicking a material opens a **brief**: what it covers, who it's for, key takeaways, length, link. | Must |
| L-4 | "Add to plan" → choose month, (optional) KR; creates a plan item with suggested tasks. | Must |
| L-5 | User can add their own materials (title, link, type, skills, estimate). | Must |
| L-6 | AI: **Recommend materials** for a skill or objective (via local Claude Code). | Should |

### 5.4 OKR planner
| ID | Requirement | Priority |
|---|---|---|
| O-1 | Create quarterly objectives with key results. | Must |
| O-2 | Link objectives to skills; link plan items to key results. | Must |
| O-3 | KR progress computed from linked items (done/total) or set manually. | Must |

### 5.5 Board
| ID | Requirement | Priority |
|---|---|---|
| B-1 | Kanban columns: **Backlog → To Do → In Progress → Done**. | Must |
| B-2 | Drag & drop cards between and within columns (keyboard accessible). | Must |
| B-3 | Filter board by month, skill, objective. | Must |
| B-4 | Card shows title, type icon, skills, task progress, due/reminder. | Must |

### 5.6 Card detail
| ID | Requirement | Priority |
|---|---|---|
| C-1 | Material brief + link. | Must |
| C-2 | Task checklist — suggested "Summarize in my words" task + custom tasks. | Must |
| C-3 | Personal notes (markdown-lite). | Must |
| C-4 | Summary editor; AI **"Help me refine"** gives feedback on gaps and clarity. | Must / Should (AI) |
| C-5 | Reminder: date + note, shown in dashboard. | Must |
| C-6 | Time: estimate + log hours (optional). | Should |

### 5.7 Month rollover
| ID | Requirement | Priority |
|---|---|---|
| R-1 | When a new month starts and unfinished items exist, show a **review**: carry over / move to backlog / drop, per item or in bulk. | Must |

## 6. AI integration

- AI runs on the **user's own machine via their installed Claude Code CLI** (headless `claude -p`), using their own Claude subscription. No API keys, no hosted LLM.
- Features in MVP:
  1. **Recommend materials** for a skill or objective.
  2. **Refine my summary** — feedback on a user-written summary.
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
