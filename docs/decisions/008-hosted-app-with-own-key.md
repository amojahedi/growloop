# 008 — Hosted app; AI with the user's own Claude key

**Status:** Accepted · 2026-10-17 · Extends [004](004-ai-via-local-claude-code.md)

## Context
Growloop should be usable from a public link, not only when cloned and run locally. The owner's Claude account must never pay for visitors' AI use.

## Decision
- Publish Growloop as a hosted web app (Vercel). Data stays local-first in the visitor's browser.
- First visit opens an **empty, real workspace** with a one-click **Try sample data**.
- **AI online uses the visitor's own Claude API key**, entered in Settings, stored only in their browser, and sent directly from the browser to the Claude API. The server never sees or stores keys and holds no key of its own.
- When run locally, the existing local Claude Code bridge still works. Provider order: own key → local Claude Code → AI off.
- Without either, every feature works; AI buttons explain how to enable it.

## Consequences
- Zero AI cost for the project; no server-side secrets.
- A key in browser storage is readable by scripts on the page, so: strict CSP, no third-party scripts, a clear notice, and a one-click "Forget key".
