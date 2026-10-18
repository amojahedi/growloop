import type { Skill } from "@/lib/domain/types";

/**
 * A curated skill plus static data that ships with the app and is never
 * stored: `objectivePhrases` are the quick draft's objective titles for the
 * skill's first and second objective (docs/product/specs/okrs-and-wizard.md).
 */
export interface BuiltInSkill extends Skill {
  builtIn: true;
  objectivePhrases: readonly [first: string, second: string];
}

/**
 * Curated starter set of product management skills (PRD §5.2 S-1).
 * Ids are stable and referenced by materials, objectives and plan items.
 */
export const BUILT_IN_SKILLS: readonly BuiltInSkill[] = [
  {
    id: "stakeholder-management",
    name: "Stakeholder Management",
    description:
      "Building trust and alignment with execs, partners and peer teams so decisions stick. Covers influence without authority, negotiation and handling disagreement.",
    icon: "users",
    color: "orange",
    builtIn: true,
    objectivePhrases: ["Bring stakeholders along on big decisions", "Lead hard conversations with calm"],
  },
  {
    id: "roadmapping",
    name: "Roadmapping",
    description:
      "Turning strategy into a sequenced plan that communicates intent without overpromising dates. Includes outcome-based and Now-Next-Later formats.",
    icon: "map",
    color: "blue",
    builtIn: true,
    objectivePhrases: ["Lead roadmap conversations with confidence", "Run an outcome-based roadmap"],
  },
  {
    id: "product-discovery",
    name: "Product Discovery",
    description:
      "Learning what customers need and testing ideas cheaply before committing engineering time. Interviews, opportunity mapping and prototyping live here.",
    icon: "search",
    color: "teal",
    builtIn: true,
    objectivePhrases: ["Make customer discovery a weekly habit", "Test ideas before they cost engineering time"],
  },
  {
    id: "prioritization",
    name: "Prioritization",
    description:
      "Deciding what not to do. Frameworks and judgment for trading off impact, effort, risk and opportunity cost, for the team and for your own time.",
    icon: "list-ordered",
    color: "amber",
    builtIn: true,
    objectivePhrases: ["Say no with clear reasons", "Make trade-offs the team trusts"],
  },
  {
    id: "product-analytics",
    name: "Product Analytics",
    description:
      "Choosing the right metrics, instrumenting behaviour and reading the data to find where the product is working and where it is not.",
    icon: "chart-line",
    color: "cyan",
    builtIn: true,
    objectivePhrases: ["Make decisions with product data", "Own the metrics that matter"],
  },
  {
    id: "product-strategy",
    name: "Product Strategy",
    description:
      "Diagnosing the real challenge and picking a focused set of bets that create lasting advantage. Connects company goals to what the team builds.",
    icon: "compass",
    color: "indigo",
    builtIn: true,
    objectivePhrases: ["Connect the team's work to a clear strategy", "Shape strategy, not just follow it"],
  },
  {
    id: "ux-design",
    name: "UX & Design",
    description:
      "Understanding usability, interaction design and research well enough to partner with designers and spot experience problems early.",
    icon: "palette",
    color: "pink",
    builtIn: true,
    objectivePhrases: ["Speak design fluently with designers", "Raise the bar on usability"],
  },
  {
    id: "communication",
    name: "Communication",
    description:
      "Writing and speaking with clarity: structuring an argument, telling a memorable story and adapting the message to the audience.",
    icon: "message-square",
    color: "sky",
    builtIn: true,
    objectivePhrases: ["Write and present with clarity", "Tell stories that move decisions"],
  },
  {
    id: "leadership",
    name: "Leadership",
    description:
      "Coaching, giving feedback and creating the conditions for empowered teams, whether or not you manage people directly.",
    icon: "crown",
    color: "violet",
    builtIn: true,
    objectivePhrases: ["Grow the people around you", "Lead without the title"],
  },
  {
    id: "go-to-market",
    name: "Go-to-Market",
    description:
      "Positioning, launching and growing a product: picking a beachhead segment, finding channels and making the value obvious to buyers.",
    icon: "rocket",
    color: "rose",
    builtIn: true,
    objectivePhrases: ["Launch with a real go-to-market plan", "Partner with sales and marketing on launches"],
  },
  {
    id: "technical-fluency",
    name: "Technical Fluency",
    description:
      "Enough grounding in software, data and AI to ask good questions, weigh engineering trade-offs and earn credibility with your team.",
    icon: "code",
    color: "slate",
    builtIn: true,
    objectivePhrases: ["Hold your own in technical discussions", "Make sharper calls on technical trade-offs"],
  },
  {
    id: "experimentation",
    name: "Experimentation",
    description:
      "Designing trustworthy A/B tests and lean experiments, avoiding statistical traps and turning results into decisions.",
    icon: "flask-conical",
    color: "lime",
    builtIn: true,
    objectivePhrases: ["Run experiments that settle debates", "Make experimentation a team habit"],
  },
];

/** The part of a built-in skill that is stored in the workspace; static data like `objectivePhrases` stays here. */
export function storedSkill({ objectivePhrases: _phrases, ...skill }: BuiltInSkill): Skill {
  return skill;
}

/** The quick draft's objective phrases for a built-in skill, or undefined for the user's own skills. */
export function objectivePhrasesFor(skillId: string): BuiltInSkill["objectivePhrases"] | undefined {
  return BUILT_IN_SKILLS.find((skill) => skill.id === skillId)?.objectivePhrases;
}
