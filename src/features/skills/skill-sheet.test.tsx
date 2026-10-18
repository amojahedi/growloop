// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { useAppStore } from "@/lib/store/app-store";
import { emptyWorkspace } from "@/lib/store/seed";
import { useUIStore } from "@/lib/store/ui-store";
import { CardDetailDrawer } from "../card/card-detail-drawer";
import { SkillSheet } from "./skill-sheet";

beforeEach(() => {
  useAppStore.setState({ data: emptyWorkspace() });
  useUIStore.setState({ skillSheet: null });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SkillSheet (stub)", () => {
  it("opens from anywhere with openSkillSheet and links to the skill's resources", () => {
    render(<SkillSheet />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    act(() => useUIStore.getState().openSkillSheet("roadmapping"));
    expect(screen.getByRole("dialog", { name: "Roadmapping" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Browse resources" })).toHaveAttribute("href", "/library?skill=roadmapping");

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(useUIStore.getState().skillSheet).toBeNull();
  });

  it("stays closed for an unknown skill, with a console warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(<SkillSheet />);
    act(() => useUIStore.getState().openSkillSheet("nope"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(warn).toHaveBeenCalled();
    expect(useUIStore.getState().skillSheet).toBeNull();
  });
});

describe("CardDetailDrawer (stub)", () => {
  it("shows the card and closes through onClose", () => {
    const material = CURATED_MATERIALS[0];
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
