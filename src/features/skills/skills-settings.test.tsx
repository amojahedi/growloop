// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dismissToast, Toaster } from "@/components/ui/toast";
import type { Skill } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";
import { emptyWorkspace } from "@/lib/store/seed";
import { useUIStore } from "@/lib/store/ui-store";
import { makeItem, makeKeyResult, makeObjective } from "@/lib/testing/fixtures";
import { SkillsSettings } from "./skills-settings";

const skills = () => useAppStore.getState().data.skills;
const skill = (name: string) => skills().find((entry) => entry.name === name) as Skill;

function renderSettings() {
  return render(
    <>
      <SkillsSettings />
      <Toaster />
    </>,
  );
}

beforeEach(() => {
  useAppStore.setState({ data: emptyWorkspace() });
  useUIStore.setState({ skillSheet: null });
  dismissToast();
});

afterEach(cleanup);

describe("SkillsSettings", () => {
  it("lists every skill with built-in labels and the visible-count rule", () => {
    renderSettings();
    expect(screen.getByRole("heading", { name: "Skills" })).toBeInTheDocument();
    expect(screen.getByText("Keep 3 to 16 visible.")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(skills().length);
    expect(screen.getAllByText("Built-in")).toHaveLength(skills().length);
    // Built-ins can't be deleted.
    expect(screen.queryByRole("button", { name: /^Delete / })).not.toBeInTheDocument();
  });

  it("renames inline: Enter saves, Esc cancels, empty or duplicate names are rejected", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Rename Roadmapping" }));
    const input = screen.getByRole("textbox", { name: "Name of Roadmapping" });
    expect(input).toHaveFocus();

    fireEvent.change(input, { target: { value: " prioritization " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(screen.getByRole("alert")).toHaveTextContent("Pick a different name.");
    expect(input).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toHaveTextContent("Pick a different name.");

    fireEvent.change(input, { target: { value: "Roadmaps " } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(skills().find((entry) => entry.id === "roadmapping")?.name).toBe("Roadmaps");
    expect(screen.getByRole("button", { name: "Rename Roadmaps" })).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Rename Roadmaps" }));
    const again = screen.getByRole("textbox", { name: "Name of Roadmaps" });
    fireEvent.change(again, { target: { value: "Something else" } });
    fireEvent.keyDown(again, { key: "Escape" });
    expect(skill("Roadmaps")).toBeDefined();
    expect(screen.queryByRole("textbox", { name: /^Name of/ })).not.toBeInTheDocument();
  });

  it("recolors a skill from the swatch popover", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: /^Color for Roadmapping: / }));
    const swatches = screen.getByRole("radiogroup", { name: "Color for Roadmapping" });
    expect(within(swatches).getAllByRole("radio")).toHaveLength(16);

    fireEvent.click(within(swatches).getByRole("radio", { name: "Rose" }));
    expect(skills().find((entry) => entry.id === "roadmapping")?.color).toBe("rose");
    expect(screen.getByRole("button", { name: "Color for Roadmapping: Rose" })).toBeInTheDocument();
  });

  it("hides and shows skills, keeping at least 3 visible", () => {
    // Leave exactly 4 visible.
    act(() => skills().slice(4).forEach((entry) => useAppStore.getState().setSkillHidden(entry.id, true)));
    renderSettings();
    const [first, second] = skills();

    fireEvent.click(screen.getByRole("button", { name: `Hide ${first.name}` }));
    expect(skills()[0].hidden).toBe(true);
    expect(screen.getByText("Keep at least 3 visible so the radar works.")).toBeInTheDocument();

    const hide = screen.getByRole("button", { name: `Hide ${second.name}` });
    expect(hide).toHaveAttribute("aria-disabled", "true");
    expect(hide).toHaveAccessibleDescription("Keep at least 3 visible so the radar works.");
    fireEvent.click(hide);
    expect(skills()[1].hidden).toBeFalsy();

    fireEvent.click(screen.getByRole("button", { name: `Show ${first.name}` }));
    expect(skills()[0].hidden).toBe(false);
    expect(screen.queryByText("Keep at least 3 visible so the radar works.")).not.toBeInTheDocument();
  });

  it("adds a skill at the end with the first unused color, rejecting duplicates", () => {
    renderSettings();
    const input = screen.getByRole("textbox", { name: "New skill name" });
    const add = screen.getByRole("button", { name: "Add skill" });
    expect(add).toBeDisabled();

    fireEvent.change(input, { target: { value: "roadmapping" } });
    fireEvent.click(add);
    expect(screen.getByRole("alert")).toHaveTextContent("Pick a different name.");

    const used = new Set(skills().map((entry) => entry.color));
    fireEvent.change(input, { target: { value: "  Negotiation " } });
    fireEvent.click(add);
    const added = skills().at(-1) as Skill;
    expect(added).toMatchObject({ name: "Negotiation", icon: "sparkles", builtIn: false });
    expect(added.hidden).toBeFalsy();
    expect(used.has(added.color)).toBe(false);
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.getByText("Added Negotiation.")).toBeInTheDocument();
  });

  it("stops adding at 16 visible skills", () => {
    act(() => {
      for (let index = skills().length; index < 16; index += 1) useAppStore.getState().addSkill({ name: `Skill ${index}` });
    });
    renderSettings();
    fireEvent.change(screen.getByRole("textbox", { name: "New skill name" }), { target: { value: "One more" } });
    expect(screen.getByRole("button", { name: "Add skill" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "New skill name" })).toHaveAccessibleDescription("Keep 3 to 16 visible.");
  });

  it("deletes an own skill with an undo toast that puts it back on its cards", () => {
    let id = "";
    act(() => {
      id = useAppStore.getState().addSkill({ name: "Negotiation" });
      useAppStore.setState((state) => ({
        data: {
          ...state.data,
          planItems: [makeItem({ skillIds: ["roadmapping", id] }), makeItem({ skillIds: [id] }), makeItem({ skillIds: ["x"] })],
        },
      }));
    });
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Delete Negotiation" }));
    expect(skills().some((entry) => entry.id === id)).toBe(false);
    expect(screen.getByText("Deleted Negotiation · removed from 2 cards")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(skills().at(-1)?.id).toBe(id);
    expect(useAppStore.getState().data.planItems[0].skillIds).toEqual(["roadmapping", id]);
  });

  it("won't delete a skill a key result uses", () => {
    let id = "";
    act(() => {
      id = useAppStore.getState().addSkill({ name: "Negotiation" });
      useAppStore.setState((state) => ({
        data: { ...state.data, objectives: [makeObjective({ keyResults: [makeKeyResult({ skillId: id })] })] },
      }));
    });
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Delete Negotiation" }));
    expect(skills().some((entry) => entry.id === id)).toBe(true);
    expect(screen.getByText("Used by a key result. Hide it, or change that key result first.")).toBeInTheDocument();
  });

  it("opens a skill's sheet from its row", () => {
    renderSettings();
    fireEvent.click(screen.getByRole("button", { name: "Open Roadmapping" }));
    expect(useUIStore.getState().skillSheet).toBe("roadmapping");
  });
});
