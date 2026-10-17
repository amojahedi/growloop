import type { Skill } from "@/lib/domain/types";

/**
 * Curated starter set of product management skills (PRD §5.2 S-1).
 * Ids are stable and referenced by materials, objectives and plan items.
 */
export const BUILT_IN_SKILLS: Skill[] = [
  {
    id: "stakeholder-management",
    name: "Stakeholder Management",
    description:
      "Building trust and alignment with execs, partners and peer teams so decisions stick. Covers influence without authority, negotiation and handling disagreement.",
    icon: "users",
    color: "orange",
    builtIn: true,
  },
  {
    id: "roadmapping",
    name: "Roadmapping",
    description:
      "Turning strategy into a sequenced plan that communicates intent without overpromising dates. Includes outcome-based and Now-Next-Later formats.",
    icon: "map",
    color: "blue",
    builtIn: true,
  },
  {
    id: "product-discovery",
    name: "Product Discovery",
    description:
      "Learning what customers need and testing ideas cheaply before committing engineering time. Interviews, opportunity mapping and prototyping live here.",
    icon: "search",
    color: "teal",
    builtIn: true,
  },
  {
    id: "prioritization",
    name: "Prioritization",
    description:
      "Deciding what not to do. Frameworks and judgment for trading off impact, effort, risk and opportunity cost, for the team and for your own time.",
    icon: "list-ordered",
    color: "amber",
    builtIn: true,
  },
  {
    id: "product-analytics",
    name: "Product Analytics",
    description:
      "Choosing the right metrics, instrumenting behaviour and reading the data to find where the product is working and where it is not.",
    icon: "chart-line",
    color: "cyan",
    builtIn: true,
  },
  {
    id: "product-strategy",
    name: "Product Strategy",
    description:
      "Diagnosing the real challenge and picking a focused set of bets that create lasting advantage. Connects company goals to what the team builds.",
    icon: "compass",
    color: "indigo",
    builtIn: true,
  },
  {
    id: "ux-design",
    name: "UX & Design",
    description:
      "Understanding usability, interaction design and research well enough to partner with designers and spot experience problems early.",
    icon: "palette",
    color: "pink",
    builtIn: true,
  },
  {
    id: "communication",
    name: "Communication",
    description:
      "Writing and speaking with clarity: structuring an argument, telling a memorable story and adapting the message to the audience.",
    icon: "message-square",
    color: "sky",
    builtIn: true,
  },
  {
    id: "leadership",
    name: "Leadership",
    description:
      "Coaching, giving feedback and creating the conditions for empowered teams, whether or not you manage people directly.",
    icon: "crown",
    color: "violet",
    builtIn: true,
  },
  {
    id: "go-to-market",
    name: "Go-to-Market",
    description:
      "Positioning, launching and growing a product: picking a beachhead segment, finding channels and making the value obvious to buyers.",
    icon: "rocket",
    color: "rose",
    builtIn: true,
  },
  {
    id: "technical-fluency",
    name: "Technical Fluency",
    description:
      "Enough grounding in software, data and AI to ask good questions, weigh engineering trade-offs and earn credibility with your team.",
    icon: "code",
    color: "slate",
    builtIn: true,
  },
  {
    id: "experimentation",
    name: "Experimentation",
    description:
      "Designing trustworthy A/B tests and lean experiments, avoiding statistical traps and turning results into decisions.",
    icon: "flask-conical",
    color: "lime",
    builtIn: true,
  },
];
