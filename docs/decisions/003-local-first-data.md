# 003 — Local-first data, no accounts

**Status:** Accepted · 2026-10-17

## Context
The MVP's goal is to validate the planning loop, not to run infrastructure. Users are privacy-conscious about personal development notes.

## Decision
All data is stored **locally in the browser**, with JSON export/import. No sign-up.

## Consequences
- Zero hosting cost, instant onboarding, trivially deployable demo.
- No cross-device sync (acceptable for MVP; candidate for a later phase).
- The persistence layer sits behind a repository interface so a backend can be swapped in.
