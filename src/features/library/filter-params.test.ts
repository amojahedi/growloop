import { describe, expect, it } from "vitest";
import { parseFilters, serializeFilters } from "./filter-params";
import { DEFAULT_FILTERS, type ResourceFilters } from "./resource-filters";

const parse = (query: string, known?: string[]) => parseFilters(new URLSearchParams(query), known && new Set(known));

const full: ResourceFilters = {
  query: "product discovery",
  skills: ["product-discovery", "roadmapping"],
  types: ["book", "certification"],
  levels: ["beginner"],
  costs: ["free", "freemium"],
  lengths: ["lt1", "20plus"],
  show: "not-saved",
  sort: "shortest",
};

describe("serializeFilters", () => {
  it("omits defaults, so the unfiltered page has a clean URL", () => {
    expect(serializeFilters(DEFAULT_FILTERS)).toBe("");
  });

  it("writes readable, comma-separated lists", () => {
    expect(serializeFilters(full)).toBe(
      "q=product+discovery&skill=product-discovery,roadmapping&type=book,certification&level=beginner&cost=free,freemium&length=lt1,20plus&show=not-saved&sort=shortest",
    );
  });

  it("trims the search and drops it when blank", () => {
    expect(serializeFilters({ ...DEFAULT_FILTERS, query: "  okr  " })).toBe("q=okr");
    expect(serializeFilters({ ...DEFAULT_FILTERS, query: "   " })).toBe("");
  });
});

describe("parseFilters", () => {
  it("round-trips through the query string", () => {
    expect(parse(serializeFilters(full))).toEqual(full);
  });

  it("round-trips search text with commas, ampersands and non-ASCII characters", () => {
    const filters = { ...DEFAULT_FILTERS, query: "a, b & c — café" };
    expect(parse(serializeFilters(filters))).toEqual(filters);
  });

  it("returns defaults for an empty query string", () => {
    expect(parse("")).toEqual(DEFAULT_FILTERS);
  });

  it("drops unknown values but keeps the valid ones", () => {
    expect(parse("type=book,video&level=expert&cost=paid&length=2h,lt1&show=everything&sort=random")).toEqual({
      ...DEFAULT_FILTERS,
      types: ["book"],
      costs: ["paid"],
      lengths: ["lt1"],
    });
  });

  it("does not offer the internal 'custom' type as a filter", () => {
    expect(parse("type=custom").types).toEqual([]);
  });

  it("drops skills that don't exist when the known skills are given", () => {
    expect(parse("skill=roadmapping,gone", ["roadmapping"]).skills).toEqual(["roadmapping"]);
    expect(parse("skill=roadmapping,gone").skills).toEqual(["roadmapping", "gone"]);
  });

  it("de-duplicates and ignores empty list items", () => {
    expect(parse("type=book,,book, podcast").types).toEqual(["book", "podcast"]);
  });

  it("caps absurdly long input", () => {
    expect(parse(`q=${"x".repeat(1000)}`).query).toHaveLength(200);
    const many = Array.from({ length: 200 }, (_, i) => `s${i}`).join(",");
    expect(parse(`skill=${many}`).skills).toHaveLength(50);
  });

  it("accepts percent-encoded commas", () => {
    expect(parse("type=book%2Cpodcast").types).toEqual(["book", "podcast"]);
  });
});
