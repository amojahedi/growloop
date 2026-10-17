# OKRs and the wizard

PRD: O-1 to O-9, S-5 · ADR [007](../../decisions/007-yearly-okrs-and-cycles.md), [011](../../decisions/011-okr-model-and-two-drafting-engines.md)

## User story

As a PM thinking about my next career step, I want to answer two quick questions and get a sensible, editable plan for the rest of this year and next, so that my learning has a direction without an afternoon of OKR writing. Without Claude I still get a good draft.

## 1. The model

```
Objective   one quarter · title (≤70) · why (≤120, optional) · status active | closed
            finalProgress (when closed) · movedFrom (set by the one allowed move) · source claude | quick | manual
 └─ Key result (2–3)   exactly one skill · type + target · title (≤80, editable)
      material       finish one specific library item
      certification  finish one certification item and confirm it was earned
      count          finish N items tagged with the skill inside the objective's quarter
```

**Plannable window (O-1):** from the current quarter through Q4 of next year. In October 2026: Q4 2026 and Q1–Q4 2027. New objectives can only be placed in the window.

**Caps:** at most 4 objectives per calendar year (active + closed). A quarter may hold more than one objective; the wizard drafts one per quarter.

### Progress (computed, never typed)

| KR type | Progress | Met when |
|---|---|---|
| Material | Linked card's task completion, capped at 99% until Done. 0% with "Not on your board yet" when no linked card. | Linked card is Done |
| Certification | Same as material, labelled "Preparing". | Linked card is Done **and** marked earned (`earnedAt` on the plan item) |
| Count | Done items tagged with the KR's skill (any position in the item's skills), completed inside the objective's quarter, divided by N. For a moved objective the window runs from the original quarter's start to the new quarter's end. Linking is never required. | Count ≥ N |

- **Auto-link:** adding a KR's target material to the board (from anywhere) links the new card to that KR. Manual links from the card's KR row still work for any active KR.
- **Objective progress** = mean of its KRs, rounded.
- **Pace** (current quarter only): expected = share of the quarter elapsed. Progress ≥ expected + 10 points → "Ahead of pace"; within ±10 → "On pace"; below → "Behind pace". Future quarters show "Starts Jan 1"; closed objectives show "Closed at 64%" or "Met".
- **Quarter close and the one move** happen in the month-end review ([board.md §Month-end review](board.md#month-end-review)).

## 2. The wizard (`/okrs/plan`)

One flow, two drafting engines. The same two question steps always run; **Claude** drafts when available ([provider order](settings-and-ai-keys.md#provider-order)), otherwise the **quick draft** (rules below) drafts from the same answers. Both land on the same review screen.

**Entry points:** first-launch screen, sidebar "Set your year", OKR widget, OKR page header and empty state. All link to `/okrs/plan`.

**Scope:** every quarter in the plannable window that has no active objective and whose year is under the cap, except the current quarter when fewer than 6 weeks of it remain. If none are left, the page says "Every quarter through 2027 already has an objective." with [Back to OKRs].

**Answers** prefill from the saved profile on re-runs and persist in the UI store for the browser session.

### Step 1 of 2: "Where are you now?"

Page header: **Set your year** · "Two quick questions, then a draft plan for the rest of 2026 and 2027. You can change everything." (Years are computed from scope.)

| Field | Input | Copy |
|---|---|---|
| Role (required) | Single-select chips | **Your role** · Aspiring PM · Associate PM · Product Manager · Senior PM · Lead or Group PM |
| Goal (required) | Single-select chips; "Something else" reveals a text field (≤80 chars, placeholder "In a few words") | **What should the next 12 months get you?** · A promotion · A move into product · Stronger in my current role · A step into leadership · Something else |
| Context (optional, **only when Claude is available**) | Collapsed disclosure → textarea (≤6,000 chars) | **Add your LinkedIn or CV** (optional) · Placeholder: "Paste your About section, experience or CV." · Helper: "Claude reads it once for this draft. It isn't saved." |

Buttons: **Next** (disabled until role and goal are set) · Cancel (text link; returns to the previous page, or the Dashboard from the first-launch screen).

### Step 2 of 2: "What do you want to grow?"

| Field | Input | Copy |
|---|---|---|
| Focus skills (required) | Multi-select chips of visible skills in their colors; 2–4 | **Pick 2 to 4 skills** · Helper when 1 is picked: "Pick at least one more." · At 4, other chips disable: "Four is plenty for a year." |
| Levels (required, one row per picked skill, in pick order) | Two 1–5 segmented controls per row, labelled **Now** and **Goal** | Legend under the rows: 1 New to it · 2 Learning · 3 Capable · 4 Strong · 5 Expert. Defaults: Now 2, Goal 4. If Goal ≤ Now: "Set a goal above where you are." |

Buttons: **Draft with Claude** (Claude available) or **Draft my plan** (quick draft) · Back.

*Dropped from the earlier 8-question set:* weekly time, formats, target certification and light quarters. Count targets are sized from the skill gap instead of weekly time; formats and certifications are chosen in review. Fewer questions, same quality of draft.

### Drafting

| State | UI |
|---|---|
| Quick draft | Instant (no loading state). |
| Claude drafting | Review layout as skeleton columns; line: "Claude is drafting your plan. This can take up to a minute." · [Use the quick draft instead] cancels the request and drafts by rules. |
| Claude failed (network, timeout, invalid or empty output after repair, rejected key) | "Claude couldn't draft a plan this time." + the specific reason when known ("Your Claude key was rejected. Check it in Settings.") · [Try again] [Use the quick draft]. Answers are never lost. |

### Output schema (both engines produce this; validated with zod)

```ts
type PlanDraft = {
  rationale: string;                 // ≤ 200 chars, one line shown above the columns
  objectives: Array<{
    quarter: QuarterKey;             // must be in scope
    title: string;                   // ≤ 70
    why: string;                     // ≤ 120
    keyResults: Array<{              // 2–3
      skillId: ID;                   // one of the focus skills
      type: "material" | "count" | "certification";
      materialId?: ID;               // material/certification: a catalog or library id from the candidates
      count?: number;                // count: 1–10
      title: string;                 // ≤ 80
    }>;
  }>;
};
```

**Repair before review** (shared `repairDraft`, so Claude can't produce an unusable plan): drop objectives outside scope, beyond one per quarter or beyond the year cap; drop KRs with unknown skills or materials (a certification KR must point at a certification); turn a material KR with a bad id into a count KR on the same skill; clamp counts to 1–10; if an objective ends with 1 KR, add a count KR on its skill; truncate to 3 KRs; regenerate empty titles with the quick-draft templates. If no objective survives, treat it as a failure.

### Claude prompt intent (`src/lib/ai/prompts/draft-plan.ts`)

- **Role:** "You are a pragmatic career coach for product managers inside Growloop, a learning planner." All user-supplied values go inside `<user_data>` with the existing data notice; no tools.
- **Input (JSON in user data):** role, goal (+ text), focus skills with name, Now, Goal and gap, the quarters in scope, weeks left in the current quarter, up to 12 candidate materials per focus skill (id, title, type, level, hours; ranked by the catalog's recommended order, excluding items already done), and the optional pasted context (trimmed to 6,000 chars).
- **Instructions:** exactly one objective per quarter in scope; 2–3 KRs each, each KR on one focus skill; put the biggest gaps earlier; progress from foundational to advanced materials for the same skill over the year; use `materialId` only from the candidates; size count KRs at 2–4 per quarter (2 when fewer than 8 weeks remain); propose a certification KR only when the pasted context or the goal text asks for one; titles are outcome-phrased, concrete, plain English, ≤ 70 chars, no "master", "synergy" or emoji; `why` links to the user's goal in one short sentence; `rationale` is one sentence in second person.
- **Output:** JSON matching the schema above, enforced by `--json-schema` (Claude Code) or `output_config.format` (own key). Model and effort: [settings-and-ai-keys.md §Model](settings-and-ai-keys.md#model).

### Quick draft (rules engine, `src/lib/domain/plan-drafter.ts`, pure and deterministic)

Inputs: answers, quarters in scope, catalog + library, done items.

1. **Order skills** by gap (Goal − Now) descending, ties by pick order.
2. **Assign quarters** in order: quarter *i* gets skill `S[i mod |S|]`. The *n*-th time a skill appears is its occurrence *n*.
3. **Objective title** from the phrase table below: occurrence 1 → phrase A, occurrence 2 → phrase B, 3+ → "Keep growing in {Skill}". Custom skills: A "Get stronger at {Skill}", B "Go deeper in {Skill}".
4. **Why** from the goal: promotion "Builds your case for promotion." · move into product "Gets you ready for a product role." · stronger "Makes you stronger in your current role." · leadership "Prepares you to lead." · something else "Moves you toward {text}." (text cut at 60 chars).
5. **KR 1, material:** in the catalog's recommended order, the first item whose first skill is the objective's skill, type book or course (any other non-certification type if none), not used by another KR in the draft and not already done; level from Now on occurrence 1 (1–2 beginner, 3 intermediate, 4–5 advanced), one level higher on each later occurrence, nearest level if none matches. Title "Finish {title before the first colon}". If no material exists (custom skill), KR 1 becomes a count KR.
6. **KR 2, count:** N by gap (1 → 2, 2 → 3, 3+ → 4), capped at 2 when the quarter has fewer than 8 weeks left. Title "Complete {N} {Skill} items".
7. **No third KR and no certification KR** in the quick draft; both can be added in review.
8. **Rationale:** "Biggest gaps first: {Skill A}, then {Skill B}." (up to three skills).

| Skill | Phrase A | Phrase B |
|---|---|---|
| Stakeholder Management | Bring stakeholders along on big decisions | Lead hard conversations with calm |
| Roadmapping | Lead roadmap conversations with confidence | Run an outcome-based roadmap |
| Product Discovery | Make customer discovery a weekly habit | Test ideas before they cost engineering time |
| Prioritization | Say no with clear reasons | Make trade-offs the team trusts |
| Product Analytics | Make decisions with product data | Own the metrics that matter |
| Product Strategy | Connect the team's work to a clear strategy | Shape strategy, not just follow it |
| UX & Design | Speak design fluently with designers | Raise the bar on usability |
| Communication | Write and present with clarity | Tell stories that move decisions |
| Leadership | Grow the people around you | Lead without the title |
| Go-to-Market | Launch with a real go-to-market plan | Partner with sales and marketing on launches |
| Technical Fluency | Hold your own in technical discussions | Make sharper calls on technical trade-offs |
| Experimentation | Run experiments that settle debates | Make experimentation a team habit |

The table lives in data next to the built-in skills (`objectivePhrases` on each built-in skill), not in components.

### Review screen ("edit inline, accept all")

Header: **Your draft for 2026–2027** · "Edit anything, then accept. Nothing is saved until you do."
Under it: the rationale line, and for the quick draft only: "Quick draft from your answers. [Turn on Claude](/settings#claude) for a more personal plan."

Layout: quarter columns exactly like the OKR page (so the user sees the shape of their year), each holding objective cards rendered with the shared **ObjectiveEditor** in inline mode:

- Title and why are plain-looking inputs that show an edit affordance on hover/focus.
- Each KR row: skill select (chip), type segmented control (Material · Count · Certification), target (material combobox filtered to the skill, certifications only for Certification; or an N stepper 1–10 "items"), title input (auto-generated from the target until the user edits it).
- "+ Key result" (hidden at 3) · × on a KR (disabled at 2, tooltip "Two or three key results per objective") · ⋯ on the card: Move to quarter… · Remove objective.
- "+ Add objective" at the bottom of a column when the quarter is in scope and its year is under the cap.

Inline validation (shown on blur and on Accept): "Give it a title." · "Pick a skill." · "Pick a material." · "Pick a certification." · "2027 already has 4 objectives." The **Accept all** button stays enabled; with problems it reads "Fix 2 things to accept", focuses the first problem and does nothing else.

Footer: Back (keeps the draft; drafting again with changed answers replaces it and toasts "New draft ready.") · **Accept all** (primary).

**Accept all:**
1. Saves the objectives (`status: active`, `source: claude | quick`).
2. Saves role, goal and skill levels to the profile (levels upserted per skill).
3. Saves every material/certification target to the library.
4. For KRs in the **current quarter** only: creates a Backlog card linked to the KR, or links the card already on this month's board. Later quarters get cards when the user adds them (auto-link does the rest).
5. Navigates to `/okrs?year=<first year in scope>` and toasts "Your year is set. 5 objectives saved." with **Undo** (removes everything step 1–4 created).

## 3. The OKR page (`/okrs`)

Header: **OKRs** · "Your year, a quarter at a time." · Action (one, contextual): **Plan my year** when there are no objectives; **Fill empty quarters** when some in-scope quarters are empty; none otherwise. Both open `/okrs/plan`.

**Year tabs:** each unarchived year that has objectives or is in the plannable window (e.g. **2026 · 2027**), then **Archive** when an archived year exists. Default: the current year; `?year=` selects.

**Quarter columns:** Q1–Q4 of the selected year. The current quarter is labelled "Now" and tinted. Past empty quarters show a muted "—". In-window quarters under the year cap end with a dashed **+ Add objective** that opens a blank ObjectiveEditor (quarter fixed, two empty KR rows).

**Objective card:**
```
Lead roadmap conversations with confidence         53%  ◔
Builds your case for promotion.                    On pace
● Roadmapping  [book] Finish Product Roadmaps Relaunched   In progress · 60%
                 ↳ Product Roadmaps Relaunched · In progress            (link opens the card)
● Roadmapping  [#]    Complete 3 Roadmapping items          2 of 3
                 Find resources →
```
- KR row actions: material/certification KR not on the board → **Add** (puts it on this month's board, linked; starting a later quarter's material early is fine). Count KR → **Find resources** (`/library?skill=<id>`). Certification card done but not earned → **Mark as earned**.
- Skill chips open the skill sheet.
- ⋯ menu on active objectives: Edit (ObjectiveEditor inline, Save/Cancel) · Move to quarter… (empty in-window quarters; doesn't count as the one quarter-end move) · Delete (undo toast; unlinks cards, never deletes them).
- Closed objectives: read-only, final score, "Closed at 64%" or "Met"; moved ones show "Moved from Q3".
- Archived years: everything read-only, no menus.

<a id="empty-state"></a>**Empty state (no objectives at all):** centered in the current-year tab:
> **Set your year**
> Answer two questions and get a draft plan for the rest of 2026 and 2027. You can change everything.
> [Plan my year]  · Add an objective myself (opens a blank editor in the current quarter)

## States

| State | Behavior |
|---|---|
| Claude checking | Step 2 button shows a small spinner until status resolves (≤ 2 s), then its final label; a click while checking waits for the result. |
| Claude off | Quick draft; no context box; review note links to Settings. |
| Claude slow (> 60 s) | Request aborted, failure state with both options. |
| Skill hidden later | KRs keep showing the skill (muted chip); still counts. |
| Skill deleted | Not allowed while a KR uses it ([skills.md](skills.md)). |
| Target material missing (e.g. from an imported file) | Material KR shows "Material missing" with [Pick another] (opens the editor). |
| Sample mode | Works on the sample workspace. |

## Acceptance criteria

- [ ] KR progress follows the table above for all three types, including moved objectives and the 99% cap; unit-tested in `okrs.ts`.
- [ ] Adding a KR's target material anywhere auto-links the card to that KR.
- [ ] The wizard asks exactly role + goal (step 1) and 2–4 skills with Now/Goal levels (step 2); the context box appears only when Claude is available and is never persisted.
- [ ] Scope covers only empty in-window quarters and skips a current quarter with fewer than 6 weeks left.
- [ ] Claude drafts are validated and repaired; a draft that can't be repaired falls back to the failure state with Try again / Use the quick draft.
- [ ] The quick draft is deterministic: same answers and data give the same plan (snapshot test), follows steps 1–8 and uses the phrase table from data.
- [ ] The review screen edits inline, enforces 2–3 KRs, one skill per KR, a target per KR and ≤ 4 objectives per year, and "Accept all" saves nothing until all problems are fixed.
- [ ] Accept all saves objectives, profile levels and library items, creates linked Backlog cards for current-quarter material KRs only, and can be undone from the toast.
- [ ] The OKR page shows year tabs (current, next, Archive when present) with four quarter columns, the "Now" quarter, pace labels, and the contextual header action.
- [ ] Closed, moved and archived objectives render read-only with the right labels.
- [ ] Objective editing on the OKR page uses the same ObjectiveEditor as the review screen.
- [ ] All controls are keyboard operable; segmented controls are radio groups with visible labels.
