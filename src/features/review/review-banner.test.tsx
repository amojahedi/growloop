// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Toaster, dismissToast } from "@/components/ui/toast";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { useAppStore } from "@/lib/store/app-store";
import { TodayContext } from "@/lib/store/hooks";
import { emptyWorkspace } from "@/lib/store/seed";
import { ReviewBanner } from "./review-banner";

const [first, second] = CURATED_MATERIALS;

function renderBanner(today = "2026-10-05") {
  render(
    <TodayContext value={today}>
      <ReviewBanner />
      <Toaster />
    </TodayContext>,
  );
}

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ data: emptyWorkspace() });
});

afterEach(() => {
  act(() => dismissToast());
  cleanup();
});

describe("ReviewBanner", () => {
  it("renders nothing when no review is pending", () => {
    renderBanner();
    expect(screen.queryByRole("button", { name: /Wrap up/ })).not.toBeInTheDocument();
  });

  it("offers to wrap up the last month and applies the defaults on Done", () => {
    const { addPlanItem, movePlanItem } = useAppStore.getState();
    const started = addPlanItem(first.id, "2026-09")!;
    movePlanItem(started, { status: "in_progress" });
    const planned = addPlanItem(second.id, "2026-09")!;

    renderBanner();
    expect(screen.getByText("September is done. Wrap it up in a minute.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Wrap up September" }));

    expect(screen.getByRole("dialog", { name: "Wrap up September" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: `What to do with "${first.title}"` })).toHaveValue("carry_over");
    expect(screen.getByRole("combobox", { name: `What to do with "${second.title}"` })).toHaveValue("backlog");

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    const items = useAppStore.getState().data.planItems;
    expect(items.find((item) => item.id === started)).toMatchObject({ month: "2026-10", status: "in_progress" });
    expect(items.find((item) => item.id === planned)).toMatchObject({ status: "backlog" });
    expect(screen.getByText("September is wrapped up.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Wrap up September" })).not.toBeInTheDocument();
  });

  it("closes ended quarters, offering the one move", () => {
    useAppStore.getState().addObjective({
      quarter: "2026-Q3",
      title: "Make discovery a habit",
      keyResults: [{ title: "Complete 2", skillId: "product-discovery", type: "count", count: 2 }],
    });

    renderBanner();
    fireEvent.click(screen.getByRole("button", { name: "Wrap up September" }));
    fireEvent.click(screen.getByRole("radio", { name: "Move to Q4" }));
    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(useAppStore.getState().data.objectives[0]).toMatchObject({ quarter: "2026-Q4", movedFrom: "2026-Q3", status: "active" });
  });
});
