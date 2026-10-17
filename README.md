# Growloop

> A growth loop for yourself — plan, learn, reflect, repeat. Self-development planning built for product people.

**Status:** 🚧 MVP in development

Growloop turns scattered courses, books and podcasts into a focused learning plan:

- **Quarterly OKRs → monthly plans** — tie every course and book to a goal.
- **Curated PM library** — courses, books, articles and podcasts mapped to product skills like stakeholder management and roadmapping.
- **Kanban board** — move learning items from backlog to done.
- **Monthly dashboard** — items completed, skill radar, OKR progress, streaks and notes.
- **Summarize in your own words** — with optional AI feedback, using your own Claude API key or your local Claude Code.
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

### How AI works (optional)

AI features (recommendations, "Add your own" drafts, summary feedback) are optional; everything else works without them. Growloop never uses a key of its own. It picks the first of these that's available:

1. **Your own Claude API key** (works online and locally). Paste a key in **Settings → Claude**. It's stored only in your browser, under its own entry (never in exported JSON), and sent only to Anthropic: the browser calls the Claude API directly, so the Growloop server never sees it. **Forget key** removes it. Anyone with access to your browser profile could read it, so don't save it on shared computers. See [ADR 008](docs/decisions/008-hosted-app-with-own-key.md).
2. **Claude Code on your computer** (local only). When Growloop runs on `localhost`, it can use your installed [Claude Code](https://docs.claude.com/en/docs/claude-code) CLI in headless mode (`claude -p`) with your own subscription. Install it and sign in once (`claude`), then restart the dev server. These endpoints refuse requests from any other host, so they're always off on a hosted deployment. See [ADR 004](docs/decisions/004-ai-via-local-claude-code.md).
3. **Off.** AI buttons explain how to turn AI on.

To keep a browser-stored key safe, every response carries a strict Content Security Policy (no third-party scripts; the page can only connect to itself and `https://api.anthropic.com`), plus `frame-ancestors 'none'`, `Referrer-Policy: no-referrer` and a restrictive `Permissions-Policy`. See `src/lib/security-headers.ts`.

### Configuration

Copy `.env.example` to `.env.local`. All variables are optional:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_DEMO_MODE` | `true` seeds sample data on first load and disables the local Claude Code bridge (hosted demo). Visitors can still use their own key. |
| `CLAUDE_CLI_PATH` | Path to `claude` if it isn't on the server's `PATH`. |
| `GROWLOOP_CLAUDE_MODEL` | Model passed to `claude --model` for local Claude Code. (With your own key, Growloop uses Claude Opus 5.5.) |

## Deploying

Growloop deploys to Vercel as-is: import the repository in Vercel and deploy. No environment variables are required. There are no server-side secrets: data stays in each visitor's browser, and AI uses each visitor's own Claude API key, entered in Settings. The local Claude Code endpoints stay disabled on the deployed site.

## Development

`npm run dev` and `npm start` bind to `127.0.0.1`, so the app (and its AI endpoints, which run the Claude Code CLI on your subscription) isn't reachable from other devices on your network. The AI endpoints additionally refuse requests that don't arrive via `localhost`/`127.0.0.1`/`[::1]` from the app's own origin.

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
| `src/lib/ai/` | AI providers (own key in the browser, local Claude Code CLI bridge), prompts, response schemas, key storage and the `useAI()` hook. |
| `src/styles/` | Design tokens: shared contract plus the Linen theme (light and dark). |
| `src/data/` | Curated skills, library and demo data. |
| `src/features/` | Page-level feature components; `src/app/` holds routes. |

## License

MIT
