import { describe, expect, it } from "vitest";
import { materialDraftSchema } from "@/lib/ai/schemas";
import { makeMaterial } from "@/lib/testing/fixtures";
import { asUrl, findExisting, firstLine, guessTypeFromUrl, initialForm, toNewMaterial, validateForm } from "./own-material";

const draft = (overrides: Record<string, unknown> = {}) =>
  materialDraftSchema.parse({ type: "custom", title: "", author: "", tagline: "", summary: "", skillIds: [], ...overrides });

describe("reading the paste", () => {
  it("uses only the first non-empty line", () => {
    expect(firstLine("\n  Shape Up  \nInspired")).toBe("Shape Up");
    expect(firstLine("   ")).toBe("");
  });

  it("recognises http(s) links, including bare www. ones", () => {
    expect(asUrl("https://basecamp.com/shapeup")).toBe("https://basecamp.com/shapeup");
    expect(asUrl("www.example.com/a")).toBe("https://www.example.com/a");
    expect(asUrl("Shape Up")).toBeUndefined();
    expect(asUrl("ftp://example.com")).toBeUndefined();
    expect(asUrl(["javascript", "alert(1)"].join(":"))).toBeUndefined();
  });

  it("guesses a type from well-known domains", () => {
    expect(guessTypeFromUrl("https://www.coursera.org/learn/x")).toBe("course");
    expect(guessTypeFromUrl("https://podcasts.apple.com/us/podcast/x")).toBe("podcast");
    expect(guessTypeFromUrl("https://lenny.substack.com/p/x")).toBe("article");
    expect(guessTypeFromUrl("https://www.amazon.co.uk/dp/x")).toBe("book");
    expect(guessTypeFromUrl("https://example.com")).toBe("custom");
  });
});

describe("initialForm", () => {
  it("without Claude: a link fills the URL field, text fills the title", () => {
    expect(initialForm("https://www.coursera.org/learn/x").form).toMatchObject({
      url: "https://www.coursera.org/learn/x",
      title: "",
      type: "course",
    });
    const { form, filled } = initialForm("Shape Up\nsecond line");
    expect(form).toMatchObject({ title: "Shape Up", url: "", type: "custom" });
    expect(filled.size).toBe(0);
  });

  it("with a draft: fills and marks what Claude knew, leaves the rest", () => {
    const { form, filled } = initialForm(
      "shape up",
      draft({ type: "book", title: "Shape Up", author: "Ryan Singer", skillIds: ["roadmapping"], estimatedHours: 4, level: "intermediate" }),
    );
    expect(form).toMatchObject({
      title: "Shape Up",
      type: "book",
      author: "Ryan Singer",
      skillIds: ["roadmapping"],
      hours: "4",
      level: "intermediate",
      cost: "free",
      summary: "",
    });
    expect([...filled].sort()).toEqual(["author", "hours", "level", "skillIds", "title", "type"]);
  });

  it("keeps the pasted title when Claude didn't recognise the resource", () => {
    expect(initialForm("My team's wiki page", draft()).form.title).toBe("My team's wiki page");
  });

  it("never lets a suggested URL replace a pasted link", () => {
    const { form, filled } = initialForm("https://example.com/real", draft({ url: "https://example.com/other" }));
    expect(form.url).toBe("https://example.com/real");
    expect(filled.has("url")).toBe(false);
  });
});

describe("validateForm / toNewMaterial", () => {
  const valid = { ...initialForm("Shape Up").form, skillIds: ["roadmapping"] };

  it("requires a title and a skill, and checks the link and hours", () => {
    expect(validateForm(valid)).toEqual({});
    expect(validateForm({ ...valid, title: " ", skillIds: [], url: "not a link", hours: "-1" })).toEqual({
      title: expect.any(String),
      skillIds: expect.any(String),
      url: expect.any(String),
      hours: expect.any(String),
    });
  });

  it("builds a trimmed material, omitting empty optional fields", () => {
    expect(toNewMaterial({ ...valid, title: " Shape Up ", author: " Ryan Singer ", hours: "4.5" })).toEqual({
      title: "Shape Up",
      type: "custom",
      skillIds: ["roadmapping"],
      author: "Ryan Singer",
      tagline: "",
      summary: "",
      level: "beginner",
      cost: "free",
      estimatedHours: 4.5,
    });
    expect(toNewMaterial({ ...valid, url: "www.example.com" })).toMatchObject({ url: "https://www.example.com/" });
  });
});

describe("findExisting", () => {
  const materials = [
    makeMaterial({ id: "a", title: "Shape Up", url: "https://basecamp.com/shapeup" }),
    makeMaterial({ id: "b", title: "Inspired" }),
  ];

  it("matches by link (ignoring a trailing slash) or by title (ignoring case)", () => {
    expect(findExisting("https://basecamp.com/shapeup/", materials)?.id).toBe("a");
    expect(findExisting("  inspired ", materials)?.id).toBe("b");
    expect(findExisting("Something new", materials)).toBeUndefined();
    expect(findExisting("", materials)).toBeUndefined();
  });
});
