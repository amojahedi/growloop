# 003 — Local-first data, no accounts

**Status:** Accepted · 2026-10-17

## Context
The MVP's goal is to validate the planning loop, not to run infrastructure. Users are privacy-conscious about personal development notes.

## Decision
All data is stored **locally in the browser**, with JSON export/import. No sign-up.

## Consequences
- Zero hosting cost, instant onboarding, trivially deployable demo.
- No cross-device sync (acceptable for MVP; candidate for a later phase).
- Persistence is isolated in the store layer (`src/lib/store/`): components only go through store actions, and a single storage adapter (`storage.ts`) is the only code that touches localStorage, so a backend can be swapped in there. Storage scopes (workspace, device preferences, Claude key) are defined in [009](009-sample-mode-and-device-preferences.md).
