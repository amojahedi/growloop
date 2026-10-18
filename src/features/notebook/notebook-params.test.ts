import { describe, expect, it } from "vitest";
import { makeNote } from "@/lib/testing/fixtures";
import { filterNotes } from "./notebook-list";
import {
  clearNotebookFilters,
  DEFAULT_NOTEBOOK_PARAMS,
  hasActiveFilters,
  parseNotebookParams,
  serializeNotebookParams,
} from "./notebook-params";

describe("notebook URL params", () => {
  it("round-trips search, source, skills, Due and the selected note", () => {
    const state = { query: "outcomes", show: "summaries" as const, skills: ["roadmapping", "discovery"], due: true, note: "n1" };
    const query = serializeNotebookParams(state);
    expect(query).toBe("q=outcomes&show=summaries&skill=roadmapping,discovery&due=1&note=n1");
    expect(parseNotebookParams(new URLSearchParams(query))).toEqual(state);
  });

  it("drops defaults and unknown values", () => {
    expect(serializeNotebookParams(DEFAULT_NOTEBOOK_PARAMS)).toBe("");
    expect(parseNotebookParams(new URLSearchParams("show=nope&due=yes&skill=a,,gone"), new Set(["a"]))).toEqual({
      ...DEFAULT_NOTEBOOK_PARAMS,
      skills: ["a"],
    });
  });

  it("knows when filters are active and clears them, keeping the note", () => {
    expect(hasActiveFilters(DEFAULT_NOTEBOOK_PARAMS)).toBe(false);
    expect(hasActiveFilters({ ...DEFAULT_NOTEBOOK_PARAMS, due: true })).toBe(true);
    expect(clearNotebookFilters({ query: "x", show: "notes", skills: ["a"], due: true, note: "n1" })).toEqual({
      ...DEFAULT_NOTEBOOK_PARAMS,
      note: "n1",
    });
  });
});

describe("filterNotes", () => {
  const today = "2026-10-18";
  const summary = makeNote({
    kind: "summary",
    materialId: "m-inspired",
    planItemId: "i1",
    body: "Good teams are handed problems",
    skillIds: ["discovery"],
    updatedAt: "2026-10-15T10:00:00.000Z",
    reviewAt: "2026-10-12",
  });
  const cardNote = makeNote({
    kind: "item_note",
    materialId: "m-trap",
    planItemId: "i2",
    body: "Outcomes over output",
    skillIds: ["roadmapping"],
    updatedAt: "2026-10-16T10:00:00.000Z",
    reviewAt: "2026-10-18",
  });
  const free = makeNote({ kind: "free", title: "Questions for my 1:1", body: "Ask about the Résumé", updatedAt: "2026-10-17T10:00:00.000Z" });
  const empty = makeNote({ kind: "free", title: "", body: "" });
  const cleared = makeNote({ kind: "summary", planItemId: "i3", body: "" });
  const notes = [summary, cardNote, free, empty, cleared];
  const titles: Record<string, string> = { "m-inspired": "Inspired", "m-trap": "Escaping the Build Trap" };
  const run = (filters: Partial<typeof DEFAULT_NOTEBOOK_PARAMS>, include?: string) =>
    filterNotes(notes, { ...DEFAULT_NOTEBOOK_PARAMS, ...filters }, {
      today,
      include,
      materialTitle: (note) => titles[note.materialId ?? ""],
    }).map((note) => note.id);

  it("lists written notes, newest updated first", () => {
    expect(run({})).toEqual([free.id, cardNote.id, summary.id]);
  });

  it("filters by source: summaries, or card and free notes", () => {
    expect(run({ show: "summaries" })).toEqual([summary.id]);
    expect(run({ show: "notes" })).toEqual([free.id, cardNote.id]);
  });

  it("searches titles, material titles and bodies, ignoring case and accents", () => {
    expect(run({ query: "resume" })).toEqual([free.id]);
    expect(run({ query: "build trap" })).toEqual([cardNote.id]);
    expect(run({ query: "TEAMS problems" })).toEqual([summary.id]);
  });

  it("combines skills and Due, listing due notes oldest first", () => {
    expect(run({ skills: ["roadmapping", "discovery"] })).toEqual([cardNote.id, summary.id]);
    expect(run({ due: true })).toEqual([summary.id, cardNote.id]);
    expect(run({ due: true, show: "summaries" })).toEqual([summary.id]);
    expect(run({ due: true, skills: ["roadmapping"], query: "outcomes" })).toEqual([cardNote.id]);
  });

  it("keeps a just-created empty free note at the top while it is open", () => {
    expect(run({}, empty.id)).toEqual([empty.id, free.id, cardNote.id, summary.id]);
    expect(run({}, cleared.id)).toEqual([free.id, cardNote.id, summary.id]);
  });
});
