/**
 * "How Growloop works" (/guide; help-and-guide.md §Guide page, H-4, H-5):
 * content as data. Paragraph text may mark words as **bold**; nothing else is
 * interpreted, so copy edits never touch components.
 */

export interface GuideLink {
  label: string;
  href: string;
}

export interface GuideSection {
  id: string;
  heading: string;
  paragraphs: string[];
  link?: GuideLink;
}

export interface Guide {
  title: string;
  intro: string;
  loop: { id: string; heading: string; steps: GuideLink[]; caption: string };
  sections: GuideSection[];
  tourButton: string;
}

export const GUIDE: Guide = {
  title: "How Growloop works",
  intro: "A growth loop for yourself: plan, learn, reflect, repeat.",
  loop: {
    id: "the-loop",
    heading: "The loop",
    steps: [
      { label: "Set your year", href: "/okrs" },
      { label: "Find something", href: "/library" },
      { label: "Plan the month", href: "/board" },
      { label: "Learn", href: "/board" },
      { label: "Summarize", href: "/notebook" },
      { label: "Wrap up the month", href: "/board" },
    ],
    caption: "The year gives direction. The month is the rhythm.",
  },
  sections: [
    {
      id: "set-your-year",
      heading: "Set your year",
      paragraphs: [
        "Pick a few objectives for the year, one per quarter is plenty. Each has two or three key results tied to one skill: finish a specific book or course, earn a certification, or finish a number of things in that skill. Progress fills in by itself as you finish cards. At the end of a quarter you close each objective with its score, or move it once to the next quarter.",
      ],
      link: { label: "Plan my year", href: "/okrs/plan" },
    },
    {
      id: "plan-the-month",
      heading: "Plan the month",
      paragraphs: [
        "**Add** puts something on this month's board, ready to start. **Save to library** keeps it for some other time. **Backlog** on the board is for things you've committed to, just not this month. Three to five things a month is a good start.",
      ],
    },
    {
      id: "learn-and-reflect",
      heading: "Learn and reflect",
      paragraphs: [
        "Open a card to tick off chapters, take notes and write a summary in your own words. Two or three sentences is plenty; writing it is what makes it stick. Every summary and note also lives in your Notebook. Mark one Review later and it comes back on your dashboard when it's due.",
      ],
    },
    {
      id: "wrap-up-the-month",
      heading: "Wrap up the month",
      paragraphs: [
        "When a month ends, Growloop asks about anything unfinished: carry it over, park it in the backlog, or drop it. Nothing moves silently, so you learn how much a month really holds.",
      ],
    },
    {
      id: "skills-and-the-radar",
      heading: "Skills and the radar",
      paragraphs: [
        "Every material builds one main skill and maybe a few others. The radar adds them up: solid for what you finished this month, dashed for what's still planned. Longer materials count a little more. Click any skill to see your level, your goals and what's on your board for it.",
      ],
    },
    {
      id: "claude",
      heading: "Claude (optional)",
      paragraphs: [
        "Claude can draft your yearly plan, fill in details for something you paste, recommend what to learn for a skill and give feedback on your summaries. Turn it on with your own Claude API key in Settings; it stays in your browser and goes only to Anthropic. Running Growloop on your computer with Claude Code works too. Only what a feature needs is sent, never your whole workspace. Without Claude, everything still works.",
      ],
      link: { label: "Turn on Claude", href: "/settings#claude" },
    },
    {
      id: "your-data",
      heading: "Your data",
      paragraphs: [
        "Everything is stored in this browser. There's no account and no server copy. Export a JSON file to back up or move to another browser, and import it there. Want to look around first? Try the sample data; your own data stays safe and comes back when you exit.",
      ],
      link: { label: "Settings → Your data", href: "/settings#data" },
    },
  ],
  tourButton: "Take the tour",
};
