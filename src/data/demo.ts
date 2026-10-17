import type { AppData, Material, PlanItem, Task } from "@/lib/domain/types";
import { CURATED_MATERIALS } from "./materials";
import { BUILT_IN_SKILLS } from "./skills";
import { suggestedTasksFor } from "./suggested-tasks";

/**
 * Sample data for the hosted demo. Set in October 2026 (quarter 2026-Q4),
 * with a finished September that was rolled over into October.
 */

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
  if (!found) throw new Error(`Demo data references unknown material "${id}"`);
  return found;
}

/**
 * Builds a plan item's checklist from the material's suggested tasks.
 * `milestonesDoneAt` holds completion timestamps for the first N milestone tasks;
 * `summaryDoneAt` marks the "Summarize in my words" task as done.
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
  const suggested = suggestedTasksFor(material(materialId));
  const tasks: Task[] = suggested.map((t, i) => {
    const completedAt = t.kind === "milestone" ? milestonesDoneAt[i] : summaryDoneAt;
    return {
      ...t,
      id: `${planItemId}-t${i + 1}`,
      done: completedAt !== undefined,
      ...(completedAt ? { completedAt } : {}),
    };
  });
  custom.forEach((c, i) => {
    tasks.push({ id: `${planItemId}-c${i + 1}`, kind: "custom", ...c });
  });
  return tasks;
}

/** Completed item: every suggested task checked off at the item's completion time. */
function allDone(planItemId: string, materialId: string, completedAt: string): Task[] {
  const count = material(materialId).milestones?.length ?? 0;
  return tasksFor(planItemId, materialId, {
    milestonesDoneAt: Array.from({ length: count }, () => completedAt),
    summaryDoneAt: completedAt,
  });
}

const PLAN_ITEMS: PlanItem[] = [
  // ------------------------------------------------------------ September 2026
  {
    id: "pi-01",
    materialId: "article-intercom-rice",
    month: "2026-09",
    status: "done",
    order: 0,
    skillIds: ["prioritization"],
    tasks: allDone("pi-01", "article-intercom-rice", "2026-09-04T18:20:00.000Z"),
    notes: "Tried scoring our Q4 candidate list with RICE. Confidence column sparked the best debate.",
    summary:
      "RICE turns a gut-feel debate into four separate estimates: how many people it touches, how much it moves them, how sure we are and what it costs. The score matters less than making each assumption visible so the team can challenge it.",
    estimatedHours: 0.25,
    timeLogs: [],
    createdAt: "2026-09-01T09:00:00.000Z",
    completedAt: "2026-09-04T18:20:00.000Z",
  },
  {
    id: "pi-02",
    materialId: "book-the-mom-test",
    month: "2026-09",
    status: "done",
    order: 1,
    skillIds: ["product-discovery"],
    tasks: allDone("pi-02", "book-the-mom-test", "2026-09-11T21:10:00.000Z"),
    notes: "Rewrote our interview guide: removed every \"would you use…\" question.",
    summary:
      "People are polite, so opinions about my idea are worthless. Ask about the last time the problem happened, what they did and what it cost them. A good conversation ends with a concrete next step from them, not a compliment.",
    estimatedHours: 3,
    timeLogs: [
      { id: "pi-02-l1", date: "2026-09-08", hours: 1.5 },
      { id: "pi-02-l2", date: "2026-09-11", hours: 1.5 },
    ],
    createdAt: "2026-09-01T09:05:00.000Z",
    completedAt: "2026-09-11T21:10:00.000Z",
  },
  {
    id: "pi-04",
    materialId: "article-svpg-stakeholder-management",
    month: "2026-09",
    status: "done",
    order: 2,
    skillIds: ["stakeholder-management"],
    tasks: allDone("pi-04", "article-svpg-stakeholder-management", "2026-09-26T16:45:00.000Z"),
    notes: "Booked 1:1s with legal and finance to learn their constraints before the pricing work.",
    summary: "",
    estimatedHours: 0.25,
    timeLogs: [],
    createdAt: "2026-09-10T10:00:00.000Z",
    completedAt: "2026-09-26T16:45:00.000Z",
  },

  // ------------------------------------------------------------ October 2026: done
  {
    id: "pi-05",
    materialId: "podcast-lenny-shreyas-doshi",
    month: "2026-10",
    status: "done",
    order: 0,
    skillIds: ["prioritization", "product-strategy"],
    tasks: allDone("pi-05", "podcast-lenny-shreyas-doshi", "2026-10-01T19:00:00.000Z"),
    notes: "Tagged my calendar for a week with L / N / O. About 40% of it was overhead.",
    summary:
      "Not every task deserves my best work. Leverage tasks get full effort, neutral ones get done well enough and overhead gets done fast. When execution keeps slipping, check whether the strategy was ever clear.",
    estimatedHours: 1.5,
    timeLogs: [{ id: "pi-05-l1", date: "2026-10-01", hours: 1.5 }],
    createdAt: "2026-10-01T07:30:00.000Z",
    completedAt: "2026-10-01T19:00:00.000Z",
  },
  {
    id: "pi-06",
    materialId: "article-svpg-alternative-to-roadmaps",
    month: "2026-10",
    status: "done",
    order: 1,
    skillIds: ["roadmapping", "product-strategy"],
    keyResultId: "kr-roadmap-materials",
    tasks: allDone("pi-06", "article-svpg-alternative-to-roadmaps", "2026-10-03T12:15:00.000Z"),
    notes: "",
    summary:
      "Feature roadmaps promise outputs before we know if they will work. Share the vision and the problems each team owns, and only commit to dates once discovery has de-risked the work.",
    estimatedHours: 0.25,
    timeLogs: [],
    createdAt: "2026-10-01T08:00:00.000Z",
    completedAt: "2026-10-03T12:15:00.000Z",
  },
  {
    id: "pi-07",
    materialId: "article-now-next-later-roadmap",
    month: "2026-10",
    status: "done",
    order: 2,
    skillIds: ["roadmapping"],
    keyResultId: "kr-roadmap-materials",
    tasks: allDone("pi-07", "article-now-next-later-roadmap", "2026-10-06T20:40:00.000Z"),
    notes: "Drafted a Now / Next / Later version of our Q1 plan in Figjam to show the team.",
    summary:
      "Time horizons instead of dates. Now is detailed and committed, Next is shaped problems, Later is deliberately vague. Write each card as a problem to solve.",
    estimatedHours: 0.5,
    timeLogs: [{ id: "pi-07-l1", date: "2026-10-06", hours: 0.5 }],
    createdAt: "2026-10-01T08:05:00.000Z",
    completedAt: "2026-10-06T20:40:00.000Z",
  },
  {
    id: "pi-08",
    materialId: "article-opportunity-solution-trees",
    month: "2026-10",
    status: "done",
    order: 3,
    skillIds: ["product-discovery", "prioritization"],
    keyResultId: "kr-discovery-materials",
    tasks: allDone("pi-08", "article-opportunity-solution-trees", "2026-10-09T17:05:00.000Z"),
    notes: "Built a first tree for the onboarding outcome. Too many solutions, not enough opportunities.",
    summary: "",
    estimatedHours: 0.5,
    timeLogs: [],
    createdAt: "2026-10-01T08:10:00.000Z",
    completedAt: "2026-10-09T17:05:00.000Z",
  },
  {
    id: "pi-09",
    materialId: "podcast-think-fast-talk-smart",
    month: "2026-10",
    status: "done",
    order: 4,
    skillIds: ["communication"],
    keyResultId: "kr-present-roadmap",
    tasks: allDone("pi-09", "podcast-think-fast-talk-smart", "2026-10-13T08:15:00.000Z"),
    notes: "Practise the what / so what / now what structure before the leadership review.",
    summary:
      "For impromptu answers, use a simple three-part structure and focus on what the listener needs rather than on sounding clever.",
    estimatedHours: 0.5,
    timeLogs: [],
    createdAt: "2026-10-05T09:00:00.000Z",
    completedAt: "2026-10-13T08:15:00.000Z",
  },
  {
    id: "pi-10",
    materialId: "article-how-not-to-run-an-ab-test",
    month: "2026-10",
    status: "done",
    order: 5,
    skillIds: ["experimentation"],
    keyResultId: "kr-ab-tests",
    tasks: allDone("pi-10", "article-how-not-to-run-an-ab-test", "2026-10-15T13:30:00.000Z"),
    notes: "Shared with the growth squad. We were peeking daily on the paywall test.",
    summary:
      "Stopping a test the moment it looks significant inflates false positives. Fix the sample size up front, or use a sequential method designed for peeking.",
    estimatedHours: 0.25,
    timeLogs: [],
    createdAt: "2026-10-08T11:00:00.000Z",
    completedAt: "2026-10-15T13:30:00.000Z",
  },
  {
    id: "pi-11",
    materialId: "podcast-lenny-ronny-kohavi",
    month: "2026-10",
    status: "done",
    order: 6,
    skillIds: ["experimentation"],
    keyResultId: "kr-ab-tests",
    tasks: allDone("pi-11", "podcast-lenny-ronny-kohavi", "2026-10-16T19:50:00.000Z"),
    notes: "",
    summary: "",
    estimatedHours: 1.5,
    timeLogs: [{ id: "pi-11-l1", date: "2026-10-16", hours: 1.5 }],
    createdAt: "2026-10-08T11:05:00.000Z",
    completedAt: "2026-10-16T19:50:00.000Z",
  },

  // ------------------------------------------------------------ October 2026: in progress
  {
    id: "pi-12",
    materialId: "book-product-roadmaps-relaunched",
    month: "2026-10",
    status: "in_progress",
    order: 0,
    skillIds: ["roadmapping", "stakeholder-management"],
    keyResultId: "kr-roadmap-materials",
    tasks: tasksFor("pi-12", "book-product-roadmaps-relaunched", {
      milestonesDoneAt: ["2026-09-24T20:00:00.000Z", "2026-10-07T21:00:00.000Z", "2026-10-11T10:30:00.000Z"],
      custom: [{ title: "Turn chapter notes into a one-page roadmap template", done: false }],
    }),
    notes:
      "Themes > features. Try the 'roadmap as a hypothesis' framing with the VP.\nStakeholder interviews before drafting, not after.",
    summary: "",
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
    keyResultId: "kr-discovery-materials",
    tasks: tasksFor("pi-13", "book-continuous-discovery-habits", {
      milestonesDoneAt: ["2026-10-08T20:30:00.000Z", "2026-10-12T09:45:00.000Z"],
    }),
    notes: "Set up a recurring Thursday interview slot with our CS team's help.",
    summary: "",
    reminder: { date: "2026-10-30", note: "Share the opportunity tree draft with design and eng" },
    estimatedHours: 6,
    timeLogs: [
      { id: "pi-13-l1", date: "2026-10-08", hours: 1 },
      { id: "pi-13-l2", date: "2026-10-12", hours: 1.5 },
      { id: "pi-13-l3", date: "2026-10-17", hours: 1 },
    ],
    createdAt: "2026-10-01T08:15:00.000Z",
  },

  // ------------------------------------------------------------ October 2026: to do
  {
    id: "pi-14",
    materialId: "course-amplitude-academy",
    month: "2026-10",
    status: "todo",
    order: 0,
    skillIds: ["product-analytics"],
    keyResultId: "kr-analytics-course",
    tasks: tasksFor("pi-14", "course-amplitude-academy"),
    notes: "",
    summary: "",
    reminder: { date: "2026-11-02", note: "Start the retention module" },
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
    keyResultId: "kr-present-roadmap",
    tasks: tasksFor("pi-15", "book-crucial-conversations"),
    notes: "",
    summary: "",
    estimatedHours: 6.5,
    timeLogs: [],
    createdAt: "2026-10-05T09:10:00.000Z",
  },

  // ------------------------------------------------------------ October 2026: backlog
  {
    id: "pi-16",
    materialId: "book-trustworthy-online-controlled-experiments",
    month: "2026-10",
    status: "backlog",
    order: 0,
    skillIds: ["experimentation", "product-analytics"],
    tasks: tasksFor("pi-16", "book-trustworthy-online-controlled-experiments"),
    notes: "",
    summary: "",
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
    keyResultId: "kr-interviews",
    tasks: tasksFor("pi-17", "custom-team-interview-playbook", {
      custom: [{ title: "Update the recruiting script with Mom Test questions", done: false }],
    }),
    notes: "",
    summary: "",
    timeLogs: [],
    createdAt: "2026-10-10T15:00:00.000Z",
  },
];

export const DEMO_DATA: AppData = {
  version: 1,
  skills: BUILT_IN_SKILLS,
  customMaterials: DEMO_CUSTOM_MATERIALS,
  objectives: [
    {
      id: "obj-roadmaps",
      quarter: "2026-Q4",
      title: "Lead roadmap conversations with confidence",
      description: "Move our team from a feature list to an outcome-based roadmap that leadership backs.",
      skillIds: ["roadmapping", "stakeholder-management", "communication"],
      keyResults: [
        { id: "kr-roadmap-materials", title: "Finish 3 roadmapping materials", progressMode: "auto" },
        {
          id: "kr-present-roadmap",
          title: "Present a Now / Next / Later roadmap at the December leadership review",
          progressMode: "manual",
          manualProgress: 40,
        },
      ],
      createdAt: "2026-10-01T07:00:00.000Z",
    },
    {
      id: "obj-discovery",
      quarter: "2026-Q4",
      title: "Make customer discovery a weekly habit",
      skillIds: ["product-discovery", "prioritization"],
      keyResults: [
        { id: "kr-discovery-materials", title: "Complete 2 discovery materials", progressMode: "auto" },
        {
          id: "kr-interviews",
          title: "Run 12 customer interviews this quarter",
          progressMode: "manual",
          manualProgress: 50,
        },
      ],
      createdAt: "2026-10-01T07:05:00.000Z",
    },
    {
      id: "obj-data",
      quarter: "2026-Q4",
      title: "Make sharper decisions with product data",
      description: "Read our own dashboards confidently and run experiments the team trusts.",
      skillIds: ["product-analytics", "experimentation"],
      keyResults: [
        { id: "kr-analytics-course", title: "Complete one analytics course", progressMode: "auto" },
        {
          id: "kr-ab-tests",
          title: "Ship 2 A/B tests with a pre-registered readout",
          progressMode: "manual",
          manualProgress: 25,
        },
      ],
      createdAt: "2026-10-01T07:10:00.000Z",
    },
  ],
  planItems: PLAN_ITEMS,
  rollovers: [{ fromMonth: "2026-09", toMonth: "2026-10", completedAt: "2026-10-01T07:20:00.000Z" }],
};
