import { describe, expect, it } from "vitest";
import { makeItem, makeNote } from "@/lib/testing/fixtures";
import {
  createCardNote,
  createFreeNote,
  dueNotes,
  findCardNote,
  hasContent,
  isDue,
  isSummarized,
  latestNotes,
  noteMatches,
  reviewDay,
  summarizedItemIds,
} from "./notes";

const NOW = "2026-10-18T10:00:00.000Z";

describe("hasContent", () => {
  it("shows notes with text; free notes also with only a title", () => {
    expect(hasContent(makeNote({ body: "Text" }))).toBe(true);
    expect(hasContent(makeNote({ kind: "summary", body: "  \n " }))).toBe(false);
    expect(hasContent(makeNote({ kind: "free", body: "", title: "Questions for my 1:1" }))).toBe(true);
    expect(hasContent(makeNote({ kind: "free", body: "", title: "  " }))).toBe(false);
  });
});

describe("latestNotes", () => {
  it("lists written notes of every kind, newest first", () => {
    const notes = [
      makeNote({ id: "old", updatedAt: "2026-10-01T00:00:00.000Z" }),
      makeNote({ id: "new", kind: "item_note", updatedAt: "2026-10-12T00:00:00.000Z" }),
      makeNote({ id: "empty", kind: "summary", body: " ", updatedAt: "2026-10-13T00:00:00.000Z" }),
      makeNote({ id: "mid", kind: "summary", updatedAt: "2026-10-05T00:00:00.000Z" }),
    ];
    expect(latestNotes(notes).map((note) => note.id)).toEqual(["new", "mid", "old"]);
    expect(latestNotes(notes, 1)).toHaveLength(1);
  });
});

describe("due notes (N-3)", () => {
  const notes = [
    makeNote({ id: "later", reviewAt: "2026-10-25" }),
    makeNote({ id: "today", reviewAt: "2026-10-18" }),
    makeNote({ id: "overdue", reviewAt: "2026-10-02" }),
    makeNote({ id: "none" }),
    makeNote({ id: "cleared", kind: "summary", body: "", reviewAt: "2026-10-01" }),
  ];

  it("is due when the review day has come, oldest due first", () => {
    expect(dueNotes(notes, "2026-10-18").map((note) => note.id)).toEqual(["overdue", "today"]);
    expect(isDue(notes[0], "2026-10-25")).toBe(true);
    expect(isDue(notes[0], "2026-10-24")).toBe(false);
  });

  it("never counts a note whose text was cleared", () => {
    expect(isDue(notes[4], "2026-10-18")).toBe(false);
  });

  it("schedules Tomorrow, In a week and In a month", () => {
    expect(reviewDay("tomorrow", "2026-10-31")).toBe("2026-11-01");
    expect(reviewDay("week", "2026-12-28")).toBe("2027-01-04");
    expect(reviewDay("month", "2026-10-18")).toBe("2026-11-18");
    // Same day next month, clamped to its last day.
    expect(reviewDay("month", "2027-01-31")).toBe("2027-02-28");
    expect(reviewDay("month", "2026-12-15")).toBe("2027-01-15");
  });
});

describe("noteMatches", () => {
  const note = makeNote({ title: "Résumé tips", body: "Lead with the outcome.\nThen the story." });

  it("searches title, material title and body, ignoring case and accents", () => {
    expect(noteMatches(note, "resume")).toBe(true);
    expect(noteMatches(note, "OUTCOME")).toBe(true);
    expect(noteMatches(note, "inspired", "Inspired")).toBe(true);
    expect(noteMatches(note, "roadmap")).toBe(false);
  });

  it("needs every word to match somewhere, and an empty query matches all", () => {
    expect(noteMatches(note, "story résumé")).toBe(true);
    expect(noteMatches(note, "story roadmap")).toBe(false);
    expect(noteMatches(note, "   ")).toBe(true);
  });
});

describe("card notes", () => {
  const item = makeItem({ id: "card", materialId: "book", skillIds: ["roadmapping", "communication"] });

  it("creates a card note on the card's material and skills", () => {
    expect(createCardNote(item, "summary", "One idea", NOW)).toMatchObject({
      kind: "summary",
      planItemId: "card",
      materialId: "book",
      body: "One idea",
      skillIds: ["roadmapping", "communication"],
      createdAt: NOW,
      updatedAt: NOW,
    });
  });

  it("finds a card's summary or notes and knows which cards are summarized", () => {
    const notes = [
      makeNote({ id: "s", kind: "summary", planItemId: "card", body: "Idea" }),
      makeNote({ id: "n", kind: "item_note", planItemId: "card" }),
      makeNote({ id: "empty", kind: "summary", planItemId: "other", body: "" }),
    ];
    expect(findCardNote(notes, "card", "summary")?.id).toBe("s");
    expect(findCardNote(notes, "card", "item_note")?.id).toBe("n");
    expect(isSummarized("card", notes)).toBe(true);
    expect(isSummarized("other", notes)).toBe(false);
    expect([...summarizedItemIds(notes)]).toEqual(["card"]);
  });

  it("creates free notes with at most three skills", () => {
    const note = createFreeNote({ title: "Roadmap review prep", skillIds: ["a", "b", "c", "d"] }, NOW);
    expect(note).toMatchObject({ kind: "free", title: "Roadmap review prep", body: "", skillIds: ["a", "b", "c"] });
    expect(createFreeNote({}, NOW)).not.toHaveProperty("title");
  });
});
