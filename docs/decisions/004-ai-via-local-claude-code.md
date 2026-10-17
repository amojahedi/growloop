# 004 — AI through the user's local Claude Code

**Status:** Accepted · 2026-10-17 · Extended by [008](008-hosted-app-with-own-key.md)

## Context
AI adds real value (recommending materials, giving feedback on summaries), but hosting an LLM means API keys, cost and abuse protection. Target users (product people) increasingly already have a Claude subscription and Claude Code installed.

## Decision
The app runs locally and calls the user's installed **Claude Code CLI in headless mode** (`claude -p ... --output-format json`) from a local Next.js route handler. It uses the user's own subscription; no keys are stored by the app.

MVP AI features:
1. Recommend materials for a skill / objective.
2. Refine my summary (feedback on a written summary).

## Consequences
- No AI cost for the project; users keep control of their own usage.
- The local bridge is unavailable on the hosted app; AI there uses the visitor's own key (ADR 008).
- The app must detect whether `claude` is available and degrade gracefully. All core features work without AI.
- AI responses are requested as structured JSON and validated before use.
