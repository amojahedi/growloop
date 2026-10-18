import { describe, expect, it } from "vitest";
import { BUILT_IN_SKILLS, objectivePhrasesFor, storedSkill } from "./skills";

describe("built-in skills", () => {
  it("each have two objective phrases for the quick draft (okrs-and-wizard.md phrase table)", () => {
    expect(BUILT_IN_SKILLS).toHaveLength(12);
    for (const skill of BUILT_IN_SKILLS) {
      expect(skill.objectivePhrases).toHaveLength(2);
      for (const phrase of skill.objectivePhrases) {
        expect(phrase.length).toBeGreaterThan(0);
        expect(phrase.length).toBeLessThanOrEqual(70);
      }
    }
    expect(objectivePhrasesFor("roadmapping")).toEqual(["Lead roadmap conversations with confidence", "Run an outcome-based roadmap"]);
    expect(objectivePhrasesFor("my-own-skill")).toBeUndefined();
  });

  it("store only the skill itself, never the static phrases", () => {
    const stored = storedSkill(BUILT_IN_SKILLS[0]);
    expect(stored).not.toHaveProperty("objectivePhrases");
    expect(stored).toMatchObject({ id: "stakeholder-management", builtIn: true });
  });
});
