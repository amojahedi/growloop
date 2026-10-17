import { describe, expect, it } from "vitest";
import { makeMaterial } from "@/lib/testing/fixtures";
import {
  applyFilters,
  clearFilters,
  DEFAULT_FILTERS,
  hasActiveFilters,
  lengthBucketOf,
  matchesFilters,
  searchTerms,
  sortMaterials,
  toggleOption,
  type ResourceFilters,
} from "./resource-filters";

const inspired = makeMaterial({
  id: "inspired",
  type: "book",
  title: "Inspired",
  author: "Marty Cagan",
  tagline: "How strong product teams work.",
  keyTakeaways: ["Test ideas early with prototypes."],
  skillIds: ["discovery", "strategy"],
  estimatedHours: 9,
  level: "beginner",
  cost: "paid",
});
const pspo = makeMaterial({
  id: "pspo",
  type: "certification",
  title: "Professional Scrum Product Owner I",
  author: "Scrum.org",
  skillIds: ["prioritization"],
  estimatedHours: 15,
  level: "intermediate",
  cost: "paid",
});
const episode = makeMaterial({
  id: "episode",
  type: "podcast",
  title: "Café conversations",
  author: "A Host",
  skillIds: ["discovery"],
  estimatedHours: 0.75,
  level: "beginner",
  cost: "free",
});
const unknownLength = makeMaterial({ id: "unknown", type: "article", title: "Another read", estimatedHours: undefined, level: "advanced", cost: "freemium" });
const all = [inspired, pspo, episode, unknownLength];

const context = { libraryIds: new Set(["pspo"]) };
const filters = (overrides: Partial<ResourceFilters>): ResourceFilters => ({ ...DEFAULT_FILTERS, ...overrides });
const ids = (overrides: Partial<ResourceFilters>) => applyFilters(all, filters(overrides), context).map((m) => m.id);

describe("lengthBucketOf", () => {
  it.each([
    [0.5, "lt1"],
    [1, "1to5"],
    [5, "1to5"],
    [5.5, "5to20"],
    [20, "5to20"],
    [21, "20plus"],
    [undefined, undefined],
  ])("puts %s hours in %s", (hours, bucket) => {
    expect(lengthBucketOf(hours)).toBe(bucket);
  });
});

describe("matchesFilters / applyFilters", () => {
  it("returns everything in curated order without filters", () => {
    expect(ids({})).toEqual(["inspired", "pspo", "episode", "unknown"]);
  });

  it("ORs options within a category", () => {
    expect(ids({ types: ["book", "podcast"] })).toEqual(["inspired", "episode"]);
    expect(ids({ skills: ["strategy", "prioritization"] })).toEqual(["inspired", "pspo"]);
  });

  it("ANDs across categories", () => {
    expect(ids({ skills: ["discovery"], costs: ["free"] })).toEqual(["episode"]);
    expect(ids({ types: ["book"], levels: ["intermediate"] })).toEqual([]);
  });

  it("filters by length bucket and leaves out unknown lengths when a bucket is chosen", () => {
    expect(ids({ lengths: ["lt1", "5to20"] })).toEqual(["inspired", "pspo", "episode"]);
    expect(ids({ lengths: ["20plus"] })).toEqual([]);
  });

  it("filters by library membership", () => {
    expect(ids({ show: "saved" })).toEqual(["pspo"]);
    expect(ids({ show: "not-saved" })).toEqual(["inspired", "episode", "unknown"]);
  });

  it("searches title, author, tagline and takeaways; every term must match", () => {
    expect(ids({ query: "cagan" })).toEqual(["inspired"]);
    expect(ids({ query: "prototypes" })).toEqual(["inspired"]);
    expect(ids({ query: "strong teams" })).toEqual(["inspired"]);
    expect(ids({ query: "strong scrum" })).toEqual([]);
  });

  it("ignores case and accents", () => {
    expect(ids({ query: "CAFE" })).toEqual(["episode"]);
    expect(searchTerms("  Café  Olé ")).toEqual(["cafe", "ole"]);
  });

  it("does not search the summary or audience", () => {
    const material = makeMaterial({ summary: "hidden word", audience: "hidden word" });
    expect(matchesFilters(material, filters({ query: "hidden" }), context)).toBe(false);
  });
});

describe("sortMaterials", () => {
  it("keeps the curated order for Recommended", () => {
    expect(sortMaterials(all, "recommended")).toEqual(all);
  });

  it("sorts by length with unknown lengths last in both directions", () => {
    expect(sortMaterials(all, "shortest").map((m) => m.id)).toEqual(["episode", "inspired", "pspo", "unknown"]);
    expect(sortMaterials(all, "longest").map((m) => m.id)).toEqual(["pspo", "inspired", "episode", "unknown"]);
  });

  it("sorts A–Z ignoring case", () => {
    expect(sortMaterials(all, "title").map((m) => m.title)).toEqual([
      "Another read",
      "Café conversations",
      "Inspired",
      "Professional Scrum Product Owner I",
    ]);
  });

  it("does not mutate its input", () => {
    const input = [...all];
    sortMaterials(input, "title");
    expect(input).toEqual(all);
  });
});

describe("filter state helpers", () => {
  it("toggles options in a category", () => {
    const once = toggleOption(DEFAULT_FILTERS, "types", "book");
    expect(once.types).toEqual(["book"]);
    expect(toggleOption(once, "types", "book").types).toEqual([]);
  });

  it("knows when filters are active; sorting alone doesn't count", () => {
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
    expect(hasActiveFilters(filters({ sort: "longest" }))).toBe(false);
    expect(hasActiveFilters(filters({ query: "  " }))).toBe(false);
    expect(hasActiveFilters(filters({ show: "saved" }))).toBe(true);
    expect(hasActiveFilters(filters({ lengths: ["lt1"] }))).toBe(true);
  });

  it("clears every filter but keeps the sort", () => {
    expect(clearFilters(filters({ query: "x", skills: ["a"], show: "saved", sort: "title" }))).toEqual(
      filters({ sort: "title" }),
    );
  });
});
