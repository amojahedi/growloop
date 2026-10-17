# Settings and Claude keys

PRD: ST-1 to ST-5, AI-1 to AI-6 · ADR [004](../../decisions/004-ai-via-local-claude-code.md), [008](../../decisions/008-hosted-app-with-own-key.md), [009](../../decisions/009-sample-mode-and-device-preferences.md)

## User story

As a visitor on the hosted app, I want to turn on Claude with my own API key in a minute and trust that the key stays with me. As any user, I want one calm page for my name, skills, look and data.

## Page structure (`/settings`)

One scrolling page, five sections, each with an anchor.

| # | Section | Anchor | Content |
|---|---|---|---|
| 1 | Profile | `#profile` | **Your name** (optional, ≤ 40 chars) · helper "Used in your greeting. Stays on this device." |
| 2 | Skills | `#skills` | See [skills.md](skills.md#settings--skills-management). |
| 3 | Claude | `#claude` | Status, API key, Claude Code on this computer. Below. |
| 4 | Appearance | `#appearance` | **Mode**: Light · Dark · System (radio; same state as the top-bar toggle; default System). No theme picker until a second theme exists (T-5). |
| 5 | Your data | `#data` | Export, Import, Try sample data, Erase everything. Below. |

Everything autosaves; no page-level Save.

## Claude

### Provider order

<a id="provider-order"></a>**Own API key → Claude Code on this computer → off** (ADR 008).

- A saved key is used for every Claude action. If a call fails with 401/403, the action shows "Your Claude key was rejected. Check it in Settings." There is no silent fallback to Claude Code (surprising and harder to reason about).
- Without a key, the app asks `/api/ai/status` (existing local bridge). It answers only on a loopback host, so on the hosted app it is always "disabled".
- The resolved provider is shared app-wide (one status, re-checked on save/forget and on "Check again").

### Section layout

```
Claude                                                 ● Claude is on · your API key
Claude can draft your yearly plan, fill in resources you paste,
recommend what to learn and give feedback on your summaries.
Everything else works without it.

Your Claude API key
[ ••••••••••••••••••••••••••abcd ]   [Forget key]
Your key stays in this browser and goes only to Anthropic.
Growloop's server never sees it. Anyone who can use this browser
profile could read it, so set a spending limit on the key and
forget it on shared computers.   Get a key ↗

Claude Code on this computer                    Found · signed in   (local only)
```

**Status line** (also used, shortened, in the sidebar footer):

| State | Status line | Sidebar |
|---|---|---|
| Key saved | ● Claude is on · your API key | ● Claude on |
| Local Claude Code available | ● Claude is on · Claude Code on this computer | ● Claude on |
| Checking | ○ Checking Claude… | ○ Claude… |
| Off | ○ Claude is off | ○ Claude off |

**API key field (no key saved):** password input, label "Your Claude API key", placeholder `sk-ant-…`, button **Save key**.
- On save the key is checked with one cheap call (list models). Button reads "Checking…".
- Success: field collapses to the masked form (last 4 characters) with **Forget key**; toast "Claude is on."
- 401/403: "That key didn't work. Check it and try again." Network: "Couldn't reach Anthropic. Check your connection and try again." Nothing is stored on failure.
- Input is trimmed; obviously wrong formats (no `sk-ant-` prefix) get the same "didn't work" message without a network call.

**Forget key:** removes it immediately; status re-resolves (to Claude Code if available, else off); toast "Key forgotten. It's no longer stored in this browser." No confirm; re-adding is easy.

**Claude Code on this computer** (shown only when the server is reached via localhost, i.e. status isn't "disabled"):
- Found and signed in: "Found · signed in". When a key is also saved: "Found · not used while your API key is saved".
- Not installed / not signed in: the reason plus steps: "1. Install Claude Code. 2. Run `claude` once to sign in. 3. Restart Growloop." · [Check again].

**Cost line** under the intro: "Each Claude action uses your own API credit, usually a few cents."

### Key storage and security (implementation requirements)

- Stored in `localStorage` under `growloop:claude-key`, separate from the workspace (`growloop:data`) and device preferences. Never part of export, import, sample data or the store's persisted state.
- Only the provider module (`src/lib/ai/providers/`) reads it. It is never logged, never put in a URL, never sent to Growloop's server or any origin other than `https://api.anthropic.com`.
- Calls use the official `@anthropic-ai/sdk` in the browser with `dangerouslyAllowBrowser: true` (sends the `anthropic-dangerous-direct-browser-access` header the API requires for CORS).
- **Content Security Policy** on all pages: `default-src 'self'`; `connect-src 'self' https://api.anthropic.com`; no third-party script, style or font origins (fonts are self-hosted by `next/font`); `frame-ancestors 'none'`; `object-src 'none'`; `base-uri 'self'`. No analytics or third-party scripts anywhere.
- **Erase everything** also removes the key.

### Model

<a id="model"></a>

| Feature | Own key: model · effort | Claude Code |
|---|---|---|
| Draft my plan (wizard) | `claude-opus-5-5` · `medium` | User's Claude Code default, or `GROWLOOP_CLAUDE_MODEL` |
| Add your own, Recommend, Get feedback | `claude-opus-5-5` · `low` | Same |

- Structured output with `output_config.format` (JSON schema built from the same schemas the local bridge passes to `--json-schema`); responses are validated with the existing zod schemas either way.
- Enable the API's server-side refusal fallback (`fallbacks: "default"`) and treat `stop_reason: "refusal"` as a normal failure ("Claude couldn't respond this time.").
- The model id is a constant in the provider module. No model picker in the UI.

### What is sent

Only the inputs each feature needs: the wizard answers and candidate material list (and the pasted CV text, if given), a pasted title or link, a skill or objective for recommendations, or a summary with its material's title and brief. Never the whole workspace.

<a id="ai-off-copy"></a>

### AI-off copy (one pattern everywhere)

A short lead specific to the feature, then "Turn on Claude" linking to `/settings#claude`. Never a dead end: the no-Claude path is always visible next to it.

| Feature | Without Claude |
|---|---|
| Wizard | Quick draft; review note: "Quick draft from your answers. Turn on Claude for a more personal plan." |
| Add your own | Pre-filled form (built). Hint: "Fill in the details yourself, or turn on Claude to fill them for you." |
| Recommend (Library, one skill filtered) | Section body: "Want picks for {Skill}? Turn on Claude." The list stays in curated order. |
| Get feedback (summary) | "Want feedback on this? Turn on Claude." |

## Your data

| Control | Behavior |
|---|---|
| **Export** | Downloads `growloop-YYYY-MM-DD.json` (workspace only; no key, no device prefs). |
| **Import…** | File picker → dialog: "Replace everything with this file? Your current plans, notes and objectives will be replaced. Export first if you might want them back." [Replace] [Cancel]. Errors show the parser's reason. Disabled in sample mode. |
| **Try sample data** | Enters sample mode ([sample-data.md](sample-data.md)). Line: "Your own data stays safe and comes back when you exit." |
| **Erase everything** | Destructive button → dialog: "Erase everything on this device? This deletes your plans, notes, objectives, settings and saved Claude key from this browser. It can't be undone." [Erase everything] [Cancel]. After: first-launch screen shows again. Hidden in sample mode. |

Section helper: "Everything is stored in this browser. Nothing is sent anywhere unless you use Claude."

## States

| State | Behavior |
|---|---|
| Hosted, no key | Claude off; Claude Code row hidden; key field ready. |
| Local, Claude Code ready, no key | Claude on via Claude Code; key field still offered ("Optional: use an API key instead"). |
| Key saved and Claude Code ready | Key wins; Claude Code row says "not used". |
| Storage blocked | Key can't persist: after save, toast "Your browser blocks storage, so the key lasts only for this tab." |
| Sample mode | All sections work; Import disabled, Erase hidden. |

## Acceptance criteria

- [ ] Settings shows Profile, Skills, Claude, Appearance and Your data with working anchors.
- [ ] The provider resolves own key → Claude Code → off, everywhere from one shared status; no silent fallback after a rejected key.
- [ ] Saving a key validates it with one call; failures store nothing and show the specific message.
- [ ] The key is stored only under `growloop:claude-key`, is masked to its last 4 characters, never appears in exports, logs, URLs or requests to any origin but `api.anthropic.com` (test asserts export content and fetch targets).
- [ ] Forget key removes it immediately and re-resolves the status; Erase everything removes it too.
- [ ] The CSP header above is set on every page, and the app works under it (including the browser Claude calls).
- [ ] Claude Code status and setup steps show only on localhost.
- [ ] Every Claude feature shows its AI-off copy and working fallback when Claude is off.
- [ ] Import and Erase use proper dialogs (no `window.confirm`); Import is disabled and Erase hidden in sample mode.
- [ ] Appearance mode stays in sync with the top-bar toggle.
