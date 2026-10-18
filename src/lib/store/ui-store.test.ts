// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { EMPTY_WIZARD_SESSION, rehydrateWizardSession, useUIStore } from "./ui-store";

const ui = () => useUIStore.getState();

beforeEach(() => {
  sessionStorage.clear();
  useUIStore.setState({ skillSheet: null, wizard: EMPTY_WIZARD_SESSION, selectedMonth: null });
});

describe("UI store", () => {
  it("opens and closes the skill sheet", () => {
    ui().openSkillSheet("roadmapping");
    expect(ui().skillSheet).toBe("roadmapping");
    ui().closeSkillSheet();
    expect(ui().skillSheet).toBeNull();
  });

  it("keeps the wizard's answers for the browser session, but not the viewed month", () => {
    ui().updateWizard({ step: "skills", role: "pm", goal: "promotion", skills: [{ skillId: "roadmapping", current: 2, target: 4 }] });
    ui().setSelectedMonth("2026-08");

    // A reload: memory starts empty, sessionStorage keeps what was written.
    const stored = sessionStorage.getItem("growloop:wizard")!;
    useUIStore.setState({ wizard: EMPTY_WIZARD_SESSION, selectedMonth: null });
    sessionStorage.setItem("growloop:wizard", stored);
    rehydrateWizardSession();

    expect(ui().wizard).toEqual({ step: "skills", role: "pm", goal: "promotion", skills: [{ skillId: "roadmapping", current: 2, target: 4 }] });
    expect(ui().selectedMonth).toBeNull();
    expect(sessionStorage.getItem("growloop:wizard")).not.toContain("2026-08");
  });

  it("starts over after a reset, and ignores unreadable sessions", () => {
    ui().updateWizard({ step: "review" });
    ui().resetWizard();
    expect(ui().wizard).toEqual(EMPTY_WIZARD_SESSION);

    sessionStorage.setItem("growloop:wizard", "{oops");
    rehydrateWizardSession();
    expect(ui().wizard).toEqual(EMPTY_WIZARD_SESSION);
  });
});
