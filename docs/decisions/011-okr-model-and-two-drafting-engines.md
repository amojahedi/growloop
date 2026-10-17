# 011 — Typed key results and a wizard with two drafting engines

**Status:** Accepted · 2026-10-18 · Builds on [007](007-yearly-okrs-and-cycles.md)

## Context
Key results were free text with auto or manual progress. Manual progress is typed, unverifiable and forgotten; free text can't be tied to skills or materials. The owner wants a short wizard (role and 12-month goal; focus skills with current and target level) that works with and without Claude.

## Decision
- **Three key result types**, each with exactly one skill: **material** (finish a specific item), **certification** (finish it and confirm it was earned), **count** (finish N items in the skill within the objective's quarter). Progress is always computed; there is no manual progress.
- Count KRs count by skill, so linking a card is optional; material KRs link themselves when their target is added to the board.
- Objectives close at quarter end with their score, or move once to the next quarter, in the month-end review. Finished years are archived from the January review.
- **Wizard:** two question steps (role + goal; 2–4 focus skills with Now/Goal levels 1–5), plus an optional CV/LinkedIn paste used once when Claude is available. Weekly time, formats, target certification and light quarters are not asked.
- **Two engines, one output:** Claude drafts when available; otherwise a deterministic rules engine (the quick draft) drafts from the same answers. Both produce the same `PlanDraft`, pass the same repair step and land on the same inline-editable review with "Accept all".
- Skill levels from the wizard are saved to the profile for the skill sheet and a later level chart.

## Why
Typed, skill-linked KRs make growth evidence-based and need no extra input. A rules engine that uses the same questions keeps the product good without AI, which matters for the hosted app where most visitors won't add a key.

## Consequences
- Schema v4 converts old KRs to count KRs on the objective's first skill.
- The rules engine needs an outcome phrase per built-in skill, stored with the skills data.
- Applied practice (interviews, presentations) is modelled as the user's own library items counting toward a count KR.
