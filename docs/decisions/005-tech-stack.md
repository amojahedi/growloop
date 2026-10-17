# 005 — Tech stack

**Status:** Accepted · 2026-10-17

| Concern | Choice | Why |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Full-stack in one repo; route handlers bridge to the local Claude CLI. |
| Styling | Tailwind CSS + shadcn/ui | Accessible primitives, fully themeable with design tokens. |
| State & persistence | Zustand with persisted local storage | Simple, typed, local-first. |
| Drag & drop | dnd-kit | Accessible, keyboard support, actively maintained. |
| Charts | Recharts | Radar and bar charts with minimal code. |
| Validation | Zod | Validate persisted data and AI JSON responses. |
| Testing | Vitest + Testing Library | Fast unit tests for domain logic and components. |
| CI | GitHub Actions | Lint, type-check, test, build on every push. |
| Demo hosting | Vercel | Zero-config Next.js deploys. |
