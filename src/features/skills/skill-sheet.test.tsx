// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkillChip } from "@/components/skills/skill-chip";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { useAppStore } from "@/lib/store/app-store";
import { emptyWorkspace } from "@/lib/store/seed";
import { useUIStore } from "@/lib/store/ui-store";
import { makeItem, makeKeyResult, makeNote, makeObjective } from "@/lib/testing/fixtures";
import { CardDetailDrawer } from "../card/card-detail-drawer";
import { SkillSheet } from "./skill-sheet";

// The sheet gates its sections on loaded data and today's date; pin both here.
vi.mock("@/components/app/data-gate", async () => {
  const { TodayContext } = await import("@/lib/store/hooks");
  return {
    DataGate: ({ children }: { children: React.ReactNode }) => <TodayContext value="2026-10-18">{children}</TodayContext>,
  };
});

const material = CURATED_MATERIALS[0];

beforeEach(() => {
  useAppStore.setState({ data: emptyWorkspace() });
  useUIStore.setState({ skillSheet: null });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const open = (skillId: string) => act(() => useUIStore.getState().openSkillSheet(skillId));
const section = (name: string) => screen.getByRole("region", { name });

describe("SkillSheet", () => {
  it("opens from anywhere with openSkillSheet, links to the skill's resources and closes with Esc", () => {
    render(<SkillSheet />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    open("roadmapping");
    const dialog = screen.getByRole("dialog", { name: "Roadmapping" });
    expect(dialog).toHaveTextContent(/sequenced|roadmap/i);
    expect(screen.getByRole("link", { name: "Browse resources" })).toHaveAttribute("href", "/library?skill=roadmapping");

    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(useUIStore.getState().skillSheet).toBeNull();
  });

  it("opens from a skill chip and returns focus to it on close", async () => {
    const onRowClick = vi.fn();
    render(
      <>
        <div onClick={onRowClick}>
          <SkillChip skillId="roadmapping" />
        </div>
        <SkillSheet />
      </>,
    );
    const chip = screen.getByRole("button", { name: "Roadmapping" });
    chip.focus();
    fireEvent.click(chip);

    expect(screen.getByRole("dialog", { name: "Roadmapping" })).toBeInTheDocument();
    // The chip opens only the sheet, not the card or row it sits in.
    expect(onRowClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await waitFor(() => expect(chip).toHaveFocus());
  });

  it("stays closed for an unknown skill, with a console warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<SkillSheet />);
    open("nope");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    expect(useUIStore.getState().skillSheet).toBeNull();
  });

  it("shows only the level and empty board copy for a skill with no data", () => {
    render(<SkillSheet />);
    open("roadmapping");

    expect(section("Your level")).toHaveTextContent("Not set yet");
    expect(section("On your board")).toHaveTextContent("Nothing planned for Roadmapping yet.");
    expect(screen.queryByRole("region", { name: "This year" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Notes" })).not.toBeInTheDocument();
  });

  it("sets and edits levels inline, saved to the profile the wizard reads", () => {
    render(<SkillSheet />);
    open("roadmapping");

    fireEvent.click(screen.getByRole("button", { name: "Set level" }));
    const now = screen.getByRole("group", { name: "Now" });
    const goal = screen.getByRole("group", { name: "Goal" });
    // The wizard's defaults, not saved until something changes.
    expect(within(now).getByRole("radio", { name: "2 Learning" })).toBeChecked();
    expect(within(goal).getByRole("radio", { name: "4 Strong" })).toBeChecked();
    expect(within(now).getByRole("radio", { name: "2 Learning" })).toHaveFocus();
    expect(useAppStore.getState().data.profile.skillLevels).toEqual([]);

    fireEvent.click(within(goal).getByRole("radio", { name: "5 Expert" }));
    expect(useAppStore.getState().data.profile.skillLevels).toMatchObject([{ skillId: "roadmapping", current: 2, target: 5 }]);

    fireEvent.click(within(now).getByRole("radio", { name: "5 Expert" }));
    expect(useAppStore.getState().data.profile.skillLevels).toMatchObject([{ skillId: "roadmapping", current: 5, target: 5 }]);

    fireEvent.click(within(now).getByRole("radio", { name: "3 Capable" }));
    fireEvent.click(within(goal).getByRole("radio", { name: "3 Capable" }));
    expect(screen.getByText("Set a goal above where you are.")).toBeInTheDocument();
    fireEvent.click(within(goal).getByRole("radio", { name: "4 Strong" }));
    expect(screen.queryByText("Set a goal above where you are.")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.getByRole("img", { name: "Now: Capable, 3 of 5" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Goal: Strong, 4 of 5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit your level in Roadmapping" })).toHaveFocus();
  });

  it("shows this year's objectives, board cards, finished count and notes, each linking onward", () => {
    const keyResult = makeKeyResult({ skillId: "roadmapping", type: "count", count: 2 });
    const current = makeObjective({ title: "Lead roadmap conversations", quarter: "2026-Q4", keyResults: [keyResult] });
    const next = makeObjective({ title: "Run an outcome-based roadmap", quarter: "2027-Q3", keyResults: [makeKeyResult({ skillId: "roadmapping" })] });
    const inProgress = makeItem({ materialId: material.id, status: "in_progress", skillIds: ["roadmapping"] });
    const done = makeItem({
      materialId: material.id,
      status: "done",
      skillIds: ["roadmapping"],
      completedAt: "2026-10-03T10:00:00.000Z",
    });
    useAppStore.setState({
      data: {
        ...emptyWorkspace(),
        objectives: [next, current],
        planItems: [done, inProgress],
        notes: [makeNote({ skillIds: ["roadmapping"] }), makeNote({ skillIds: ["roadmapping"] })],
      },
    });
    render(<SkillSheet />);
    open("roadmapping");

    const thisYear = within(section("This year")).getAllByRole("link");
    expect(thisYear.map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Lead roadmap conversations50%", "/okrs?year=2026"],
      ["Run an outcome-based roadmapQ3 2027", "/okrs?year=2027"],
    ]);

    const board = section("On your board");
    const cards = within(board).getAllByRole("link");
    expect(cards.map((link) => link.getAttribute("href"))).toEqual([`/board?item=${inProgress.id}`, `/board?item=${done.id}`]);
    expect(cards[0]).toHaveTextContent(`${material.title}In progress`);
    expect(board).toHaveTextContent("Finished this year: 1");

    const notes = within(section("Notes")).getByRole("link", { name: "2 notes" });
    expect(notes).toHaveAttribute("href", "/notebook?skill=roadmapping");

    // Following a link closes the sheet.
    fireEvent.click(notes);
    expect(useUIStore.getState().skillSheet).toBeNull();
  });

  it("marks a hidden skill and can show it again", () => {
    act(() => useAppStore.getState().setSkillHidden("roadmapping", true));
    render(<SkillSheet />);
    open("roadmapping");

    expect(screen.getByText("Hidden")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(useAppStore.getState().data.skills.find((skill) => skill.id === "roadmapping")?.hidden).toBe(false);
    expect(screen.queryByText("Hidden")).not.toBeInTheDocument();
  });
});

describe("SkillChip", () => {
  it("renders nothing for an unknown skill and marks hidden ones", () => {
    act(() => useAppStore.getState().setSkillHidden("roadmapping", true));
    const { container } = render(<SkillChip skillId="nope" />);
    expect(container).toBeEmptyDOMElement();

    render(<SkillChip skillId="roadmapping" />);
    expect(screen.getByRole("button", { name: /^Roadmapping\s*\(hidden\)$/ })).toBeInTheDocument();
  });
});

describe("CardDetailDrawer (stub)", () => {
  it("shows the card and closes through onClose", () => {
    const itemId = useAppStore.getState().addPlanItem(material.id, "2026-10")!;
    const onClose = vi.fn();
    render(<CardDetailDrawer itemId={itemId} onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: material.title })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("stays closed without a card or for an unknown id", () => {
    const { rerender } = render(<CardDetailDrawer itemId={null} onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    rerender(<CardDetailDrawer itemId="gone" onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
