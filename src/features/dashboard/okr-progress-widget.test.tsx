// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { at, makeItem, makeKeyResult, makeObjective } from "@/lib/testing/fixtures";
import { useAppStore } from "@/lib/store/app-store";
import { TodayContext } from "@/lib/store/hooks";
import { emptyWorkspace } from "@/lib/store/seed";
import { useUIStore } from "@/lib/store/ui-store";
import { OkrProgressWidget } from "./okr-progress-widget";

function renderWidget() {
  render(
    <TodayContext value="2026-10-18">
      <OkrProgressWidget />
    </TodayContext>,
  );
}

beforeEach(() => {
  useAppStore.setState({ data: emptyWorkspace() });
  useUIStore.setState({ selectedMonth: null });
});
afterEach(cleanup);

describe("OkrProgressWidget", () => {
  it("shows the Set your year prompt until an active objective exists", () => {
    useAppStore.setState({ data: { ...emptyWorkspace(), objectives: [makeObjective({ quarter: "2025-Q4", status: "closed" })] } });
    renderWidget();
    expect(screen.getByText("Set your year")).toBeInTheDocument();
    expect(screen.getByText("Two questions, then a draft plan you can edit.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plan my year" })).toHaveAttribute("href", "/okrs/plan");
  });

  it("shows the viewed quarter's objectives with typed key results", () => {
    const objective = makeObjective({
      quarter: "2026-Q4",
      title: "Lead roadmap talks",
      keyResults: [
        makeKeyResult({ id: "count", title: "Complete 3 Roadmapping items", skillId: "roadmapping", count: 3 }),
        makeKeyResult({ id: "book", title: "Finish Inspired", type: "material", materialId: "book-inspired", skillId: "roadmapping" }),
      ],
    });
    const done = makeItem({ skillIds: ["roadmapping"], status: "done", completedAt: at("2026-10-05") });
    useAppStore.setState({ data: { ...emptyWorkspace(), objectives: [objective], planItems: [done] } });
    renderWidget();
    expect(screen.getByRole("heading", { name: "Lead roadmap talks" })).toBeInTheDocument();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
    expect(screen.getByText("Not on your board yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open OKRs/ })).toHaveAttribute("href", "/okrs?year=2026");
  });

  it("says when nothing is set for the viewed quarter", () => {
    useAppStore.setState({ data: { ...emptyWorkspace(), objectives: [makeObjective({ quarter: "2027-Q1", keyResults: [makeKeyResult()] })] } });
    renderWidget();
    expect(screen.getByText(/Nothing set for Q4 2026\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plan it" })).toHaveAttribute("href", "/okrs/plan");
  });
});
