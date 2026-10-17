# Growloop

> A growth loop for yourself — plan, learn, reflect, repeat. Self-development planning built for product people.

**Status:** 🚧 MVP in development

Growloop turns scattered courses, books and podcasts into a focused learning plan:

- **Quarterly OKRs → monthly plans** — tie every course and book to a goal.
- **Curated PM library** — courses, books, articles and podcasts mapped to product skills like stakeholder management and roadmapping.
- **Kanban board** — move learning items from backlog to done.
- **Monthly dashboard** — items completed, skill radar, OKR progress, streaks and notes.
- **Summarize in your own words** — with optional AI feedback powered by your own local Claude Code.
- **Local-first** — no account, your data stays on your machine.

## Docs

- [Product requirements (PRD)](docs/PRD.md)
- [Decision log](docs/decisions/README.md)

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

### AI features (optional)

AI recommendations and summary feedback use your own [Claude Code](https://docs.claude.com/en/docs/claude-code) CLI, run locally in headless mode (`claude -p`). Install it and sign in once (`claude`), then restart the dev server. Nothing else is required: no API keys are stored by the app, and everything else works without it. See [ADR 004](docs/decisions/004-ai-via-local-claude-code.md).

### Configuration

Copy `.env.example` to `.env.local`. All variables are optional:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | `true` seeds sample data on first load and disables the AI bridge (hosted demo). |
| `CLAUDE_CLI_PATH` | Path to `claude` if it isn't on the server's `PATH`. |
| `GROWLOOP_CLAUDE_MODEL` | Model passed to `claude --model` for AI features. |

## Development

```bash
npm run lint        # ESLint
npm run typecheck   # route type generation + tsc
npm test            # Vitest (npm run test:watch for watch mode)
npm run build       # production build
```

| Path | Contents |
|---|---|
| `src/lib/domain/` | Pure, framework-free domain logic (dates, board, OKRs, dashboard selectors, rollover) and the shared types. |
| `src/lib/store/` | Zustand store persisted to localStorage, zod schema, migrations, JSON export/import. |
| `src/lib/ai/` | Bridge to the local Claude Code CLI, prompts, response schemas and the `useAI()` hook. |
| `src/styles/` | Design tokens: shared contract plus the Linen theme (light and dark). |
| `src/data/` | Curated skills, library and demo data. |
| `src/features/` | Page-level feature components; `src/app/` holds routes. |

## License

MIT
