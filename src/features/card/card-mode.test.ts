import { describe, expect, it } from "vitest";
import { makeItem, makeKeyResult, makeObjective } from "@/lib/testing/fixtures";
import {
  alsoCountsToward,
  cardMonth,
  cardQuarter,
  carriedOverLabel,
  isReadOnlyCard,
  joinNames,
  keyResultChoices,
  monthName,
  removedMessage,
  setPrimarySkill,
  toggleCardSkill,
} from "./card-mode";
import { shortTitle } from "./use-done-follow-ups";

describe("read-only mode", () => {
  it("makes past-month and archived cards read-only, never Backlog or this month's", () => {
    expect(isReadOnlyCard(makeItem({ month: "2026-09", status: "done" }), "2026-10", [])).toBe(true);
    expect(isReadOnlyCard(makeItem({ month: "2026-10", status: "todo" }), "2026-10", [])).toBe(false);
    expect(isReadOnlyCard(makeItem({ month: "2026-03", status: "backlog" }), "2026-10", [])).toBe(false);
    expect(isReadOnlyCard(makeItem({ month: "2025-12", status: "done" }), "2026-01", [2025])).toBe(true);
  });

  it("puts Backlog cards on the current month", () => {
    expect(cardMonth(makeItem({ month: "2026-03", status: "backlog" }), "2026-10")).toBe("2026-10");
    expect(cardMonth(makeItem({ month: "2026-09", status: "done" }), "2026-10")).toBe("2026-09");
    expect(cardQuarter(makeItem({ month: "2026-06", status: "done" }), "2026-10")).toBe("2026-Q2");
  });
});

describe("labels", () => {
  it("names months, with the year only when it differs", () => {
    expect(monthName("2026-09", "2026-10")).toBe("September");
    expect(monthName("2025-12", "2026-01")).toBe("December 2025");
    expect(joinNames(["July", "August", "September"])).toBe("July, August and September");
    expect(joinNames([])).toBe("");
  });

  it("says where a card was carried over from", () => {
    expect(carriedOverLabel(makeItem({ month: "2026-10" }))).toBeUndefined();
    expect(carriedOverLabel(makeItem({ month: "2026-10", carriedFrom: ["2026-09"] }))).toBe("Carried over from September");
    expect(carriedOverLabel(makeItem({ month: "2026-10", carriedFrom: ["2026-08", "2026-09"] }))).toBe(
      "Carried over from August and September",
    );
  });

  it("words the remove toast like the board", () => {
    expect(removedMessage(makeItem({ month: "2026-10", status: "todo" }), "2026-10")).toBe("Removed from October");
    expect(removedMessage(makeItem({ month: "2026-04", status: "backlog" }), "2026-10")).toBe("Removed from Backlog");
  });
});

describe("card skills", () => {
  it("keeps 1 to 3 skills and adds new ones last", () => {
    expect(toggleCardSkill(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleCardSkill(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
    expect(toggleCardSkill(["a", "b"], "a")).toEqual(["b"]);
    expect(toggleCardSkill(["a"], "a")).toEqual(["a"]);
  });

  it("moves the primary skill first", () => {
    expect(setPrimarySkill(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
    expect(setPrimarySkill(["a", "b"], "z")).toEqual(["a", "b"]);
  });
});

describe("key result link", () => {
  const roadmapping = makeKeyResult({ title: "Finish Escaping the Build Trap", skillId: "roadmapping", type: "material" });
  const discovery = makeKeyResult({ title: "Run 3 interviews", skillId: "discovery", type: "count", count: 3 });
  const later = makeKeyResult({ title: "Roadmap course", skillId: "roadmapping", type: "material" });
  const closed = makeKeyResult({ title: "Old KR", skillId: "roadmapping" });
  const objectives = [
    makeObjective({ quarter: "2026-Q4", title: "Lead roadmap conversations", keyResults: [discovery, roadmapping] }),
    makeObjective({ quarter: "2027-Q1", keyResults: [later] }),
    makeObjective({ quarter: "2026-Q3", status: "closed", keyResults: [closed] }),
  ];

  it("offers active KRs, matching skills first, then the card's quarter", () => {
    const item = makeItem({ skillIds: ["roadmapping"] });
    expect(keyResultChoices(item, objectives, [], "2026-Q4").map((choice) => choice.keyResult.title)).toEqual([
      "Finish Escaping the Build Trap",
      "Roadmap course",
      "Run 3 interviews",
    ]);
  });

  it("leaves out the linked KR and archived years", () => {
    const item = makeItem({ skillIds: ["roadmapping"], keyResultId: roadmapping.id });
    expect(keyResultChoices(item, objectives, [2027], "2026-Q4").map((choice) => choice.keyResult.id)).toEqual([discovery.id]);
  });

  it("lists the quarter's count KRs with a skill on the card as also counting", () => {
    expect(alsoCountsToward(makeItem({ skillIds: ["discovery"] }), objectives, "2026-Q4")).toEqual([discovery]);
    expect(alsoCountsToward(makeItem({ skillIds: ["discovery"], keyResultId: discovery.id }), objectives, "2026-Q4")).toEqual([]);
    expect(alsoCountsToward(makeItem({ skillIds: ["discovery"] }), objectives, "2027-Q1")).toEqual([]);
  });
});

describe("shortTitle", () => {
  it("uses a trailing abbreviation in brackets, else the title", () => {
    expect(shortTitle("Certified Scrum Product Owner (CSPO)")).toBe("CSPO");
    expect(shortTitle("Professional Scrum Product Owner I (PSPO I)")).toBe("PSPO I");
    expect(shortTitle("Google Project Management Certificate")).toBe("Google Project Management Certificate");
  });
});
