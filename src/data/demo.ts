import type {
  Material,
  Note,
  Objective,
  PlanItem,
  RolloverRecord,
  Task,
  Workspace,
} from "@/lib/domain/types";
import { CURATED_MATERIALS } from "./materials";
import { BUILT_IN_SKILLS, storedSkill } from "./skills";
import { suggestedTasksFor } from "./suggested-tasks";

/**
 * The sample workspace (sample-data.md, ADR 009), authored in the current
 * schema (v4) as if today were `writtenFor`. src/lib/store/seed.ts shifts every
 * date to the visitor's today when sample mode is entered, so the story always
 * reads as current: this quarter holds the in-progress objective, this month's
 * board is full, one note is due today and reminders fall in the next two weeks.
 *
 * The story: a mid-level PM working toward a promotion.
 * - Quarters: 2026-Q3 (closed at 80%) · 2026-Q4 (current) · 2027-Q1…Q4.
 * - Board, October: Backlog 2 · To do 2 · In progress 2 (one carried over
 *   from September) · Done 7. July to September are finished, reviewed months.
 * - No certification card on this month's board (a first drag to Done never
 *   asks "Did you earn it?"); an earned certification sits in August.
 * - Only this month's Done column holds Roadmapping items, so the current
 *   objective's count KR reads "2 of 3" on whichever day the sample is opened.
 * - Activity is not authored: seed.ts rebuilds it from the shifted dates.
 */

export interface SampleSeed extends Workspace {
  /** The day the sample is written around ("today" in the authored data). */
  writtenFor: string;
}

const WRITTEN_FOR = "2026-10-18";

const DEMO_CUSTOM_MATERIALS: Material[] = [
  {
    id: "custom-team-interview-playbook",
    type: "custom",
    title: "Our team's customer interview playbook (internal wiki)",
    author: "Product team",
    skillIds: ["product-discovery", "communication"],
    tagline: "How our trio recruits, runs and synthesises weekly interviews.",
    summary:
      "Internal guide covering our recruiting script, interview template and the synthesis board we use after each call.",
    audience: "Everyone on the product trio.",
    keyTakeaways: [],
    estimatedHours: 1,
    level: "beginner",
    cost: "free",
    curated: false,
  },
];

const ALL_MATERIALS = [...CURATED_MATERIALS, ...DEMO_CUSTOM_MATERIALS];

function material(id: string): Material {
  const found = ALL_MATERIALS.find((m) => m.id === id);
  if (!found) throw new Error(`Sample data references unknown material "${id}"`);
  return found;
}

/**
 * A card's checklist from the material's suggested tasks: the first milestones
 * ticked at `milestonesDoneAt`, "Summarize in my words" ticked at `summaryDoneAt`.
 */
function tasksFor(
  planItemId: string,
  materialId: string,
  opts: {
    milestonesDoneAt?: string[];
    summaryDoneAt?: string;
    custom?: { title: string; done: boolean; completedAt?: string }[];
  } = {},
): Task[] {
  const { milestonesDoneAt = [], summaryDoneAt, custom = [] } = opts;
  const tasks: Task[] = suggestedTasksFor(material(materialId)).map((task, index) => {
    const completedAt = task.kind === "milestone" ? milestonesDoneAt[index] : summaryDoneAt;
    return { ...task, id: `${planItemId}-t${index + 1}`, done: completedAt !== undefined, ...(completedAt ? { completedAt } : {}) };
  });
  custom.forEach((task, index) => tasks.push({ id: `${planItemId}-c${index + 1}`, kind: "custom", ...task }));
  return tasks;
}

/** A finished card: every milestone ticked when it was completed; the summary task only if a summary was written. */
function finished(planItemId: string, materialId: string, completedAt: string, { summarized = false } = {}): Task[] {
  const count = material(materialId).milestones?.length ?? 0;
  return tasksFor(planItemId, materialId, {
    milestonesDoneAt: Array.from({ length: count }, () => completedAt),
    summaryDoneAt: summarized ? completedAt : undefined,
  });
}

/** A Done card. The summary nudge counts as shown, so history never triggers it. */
function done(
  card: Pick<PlanItem, "id" | "materialId" | "month" | "order" | "skillIds" | "createdAt" | "completedAt"> &
    Partial<PlanItem> & { summarized?: boolean },
): PlanItem {
  const { summarized, completedAt, ...rest } = card;
  return {
    status: "done",
    tasks: finished(card.id, card.materialId, completedAt!, { summarized }),
    timeLogs: [],
    estimatedHours: material(card.materialId).estimatedHours,
    summaryNudgedAt: completedAt,
    completedAt,
    ...rest,
  };
}

// --- Board ---------------------------------------------------------------------------

const PLAN_ITEMS: PlanItem[] = [
  // July 2026
  done({
    id: "pi-jul-1",
    materialId: "article-hbr-jobs-to-be-done",
    month: "2026-07",
    order: 0,
    skillIds: ["product-discovery", "product-strategy"],
    createdAt: "2026-07-01T08:30:00.000Z",
    completedAt: "2026-07-08T19:10:00.000Z",
  }),
  done({
    id: "pi-jul-2",
    materialId: "podcast-lenny-teresa-torres",
    month: "2026-07",
    order: 1,
    skillIds: ["product-discovery"],
    createdAt: "2026-07-01T08:35:00.000Z",
    completedAt: "2026-07-15T07:50:00.000Z",
  }),
  done({
    id: "pi-jul-3",
    materialId: "article-kano-model-guide",
    month: "2026-07",
    order: 2,
    skillIds: ["prioritization", "product-discovery"],
    createdAt: "2026-07-06T12:00:00.000Z",
    completedAt: "2026-07-24T16:20:00.000Z",
  }),

  // August 2026
  done({
    id: "pi-aug-1",
    materialId: "article-ice-confidence-meter",
    month: "2026-08",
    order: 0,
    skillIds: ["prioritization", "product-discovery"],
    createdAt: "2026-08-01T08:15:00.000Z",
    completedAt: "2026-08-06T18:40:00.000Z",
  }),
  done({
    id: "pi-aug-2",
    materialId: "article-nng-test-with-5-users",
    month: "2026-08",
    order: 1,
    skillIds: ["ux-design", "product-discovery"],
    createdAt: "2026-08-01T08:20:00.000Z",
    completedAt: "2026-08-13T12:30:00.000Z",
  }),
  done({
    id: "pi-aug-3",
    materialId: "cert-scrum-org-pspo-i",
    month: "2026-08",
    order: 2,
    skillIds: ["prioritization", "product-strategy", "stakeholder-management"],
    createdAt: "2026-08-02T09:00:00.000Z",
    completedAt: "2026-08-27T17:00:00.000Z",
    earnedAt: "2026-08-27T17:05:00.000Z",
    timeLogs: [
      { id: "pi-aug-3-l1", date: "2026-08-09", hours: 2 },
      { id: "pi-aug-3-l2", date: "2026-08-16", hours: 3 },
      { id: "pi-aug-3-l3", date: "2026-08-23", hours: 3 },
      { id: "pi-aug-3-l4", date: "2026-08-27", hours: 1.5 },
    ],
  }),

  // September 2026
  done({
    id: "pi-01",
    materialId: "article-intercom-rice",
    month: "2026-09",
    order: 0,
    skillIds: ["prioritization"],
    createdAt: "2026-09-01T09:00:00.000Z",
    completedAt: "2026-09-04T18:20:00.000Z",
    summarized: true,
  }),
  done({
    id: "pi-02",
    materialId: "book-the-mom-test",
    month: "2026-09",
    order: 1,
    skillIds: ["product-discovery"],
    createdAt: "2026-09-01T09:05:00.000Z",
    completedAt: "2026-09-11T21:10:00.000Z",
    summarized: true,
    timeLogs: [
      { id: "pi-02-l1", date: "2026-09-08", hours: 1.5 },
      { id: "pi-02-l2", date: "2026-09-11", hours: 1.5 },
    ],
  }),
  done({
    id: "pi-04",
    materialId: "article-svpg-stakeholder-management",
    month: "2026-09",
    order: 2,
    skillIds: ["stakeholder-management"],
    createdAt: "2026-09-10T10:00:00.000Z",
    completedAt: "2026-09-26T16:45:00.000Z",
  }),

  // October 2026: Done
  done({
    id: "pi-05",
    materialId: "podcast-lenny-shreyas-doshi",
    month: "2026-10",
    order: 0,
    skillIds: ["prioritization", "product-strategy"],
    createdAt: "2026-10-01T07:30:00.000Z",
    completedAt: "2026-10-01T19:00:00.000Z",
    summarized: true,
    timeLogs: [{ id: "pi-05-l1", date: "2026-10-01", hours: 1.5 }],
  }),
  done({
    id: "pi-06",
    materialId: "article-svpg-alternative-to-roadmaps",
    month: "2026-10",
    order: 1,
    skillIds: ["roadmapping", "product-strategy"],
    createdAt: "2026-10-01T08:00:00.000Z",
    completedAt: "2026-10-03T12:15:00.000Z",
  }),
  done({
    id: "pi-07",
    materialId: "article-now-next-later-roadmap",
    month: "2026-10",
    order: 2,
    skillIds: ["roadmapping"],
    createdAt: "2026-10-01T08:05:00.000Z",
    completedAt: "2026-10-06T20:40:00.000Z",
    summarized: true,
    timeLogs: [{ id: "pi-07-l1", date: "2026-10-06", hours: 0.5 }],
  }),
  done({
    id: "pi-08",
    materialId: "article-opportunity-solution-trees",
    month: "2026-10",
    order: 3,
    skillIds: ["product-discovery", "prioritization"],
    createdAt: "2026-10-01T08:10:00.000Z",
    completedAt: "2026-10-09T17:05:00.000Z",
  }),
  done({
    id: "pi-09",
    materialId: "podcast-think-fast-talk-smart",
    month: "2026-10",
    order: 4,
    skillIds: ["communication"],
    createdAt: "2026-10-05T09:00:00.000Z",
    completedAt: "2026-10-13T08:15:00.000Z",
  }),
  done({
    id: "pi-10",
    materialId: "article-how-not-to-run-an-ab-test",
    month: "2026-10",
    order: 5,
    skillIds: ["experimentation"],
    createdAt: "2026-10-08T11:00:00.000Z",
    completedAt: "2026-10-15T13:30:00.000Z",
    summarized: true,
  }),
  done({
    id: "pi-11",
    materialId: "podcast-lenny-ronny-kohavi",
    month: "2026-10",
    order: 6,
    skillIds: ["experimentation"],
    createdAt: "2026-10-08T11:05:00.000Z",
    completedAt: "2026-10-16T19:50:00.000Z",
    timeLogs: [{ id: "pi-11-l1", date: "2026-10-16", hours: 1.5 }],
  }),

  // October 2026: In progress
  {
    id: "pi-12",
    materialId: "book-product-roadmaps-relaunched",
    month: "2026-10",
    status: "in_progress",
    order: 0,
    skillIds: ["roadmapping", "stakeholder-management"],
    keyResultId: "kr-q0-roadmaps-book",
    tasks: tasksFor("pi-12", "book-product-roadmaps-relaunched", {
      milestonesDoneAt: ["2026-09-24T20:00:00.000Z", "2026-10-07T21:00:00.000Z", "2026-10-11T10:30:00.000Z"],
      custom: [{ title: "Turn chapter notes into a one-page roadmap template", done: false }],
    }),
    reminder: { date: "2026-10-24", note: "Finish the alignment chapters before the roadmap review" },
    estimatedHours: 6,
    timeLogs: [
      { id: "pi-12-l1", date: "2026-09-24", hours: 1 },
      { id: "pi-12-l2", date: "2026-10-02", hours: 1 },
      { id: "pi-12-l3", date: "2026-10-07", hours: 0.75 },
      { id: "pi-12-l4", date: "2026-10-11", hours: 1.25 },
      { id: "pi-12-l5", date: "2026-10-14", hours: 0.5 },
    ],
    createdAt: "2026-09-15T09:00:00.000Z",
    carriedFrom: ["2026-09"],
  },
  {
    id: "pi-13",
    materialId: "book-continuous-discovery-habits",
    month: "2026-10",
    status: "in_progress",
    order: 1,
    skillIds: ["product-discovery"],
    tasks: tasksFor("pi-13", "book-continuous-discovery-habits", {
      milestonesDoneAt: ["2026-10-08T20:30:00.000Z", "2026-10-12T09:45:00.000Z"],
    }),
    reminder: { date: "2026-10-30", note: "Share the opportunity tree draft with design and eng" },
    estimatedHours: 6,
    timeLogs: [
      { id: "pi-13-l1", date: "2026-10-08", hours: 1 },
      { id: "pi-13-l2", date: "2026-10-12", hours: 1.5 },
      { id: "pi-13-l3", date: "2026-10-17", hours: 1 },
    ],
    createdAt: "2026-10-01T08:15:00.000Z",
  },

  // October 2026: To do
  {
    id: "pi-14",
    materialId: "course-amplitude-academy",
    month: "2026-10",
    status: "todo",
    order: 0,
    skillIds: ["product-analytics"],
    tasks: tasksFor("pi-14", "course-amplitude-academy"),
    reminder: { date: "2026-10-21", note: "Start the retention module" },
    estimatedHours: 5,
    timeLogs: [],
    createdAt: "2026-10-01T08:20:00.000Z",
  },
  {
    id: "pi-15",
    materialId: "book-crucial-conversations",
    month: "2026-10",
    status: "todo",
    order: 1,
    skillIds: ["stakeholder-management", "communication"],
    keyResultId: "kr-q1-crucial",
    tasks: tasksFor("pi-15", "book-crucial-conversations"),
    estimatedHours: 6.5,
    timeLogs: [],
    createdAt: "2026-10-05T09:10:00.000Z",
  },

  // October 2026: Backlog
  {
    id: "pi-16",
    materialId: "book-trustworthy-online-controlled-experiments",
    month: "2026-10",
    status: "backlog",
    order: 0,
    skillIds: ["experimentation", "product-analytics"],
    keyResultId: "kr-q2-experiments-book",
    tasks: tasksFor("pi-16", "book-trustworthy-online-controlled-experiments"),
    estimatedHours: 7,
    timeLogs: [],
    createdAt: "2026-10-08T11:10:00.000Z",
  },
  {
    id: "pi-17",
    materialId: "custom-team-interview-playbook",
    month: "2026-10",
    status: "backlog",
    order: 1,
    skillIds: ["product-discovery", "communication"],
    tasks: tasksFor("pi-17", "custom-team-interview-playbook", {
      custom: [{ title: "Update the recruiting script with Mom Test questions", done: false }],
    }),
    timeLogs: [],
    createdAt: "2026-10-10T15:00:00.000Z",
  },
];

// --- Notes (ADR 010) -------------------------------------------------------------------

const card = (id: string): PlanItem => {
  const found = PLAN_ITEMS.find((item) => item.id === id);
  if (!found) throw new Error(`Sample note references unknown card "${id}"`);
  return found;
};

function cardNote(
  kind: "summary" | "item_note",
  planItemId: string,
  body: string,
  at: string,
  extra: Partial<Note> = {},
): Note {
  const item = card(planItemId);
  return {
    id: `note-${planItemId}-${kind === "summary" ? "summary" : "notes"}`,
    kind,
    planItemId,
    materialId: item.materialId,
    body,
    skillIds: [...item.skillIds],
    createdAt: at,
    updatedAt: at,
    ...extra,
  };
}

const NOTES: Note[] = [
  // Summaries (2 refined with Claude).
  cardNote(
    "summary",
    "pi-01",
    "RICE turns a gut-feel debate into four separate estimates: how many people it touches, how much it moves them, how sure we are and what it costs. The score matters less than making each assumption visible so the team can challenge it.",
    "2026-09-04T18:20:00.000Z",
    { lastReviewedAt: "2026-10-10T08:30:00.000Z" },
  ),
  cardNote(
    "summary",
    "pi-02",
    "People are polite, so opinions about my idea tell me nothing. Ask about the last time the problem happened, what they did and what it cost them. A good conversation ends with a concrete next step from them, not a compliment.",
    "2026-09-11T21:10:00.000Z",
    { refinedAt: "2026-09-12T08:05:00.000Z", reviewAt: WRITTEN_FOR },
  ),
  cardNote(
    "summary",
    "pi-05",
    "Not every task deserves my best work. Leverage tasks get full effort, neutral ones get done well enough and overhead gets done fast. When execution keeps slipping, check whether the strategy was ever clear.",
    "2026-10-01T19:00:00.000Z",
  ),
  cardNote(
    "summary",
    "pi-07",
    "Time horizons instead of dates. Now is detailed and committed, Next is shaped problems, Later is deliberately vague. Writing each card as a problem to solve keeps the roadmap honest about what we don't know yet.",
    "2026-10-06T20:40:00.000Z",
    { refinedAt: "2026-10-07T07:45:00.000Z" },
  ),
  cardNote(
    "summary",
    "pi-10",
    "Stopping a test the moment it looks significant inflates false positives. Fix the sample size up front, or use a sequential method designed for peeking.",
    "2026-10-15T13:30:00.000Z",
  ),
  // Card notes.
  cardNote(
    "item_note",
    "pi-12",
    "Themes over features. Try the 'roadmap as a hypothesis' framing with the VP.\nStakeholder interviews before drafting, not after.",
    "2026-10-11T10:40:00.000Z",
  ),
  cardNote(
    "item_note",
    "pi-13",
    "Set up a recurring Thursday interview slot with our CS team's help.\nKeep the tree to one outcome: activation in the first week.",
    "2026-10-12T09:50:00.000Z",
  ),
  // Free notes.
  {
    id: "note-free-1on1",
    kind: "free",
    title: "Questions for my 1:1",
    body: "What would make the roadmap review a clear yes for my promotion case?\nWho else should see the Q1 plan before it goes to leadership?\nCan I sit in on the pricing decision next month?",
    skillIds: ["stakeholder-management"],
    createdAt: "2026-10-14T08:10:00.000Z",
    updatedAt: "2026-10-16T17:30:00.000Z",
  },
  {
    id: "note-free-roadmap-prep",
    kind: "free",
    title: "Roadmap review prep",
    body: "Open with the outcome, not the feature list.\nShow Now, Next and Later on one page.\nBring two options for the onboarding bet, and say which one I'd pick and why.\nPre-wire finance and sales the week before.",
    skillIds: ["roadmapping", "communication"],
    reviewAt: "2026-10-21",
    createdAt: "2026-10-12T19:00:00.000Z",
    updatedAt: "2026-10-17T21:15:00.000Z",
  },
];

// --- OKRs (ADR 007, 011) ---------------------------------------------------------------

const OBJECTIVES: Objective[] = [
  {
    id: "obj-q-1",
    quarter: "2026-Q3",
    title: "Make customer discovery a weekly habit",
    why: "Talking to customers every week makes every roadmap call easier to defend.",
    status: "closed",
    finalProgress: 80,
    closedAt: "2026-10-01T07:15:00.000Z",
    source: "manual",
    keyResults: [
      { id: "kr-q-1-count", title: "Complete 5 Product Discovery items", skillId: "product-discovery", type: "count", count: 5 },
      {
        id: "kr-q-1-cdh",
        title: "Finish Continuous Discovery Habits",
        skillId: "product-discovery",
        type: "material",
        materialId: "book-continuous-discovery-habits",
      },
    ],
    createdAt: "2026-07-01T08:00:00.000Z",
  },
  {
    id: "obj-q0",
    quarter: "2026-Q4",
    title: "Lead roadmap conversations with confidence",
    why: "Roadmap reviews are where a promotion case gets made.",
    status: "active",
    source: "quick",
    keyResults: [
      {
        id: "kr-q0-roadmaps-book",
        title: "Finish Product Roadmaps Relaunched",
        skillId: "roadmapping",
        type: "material",
        materialId: "book-product-roadmaps-relaunched",
      },
      { id: "kr-q0-count", title: "Complete 3 Roadmapping items", skillId: "roadmapping", type: "count", count: 3 },
    ],
    createdAt: "2026-10-01T07:30:00.000Z",
  },
  {
    id: "obj-q1",
    quarter: "2027-Q1",
    title: "Bring stakeholders along on big decisions",
    why: "Senior PMs get decisions made without surprises.",
    status: "active",
    source: "quick",
    keyResults: [
      {
        id: "kr-q1-crucial",
        title: "Finish Crucial Conversations",
        skillId: "stakeholder-management",
        type: "material",
        materialId: "book-crucial-conversations",
      },
      {
        id: "kr-q1-count",
        title: "Complete 3 Stakeholder Management items",
        skillId: "stakeholder-management",
        type: "count",
        count: 3,
      },
    ],
    createdAt: "2026-10-01T07:30:00.000Z",
  },
  {
    id: "obj-q2",
    quarter: "2027-Q2",
    title: "Test ideas before they cost engineering time",
    why: "Cheap evidence beats expensive opinions in planning.",
    status: "active",
    source: "quick",
    keyResults: [
      {
        id: "kr-q2-experiments-book",
        title: "Finish Trustworthy Online Controlled Experiments",
        skillId: "experimentation",
        type: "material",
        materialId: "book-trustworthy-online-controlled-experiments",
      },
      { id: "kr-q2-count", title: "Complete 3 Experimentation items", skillId: "experimentation", type: "count", count: 3 },
    ],
    createdAt: "2026-10-01T07:30:00.000Z",
  },
  {
    id: "obj-q3",
    quarter: "2027-Q3",
    title: "Run an outcome-based roadmap",
    why: "Owning the roadmap is the next step up.",
    status: "active",
    source: "quick",
    keyResults: [
      {
        id: "kr-q3-cert",
        title: "Earn the Product Management Certification",
        skillId: "roadmapping",
        type: "certification",
        materialId: "cert-pragmatic-product-management",
      },
      {
        id: "kr-q3-build-trap",
        title: "Finish Escaping the Build Trap",
        skillId: "roadmapping",
        type: "material",
        materialId: "book-escaping-the-build-trap",
      },
    ],
    createdAt: "2026-10-01T07:30:00.000Z",
  },
  {
    id: "obj-q4",
    quarter: "2027-Q4",
    title: "Lead hard conversations with calm",
    why: "Calm under pushback is what leadership looks for.",
    status: "active",
    source: "quick",
    keyResults: [
      {
        id: "kr-q4-negotiation",
        title: "Finish Never Split the Difference",
        skillId: "stakeholder-management",
        type: "material",
        materialId: "book-never-split-the-difference",
      },
      { id: "kr-q4-count", title: "Complete 2 Communication items", skillId: "communication", type: "count", count: 2 },
    ],
    createdAt: "2026-10-01T07:30:00.000Z",
  },
];

// --- Month reviews ---------------------------------------------------------------------

const ROLLOVERS: RolloverRecord[] = [
  {
    fromMonth: "2026-07",
    toMonth: "2026-08",
    completedAt: "2026-08-01T08:10:00.000Z",
    counts: { carry_over: 0, backlog: 0, drop: 1 },
  },
  {
    fromMonth: "2026-08",
    toMonth: "2026-09",
    completedAt: "2026-09-01T07:40:00.000Z",
    counts: { carry_over: 0, backlog: 0, drop: 0 },
  },
  {
    fromMonth: "2026-09",
    toMonth: "2026-10",
    completedAt: "2026-10-01T07:20:00.000Z",
    counts: { carry_over: 1, backlog: 0, drop: 0 },
    closedObjectiveIds: ["obj-q-1"],
  },
];

export const DEMO_DATA: SampleSeed = {
  writtenFor: WRITTEN_FOR,
  version: 4,
  // No name, so the greeting reads "Good afternoon".
  profile: {
    role: "pm",
    goal: "promotion",
    skillLevels: [
      { skillId: "roadmapping", current: 2, target: 4, updatedAt: "2026-10-01T07:25:00.000Z" },
      { skillId: "stakeholder-management", current: 2, target: 4, updatedAt: "2026-10-01T07:25:00.000Z" },
      { skillId: "product-discovery", current: 3, target: 4, updatedAt: "2026-10-01T07:25:00.000Z" },
    ],
  },
  skills: BUILT_IN_SKILLS.map(storedSkill),
  customMaterials: DEMO_CUSTOM_MATERIALS,
  savedMaterialIds: [
    "book-escaping-the-build-trap",
    "cert-pragmatic-product-management",
    "book-never-split-the-difference",
    "book-influence-without-authority",
    "book-shape-up",
    "article-pichler-go-product-roadmap",
  ],
  objectives: OBJECTIVES,
  planItems: PLAN_ITEMS,
  notes: NOTES,
  rollovers: ROLLOVERS,
  activity: [],
  archivedYears: [],
  dashboardLayout: null,
};
