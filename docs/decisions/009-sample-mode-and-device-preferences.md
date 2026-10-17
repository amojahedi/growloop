# 009 — Sample data as a separate workspace; device preferences outside the workspace

**Status:** Accepted · 2026-10-18 · Refines [003](003-local-first-data.md), [008](008-hosted-app-with-own-key.md)

## Context
The hosted app opens on an empty, real workspace with "Try sample data" (ADR 008). Visitors must be able to explore a full workspace and get back to their own data untouched. Until now a build flag (`NEXT_PUBLIC_DEMO_MODE`) seeded sample data into the only workspace and disabled AI. Some state also belongs to the browser, not to the user's plan: whether the welcome screen or tour was seen, which workspace is active, and the Claude API key.

## Decision
- **Sample mode** loads a freshly generated sample workspace from a separate storage key (`growloop:sample`). The own workspace (`growloop:data`) is never written while sample mode is on. Exiting deletes the sample and restores the own workspace.
- **One build.** `NEXT_PUBLIC_DEMO_MODE` is retired. Hosted and local builds behave the same; the only difference is that the local Claude Code bridge answers only on a loopback host.
- **Three storage scopes:**

| Key | Holds | Exported | Migrated |
|---|---|---|---|
| `growloop:data` | The workspace: profile, skills, objectives, plan items, notes, layout | Yes | Yes (schema versions) |
| `growloop:device` | Device preferences: `welcomeDoneAt`, `tourOfferDismissedAt`, `tourCompletedAt`, `sampleMode` | No | No (unknown fields ignored) |
| `growloop:claude-key` | The user's Claude API key | Never | No |

## Consequences
- Trying the sample can never cost a user their data, which makes it safe to offer everywhere.
- Exports stay portable and never leak a key or per-browser state.
- The store needs a small switch between two persisted keys (and cross-tab sync of the switch).
- Screenshots and e2e tests use sample mode instead of a special build.
