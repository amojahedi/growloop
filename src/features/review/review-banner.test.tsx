// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster, dismissToast } from "@/components/ui/toast";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { useAppStore } from "@/lib/store/app-store";
import { TodayContext } from "@/lib/store/hooks";
import { emptyWorkspace } from "@/lib/store/seed";
import { ReviewBanner } from "./review-banner";

const [first, second, third] = CURATED_MATERIALS;
const state = () => useAppStore.getState();
const item = (id: string) => state().data.planItems.find((candidate) => candidate.id === id);
const toastText = () => document.querySelector("[data-toaster]")?.textContent ?? "";

/** Sets the clock the store stamps changes with. */
const at = (year: number, month: number, day: number) => vi.setSystemTime(new Date(year, month - 1, day, 12));

function ui(today: string) {
  return (
    <TodayContext value={today}>
      <main id="content" tabIndex={-1}>
        <ReviewBanner />
      </main>
      <Toaster />
    </TodayContext>
  );
}

const renderBanner = (today = "2026-10-05") => render(ui(today));
const openReview = (name = "Wrap up September") => {
  fireEvent.click(screen.getByRole("button", { name }));
  return screen.getByRole("dialog", { name });
};
const decision = (title: string) => screen.getByRole("radiogroup", { name: `What to do with ${title}` });
const checked = (group: HTMLElement) => within(group).getAllByRole("radio").find((radio) => (radio as HTMLInputElement).checked);

beforeEach(() => {
  localStorage.clear();
  useAppStore.setState({ data: emptyWorkspace() });
  vi.useFakeTimers({ toFake: ["Date"] });
  at(2026, 10, 5);
});

afterEach(() => {
  act(() => dismissToast());
  cleanup();
  vi.useRealTimers();
});

describe("ReviewBanner", () => {
  it("renders nothing when no review is pending", () => {
    renderBanner();
    expect(screen.queryByRole("button", { name: /Wrap up/ })).not.toBeInTheDocument();
  });

  it("is quiet when every item was finished and no quarter ended", () => {
    const done = state().addPlanItem(first.id, "2026-09")!;
    state().movePlanItem(done, { status: "done" });
    state().addPlanItem(second.id, "2026-09", { status: "backlog" });
    renderBanner();
    expect(screen.queryByRole("button", { name: /Wrap up/ })).not.toBeInTheDocument();
  });

  it("offers to wrap up the last month and applies the defaults on Done", () => {
    const started = state().addPlanItem(first.id, "2026-09")!;
    state().movePlanItem(started, { status: "in_progress" });
    const planned = state().addPlanItem(second.id, "2026-09")!;

    renderBanner();
    expect(screen.getByText("September is done. Wrap it up in a minute.")).toBeInTheDocument();
    const dialog = openReview();

    expect(within(dialog).getByText("A quiet month. That happens.")).toBeInTheDocument();
    expect(checked(decision(first.title))).toHaveAccessibleName("Carry over");
    expect(checked(decision(second.title))).toHaveAccessibleName("Backlog");
    expect(within(dialog).getByText("Dropped items leave the board. Their notes stay in your Notebook.")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));

    expect(item(started)).toMatchObject({ month: "2026-10", status: "in_progress", carriedFrom: ["2026-09"] });
    expect(item(planned)).toMatchObject({ status: "backlog", carriedFrom: ["2026-09"] });
    expect(toastText()).toContain("September is wrapped up.");
    expect(screen.queryByRole("button", { name: "Wrap up September" })).not.toBeInTheDocument();
  });

  it("sends anything carried twice to Backlog by default and marks it", () => {
    const old = state().addPlanItem(first.id, "2026-09")!;
    state().movePlanItem(old, { status: "in_progress" });
    useAppStore.setState((s) => ({
      data: { ...s.data, planItems: s.data.planItems.map((p) => (p.id === old ? { ...p, carriedFrom: ["2026-07", "2026-08"] } : p)) },
    }));
    renderBanner();
    const dialog = openReview();
    expect(within(dialog).getByText("Carried twice")).toBeInTheDocument();
    expect(checked(decision(first.title))).toHaveAccessibleName("Backlog");
  });

  it("drops a card but keeps its notes", () => {
    const dropped = state().addPlanItem(first.id, "2026-09")!;
    state().setCardNote(dropped, "item_note", "A quote worth keeping.");
    renderBanner();
    const dialog = openReview();
    fireEvent.click(within(decision(first.title)).getByRole("radio", { name: "Drop" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));

    expect(item(dropped)).toBeUndefined();
    expect(state().data.notes.find((note) => note.planItemId === dropped)?.body).toBe("A quote worth keeping.");
  });

  it("combines several missed months into one review", () => {
    state().addPlanItem(first.id, "2026-08");
    state().addPlanItem(second.id, "2026-09");
    renderBanner();
    expect(screen.getByText("August and September are done. Wrap it up in a minute.")).toBeInTheDocument();
    const dialog = openReview("Wrap up August and September");
    expect(within(dialog).getAllByRole("radiogroup")).toHaveLength(2);
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(toastText()).toContain("August and September are wrapped up.");
  });

  it("recaps finished and summarized items and the skill that grew most", () => {
    at(2026, 9, 10);
    const finished = state().addPlanItem(first.id, "2026-09")!;
    state().movePlanItem(finished, { status: "done" });
    state().setCardNote(finished, "summary", "My two lines.");
    state().addPlanItem(second.id, "2026-09");
    at(2026, 10, 5);
    const skill = state().data.skills.find((candidate) => candidate.id === item(finished)!.skillIds[0])!;

    renderBanner();
    const dialog = openReview();
    expect(dialog).toHaveAccessibleDescription(`1 finished · 1 summarized · ${skill.name} grew most`);
  });

  it("Later closes the dialog and keeps the banner", () => {
    state().addPlanItem(first.id, "2026-09");
    renderBanner();
    const dialog = openReview();
    fireEvent.click(within(dialog).getByRole("button", { name: "Later" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: "Wrap up September" })).toBeInTheDocument();
    expect(item(state().data.planItems[0].id)).toMatchObject({ month: "2026-09", status: "todo" });
  });

  it("applies what it showed when the day changes while it is open", () => {
    const september = state().addPlanItem(first.id, "2026-09")!;
    const october = state().addPlanItem(second.id, "2026-10")!;
    const { rerender } = renderBanner("2026-10-31");
    const dialog = openReview();

    at(2026, 11, 1);
    rerender(ui("2026-11-01"));
    expect(within(dialog).queryByText(second.title)).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));

    expect(item(september)).toMatchObject({ month: "2026-10", status: "backlog" });
    // October was still the current month when the review opened: it waits for its own review.
    expect(item(october)).toMatchObject({ month: "2026-10", status: "todo" });
    expect(screen.getByRole("button", { name: "Wrap up October" })).toBeInTheDocument();
  });
});

describe("Month-end review: quarter close", () => {
  const addObjective = (quarter: string, title: string, extra: { movedFrom?: string } = {}) => {
    const id = state().addObjective({
      quarter,
      title,
      keyResults: [{ title: "Finish 2", skillId: "product-discovery", type: "count", count: 2 }],
    });
    if (extra.movedFrom) {
      useAppStore.setState((s) => ({
        data: { ...s.data, objectives: s.data.objectives.map((o) => (o.id === id ? { ...o, movedFrom: extra.movedFrom } : o)) },
      }));
    }
    return id;
  };
  const objective = (id: string) => state().data.objectives.find((candidate) => candidate.id === id)!;

  it("closes ended quarters by default, at the current score", () => {
    const id = addObjective("2026-Q3", "Make discovery a habit");
    renderBanner();
    const dialog = openReview();
    expect(within(dialog).getByRole("heading", { name: "Close Q3" })).toBeInTheDocument();
    expect(checked(decision("Make discovery a habit"))).toHaveAccessibleName("Close at 0%");
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(objective(id)).toMatchObject({ status: "closed", finalProgress: 0 });
  });

  it("moves an objective once to the next quarter", () => {
    const id = addObjective("2026-Q3", "Make discovery a habit");
    renderBanner();
    const dialog = openReview();
    fireEvent.click(within(dialog).getByRole("radio", { name: "Move to Q4" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(objective(id)).toMatchObject({ quarter: "2026-Q4", movedFrom: "2026-Q3", status: "active" });
  });

  it("disallows a second move", () => {
    addObjective("2026-Q3", "Moved before", { movedFrom: "2026-Q2" });
    renderBanner();
    openReview();
    const move = screen.getByRole("radio", { name: "Move to Q4" });
    expect(move).toBeDisabled();
    expect(move).toHaveAccessibleDescription("Already moved once");
  });

  it("shows Met with no choice for objectives at 100%", () => {
    at(2026, 9, 10);
    for (const material of [first, second]) {
      const id = state().addPlanItem(material.id, "2026-09", { skillIds: ["product-discovery"] })!;
      state().movePlanItem(id, { status: "done" });
    }
    at(2026, 10, 5);
    addObjective("2026-Q3", "Already met");
    renderBanner();
    const dialog = openReview();
    expect(within(dialog).getByText("Met")).toBeInTheDocument();
    expect(screen.queryByRole("radiogroup", { name: "What to do with Already met" })).toBeNull();
  });

  it("offers only Close when the next quarter is outside the plannable window", () => {
    addObjective("2026-Q1", "Long ago");
    renderBanner();
    const dialog = openReview();
    expect(within(dialog).getByRole("heading", { name: "Close Q1" })).toBeInTheDocument();
    expect(within(dialog).getByText("Close at 0%")).toBeInTheDocument();
    expect(within(dialog).queryByRole("radio", { name: /Move to/ })).toBeNull();
  });

  it("lets only one objective take the next year's last slot, and applies exactly that", () => {
    at(2027, 1, 4);
    for (const title of ["One", "Two", "Three"]) addObjective("2027-Q2", title);
    const a = addObjective("2026-Q4", "Alpha");
    const b = addObjective("2026-Q4", "Beta");
    renderBanner("2027-01-04");
    const dialog = openReview("Wrap up December");
    expect(within(dialog).getByRole("heading", { name: "Close Q4 2026" })).toBeInTheDocument();

    fireEvent.click(within(decision("Alpha")).getByRole("radio", { name: "Move to Q1" }));
    const betaMove = within(decision("Beta")).getByRole("radio", { name: "Move to Q1" });
    expect(betaMove).toBeDisabled();
    expect(betaMove).toHaveAccessibleDescription("2027 already has 4 objectives");

    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(objective(a)).toMatchObject({ quarter: "2027-Q1", status: "active" });
    expect(objective(b)).toMatchObject({ quarter: "2026-Q4", status: "closed" });
  });
});

describe("Month-end review: year wrap", () => {
  beforeEach(() => {
    at(2026, 11, 10);
    const done = state().addPlanItem(first.id, "2026-11")!;
    state().movePlanItem(done, { status: "done" });
    state().addObjective({ quarter: "2026-Q4", title: "Ship the roadmap", keyResults: [] });
    state().addPlanItem(third.id, "2026-12");
    at(2027, 1, 4);
  });

  it("offers to archive the finished year, on by default", () => {
    renderBanner("2027-01-04");
    const dialog = openReview("Wrap up December");
    expect(within(dialog).getByRole("heading", { name: "Wrap up 2026" })).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "2026 is done: 1 thing finished, 1 objective closed. Archive it to keep your OKRs focused on what's next. You can still open it under Archive.",
      ),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("checkbox", { name: "Archive 2026" })).toBeChecked();

    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(state().data.archivedYears).toEqual([2026]);
    expect(state().data.objectives[0]).toMatchObject({ status: "closed" });
  });

  it("leaves the year unarchived when unticked, and doesn't ask again", () => {
    renderBanner("2027-01-04");
    const dialog = openReview("Wrap up December");
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Archive 2026" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    expect(state().data.archivedYears).toEqual([]);
    expect(screen.queryByRole("button", { name: /Wrap up/ })).toBeNull();
  });

  it("returns focus to the page once the review is done", async () => {
    renderBanner("2027-01-04");
    const dialog = openReview("Wrap up December");
    fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
    await act(() => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(document.activeElement).toBe(document.getElementById("content"));
  });
});
