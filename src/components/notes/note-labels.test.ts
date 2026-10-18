import { describe, expect, it } from "vitest";
import { makeMaterial, makeNote } from "@/lib/testing/fixtures";
import { dueChipLabel, dueDayLabel, linkify, noteKindLabel, noteSource, reviewLabel } from "./note-labels";

describe("note labels", () => {
  it("names the kind: summaries, and notes for both card notes and free notes", () => {
    expect(noteKindLabel("summary")).toBe("Summary");
    expect(noteKindLabel("item_note")).toBe("Note");
    expect(noteKindLabel("free")).toBe("Note");
  });

  it("uses the material title for card notes and the note's own title for free notes", () => {
    const material = makeMaterial({ title: "Inspired" });
    const materials = new Map([[material.id, material]]);
    expect(noteSource(makeNote({ kind: "summary", materialId: material.id }), materials)).toBe("Inspired");
    expect(noteSource(makeNote({ kind: "item_note", materialId: "gone" }), materials)).toBe("Removed material");
    expect(noteSource(makeNote({ kind: "free", title: "Questions for my 1:1" }), materials)).toBe("Questions for my 1:1");
    expect(noteSource(makeNote({ kind: "free", title: "  " }), materials)).toBe("Untitled note");
  });

  it("formats due dates for the widget and the list", () => {
    expect(dueDayLabel("2026-10-18", "2026-10-18")).toBe("today");
    expect(dueDayLabel("2026-10-17", "2026-10-18")).toBe("yesterday");
    expect(dueDayLabel("2026-10-12", "2026-10-18")).toBe("Oct 12");
    expect(dueChipLabel("2026-10-18", "2026-10-18")).toBe("Due today");
    expect(dueChipLabel("2026-10-25", "2026-10-18")).toBe("Due Oct 25");
    expect(reviewLabel("2026-10-25")).toBe("Review Oct 25");
  });
});

describe("linkify", () => {
  it("turns http(s) and www addresses into links and keeps the rest as text", () => {
    expect(linkify("See https://svpg.com/inspired. Also www.lennysnewsletter.com, thanks")).toEqual([
      { kind: "text", text: "See " },
      { kind: "link", text: "https://svpg.com/inspired", href: "https://svpg.com/inspired" },
      { kind: "text", text: ". Also " },
      { kind: "link", text: "www.lennysnewsletter.com", href: "https://www.lennysnewsletter.com" },
      { kind: "text", text: ", thanks" },
    ]);
  });

  it("keeps a bracket that belongs to the address and leaves other schemes alone", () => {
    expect(linkify("(see https://en.wikipedia.org/wiki/Jobs_(film))")).toEqual([
      { kind: "text", text: "(see " },
      { kind: "link", text: "https://en.wikipedia.org/wiki/Jobs_(film)", href: "https://en.wikipedia.org/wiki/Jobs_(film)" },
      { kind: "text", text: ")" },
    ]);
    expect(linkify("javascript:alert(1) and mailto:me@example.com")).toEqual([
      { kind: "text", text: "javascript:alert(1) and mailto:me@example.com" },
    ]);
    expect(linkify("")).toEqual([]);
  });
});
