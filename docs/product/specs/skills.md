# Skills

PRD: S-1 to S-5

## User story

As a learner, I want to click any skill and see where I stand on it, what I'm doing about it and what to learn next, and I want to shape my own skill list, so that skills feel like the thread through everything.

## Decision: no Skills page

The `/skills` and `/skills/[id]` routes are removed. Skills are reached through the **skill sheet** (from any chip or radar axis) and managed in **Settings → Skills**. `/skills` and `/skills/*` redirect to `/settings#skills`. Why: skills are a lens, not a destination; a sixth nav item for a list the user edits twice a year adds weight without value.

## Skill sheet

A drawer from the right (same container as the card drawer, 420 px; full-screen sheet below 768 px), opened with `openSkillSheet(skillId)`. It stacks over the card drawer when opened from inside it.

**Opens from:** skill chips in card detail, Library cards and brief, OKR KR rows, Notebook, the wizard review; radar axis labels; Settings → Skills rows. Chips on board cards are not separate buttons (the whole card opens the card).

```
[map]  Roadmapping                                          ×
Turning strategy into a sequenced plan that communicates…

Your level     Now ●●○○○  Goal ●●●●○         Edit
This year      Lead roadmap conversations…   53%
               Run an outcome-based roadmap   Q3 2027
On your board  Product Roadmaps Relaunched    In progress
               The Alternative to Roadmaps    Done
               Finished this year: 6
Notes          4 notes  →                          (/notebook?skill=roadmapping)

[Browse resources]                              (/library?skill=roadmapping)
```

| Section | Content |
|---|---|
| Header | Icon in the skill color, name, description. Hidden skills show a "Hidden" chip and [Show]. |
| Your level (S-5) | Now and Goal as 5 dots with the level word on hover/focus ("Learning", "Strong"). **Edit** turns them into the wizard's 1–5 segmented controls (autosave). Not set: "Not set yet · [Set level]". |
| This year | Active and closed objectives in the current and next year with a KR on this skill: title, progress or quarter. Each opens `/okrs?year=…`. Empty: hidden. |
| On your board | This month's cards and Backlog cards tagged with the skill (status chip; opens the card). Then "Finished this year: {n}". Empty: "Nothing planned for Roadmapping yet." |
| Notes | Count with link to the filtered Notebook. Hidden when 0. |
| Footer | **Browse resources** → Library filtered to the skill. |

The future "skill chart from levels" (owner decision) will read the same `skillLevels`; nothing else is needed now.

## Settings → Skills (management)

```
Skills                                   Keep 3 to 16 visible.
● Stakeholder Management    Built-in         Hide
● Roadmapping               Built-in         Hide
● Negotiation                                Hide  Delete
[ New skill name ] [●▾] [Add skill]
```

| Action | Behavior |
|---|---|
| Color | The dot is a button opening a 16-swatch popover (the existing skill color tokens). Skill colors are loved; they stay the primary skill identity everywhere. |
| Rename | Click the name to edit inline; Enter or blur saves, Esc cancels; empty or duplicate names (case-insensitive) are rejected with "Pick a different name." Built-ins can be renamed. |
| Hide / Show | Hidden skills leave the radar, filters and pickers; cards and KRs already tagged keep them (muted chip). Hide is disabled when only 3 visible skills remain ("Keep at least 3 visible so the radar works."). |
| Delete | Custom skills only. Blocked while a KR uses it: "Used by a key result. Hide it, or change that key result first." Otherwise acts immediately with an undo toast ("Deleted Negotiation · removed from 3 cards · Undo"). |
| Add | Name (≤ 40 chars) + color (defaults to the first color not in use) → added at the end, visible. Disabled at 16 visible skills. New skills get icon "sparkles"; no icon picker. |
| Order | Display order is list order; no reordering in MVP. |

## States

| State | Behavior |
|---|---|
| Unknown skill id passed to the sheet | Sheet doesn't open; console warning. |
| Skill with no data | Header, level "Not set yet", "Nothing planned…" and Browse resources. |
| Sample mode | Works on sample data. |

## Acceptance criteria

- [ ] `/skills` routes are gone and redirect to `/settings#skills`; no nav item for Skills.
- [ ] The skill sheet opens from every listed entry point, including radar axis labels, and closes with Esc / × / scrim with focus returned.
- [ ] Levels show and can be edited inline; the wizard and the sheet read and write the same profile data.
- [ ] This year / On your board / Notes sections show the right items and hide or show empty copy as specified.
- [ ] Settings → Skills supports color, inline rename with validation, hide/show with the 3-visible minimum, delete for custom skills with the KR guard and undo, and add with a 16-visible maximum.
- [ ] Hidden skills disappear from radar, filters and pickers but stay on cards and KRs already tagged.
