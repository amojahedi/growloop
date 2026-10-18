// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster, dismissToast } from "@/components/ui/toast";
import { CURATED_MATERIALS } from "@/lib/catalog";
import type { Objective, PlanItem } from "@/lib/domain/types";
import { at, makeItem, makeKeyResult, makeObjective } from "@/lib/testing/fixtures";
import { useAppStore } from "@/lib/store/app-store";
import { TodayContext } from "@/lib/store/hooks";
import { emptyWorkspace } from "@/lib/store/seed";
import { useUIStore } from "@/lib/store/ui-store";
import { OkrsHeaderAction, OkrsView, yearTabs } from "./okrs-view";

const router = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }));
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => search.params,
  usePathname: () => "/okrs",
}));

const TODAY = "2026-10-18";
const book = CURATED_MATERIALS.find((m) => m.type === "book" && m.skillIds[0] === "roadmapping")!;
const cert = CURATED_MATERIALS.find((m) => m.type === "certification")!;

function seed(objectives: Objective[], extra: { planItems?: PlanItem[]; archivedYears?: number[] } = {}) {
  useAppStore.setState({ data: { ...emptyWorkspace(), objectives, planItems: extra.planItems ?? [], archivedYears: extra.archivedYears ?? [] } });
}

function renderPage() {
  return render(
    <TodayContext value={TODAY}>
      <OkrsHeaderAction />
      <OkrsView />
      <Toaster />
    </TodayContext>,
  );
}

const openMenu = (title: string) => {
  const trigger = screen.getByRole("button", { name: `Actions for "${title}"` });
  fireEvent.keyDown(trigger, { key: "Enter" });
};

beforeEach(() => {
  localStorage.clear();
  useUIStore.getState().resetWizard();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 18, 12));
  router.replace.mockReset();
  search.params = new URLSearchParams();
  seed([]);
});

afterEach(() => {
  act(() => dismissToast());
  cleanup();
  vi.useRealTimers();
});

describe("OKR page: empty", () => {
  it("shows the Set your year empty state and Plan my year in the header", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Set your year" })).toBeInTheDocument();
    expect(
      screen.getByText("Answer two questions and get a draft plan for the rest of 2026 and 2027. You can change everything."),
    ).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Plan my year" });
    expect(links).toHaveLength(2);
    for (const link of links) expect(link).toHaveAttribute("href", "/okrs/plan");
  });

  it("adds an objective by hand in the current quarter with the shared editor", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Add an objective myself" }));
    const editor = screen.getByRole("article", { name: "New objective in Q4 2026" });

    fireEvent.click(within(editor).getByRole("button", { name: "Add objective" }));
    expect(within(editor).getByText("Give it a title.")).toBeInTheDocument();
    expect(useAppStore.getState().data.objectives).toEqual([]);

    fireEvent.change(within(editor).getByRole("textbox", { name: "Objective" }), { target: { value: "Run better roadmap reviews" } });
    const [first, second] = within(editor).getAllByRole("combobox", { name: "Skill" });
    fireEvent.change(first, { target: { value: "roadmapping" } });
    fireEvent.change(second, { target: { value: "roadmapping" } });
    const material = within(editor).getByRole("combobox", { name: "Material" });
    fireEvent.click(material);
    fireEvent.click(within(editor).getByRole("option", { name: new RegExp(book.title.slice(0, 20)) }));
    fireEvent.click(within(editor).getByRole("button", { name: "Add objective" }));

    const [objective] = useAppStore.getState().data.objectives;
    expect(objective).toMatchObject({ quarter: "2026-Q4", title: "Run better roadmap reviews", source: "manual" });
    expect(objective.keyResults).toMatchObject([
      { type: "material", materialId: book.id, skillId: "roadmapping", title: `Finish ${book.title.split(":")[0]}` },
      { type: "count", count: 3, skillId: "roadmapping", title: "Complete 3 Roadmapping items" },
    ]);
  });
});

describe("OKR page: tabs and columns", () => {
  it("lists unarchived years with objectives or in the window, then Archive", () => {
    const objectives = [makeObjective({ quarter: "2025-Q2", status: "closed" }), makeObjective({ quarter: "2024-Q1", status: "closed" })];
    expect(yearTabs(objectives, [2024], TODAY)).toEqual(["2025", "2026", "2027", "archive"]);
    expect(yearTabs([], [], TODAY)).toEqual(["2026", "2027"]);
  });

  it("opens on the current year, follows ?year= and changes it from the tabs", () => {
    seed([makeObjective({ quarter: "2027-Q2", title: "Next year's", keyResults: [makeKeyResult()] })]);
    search.params = new URLSearchParams("year=2027");
    renderPage();
    expect(screen.getByRole("tab", { name: "2027" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Next year's" })).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole("tab", { name: "2026" }), { button: 0 });
    expect(router.replace).toHaveBeenCalledWith("/okrs?year=2026", { scroll: false });
  });

  it("labels the current quarter Now, shows pace and dashes past empty quarters", () => {
    seed([makeObjective({ quarter: "2026-Q4", title: "Lead roadmap talks", keyResults: [makeKeyResult({ count: 2 })] })]);
    renderPage();
    const now = screen.getByRole("listitem", { name: "Q4 2026" });
    expect(within(now).getByText("Now")).toBeInTheDocument();
    expect(within(now).getByText("· Behind pace")).toBeInTheDocument();
    expect(within(screen.getByRole("listitem", { name: "Q1 2026" })).getByText("—")).toBeInTheDocument();
    // Fill empty quarters while 2027 is open.
    expect(screen.getByRole("link", { name: "Fill empty quarters" })).toHaveAttribute("href", "/okrs/plan");
  });

  it("shows no header action once every quarter in scope has an objective", () => {
    seed(["2026-Q4", "2027-Q1", "2027-Q2", "2027-Q3", "2027-Q4"].map((quarter) => makeObjective({ quarter })));
    renderPage();
    expect(screen.queryByRole("link", { name: /Plan my year|Fill empty quarters/ })).not.toBeInTheDocument();
  });
});

describe("OKR page: key results", () => {
  it("adds a target that isn't on the board, linked, with Undo", () => {
    const keyResult = makeKeyResult({ id: "kr-book", type: "material", materialId: book.id, skillId: "roadmapping", title: "Finish it" });
    seed([makeObjective({ quarter: "2027-Q1", keyResults: [keyResult, makeKeyResult({ skillId: "roadmapping" })] })]);
    search.params = new URLSearchParams("year=2027");
    renderPage();
    expect(screen.getByText("Not on your board yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Find resources/ })).toHaveAttribute("href", "/library?skill=roadmapping");

    fireEvent.click(screen.getByRole("button", { name: `Add "${book.title}" to your board` }));
    const [item] = useAppStore.getState().data.planItems;
    expect(item).toMatchObject({ materialId: book.id, month: "2026-10", keyResultId: "kr-book", status: "todo" });
    expect(useAppStore.getState().data.savedMaterialIds).toContain(book.id);
    expect(screen.getByRole("link", { name: new RegExp(book.title.slice(0, 15)) })).toHaveAttribute("href", `/board?item=${item.id}`);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(useAppStore.getState().data.planItems).toEqual([]);
    expect(useAppStore.getState().data.savedMaterialIds).not.toContain(book.id);
  });

  it("offers Mark as earned on a finished certification", () => {
    const keyResult = makeKeyResult({ id: "kr-cert", type: "certification", materialId: cert.id, skillId: cert.skillIds[0] });
    const item = makeItem({ id: "card", materialId: cert.id, keyResultId: "kr-cert", status: "done", completedAt: at("2026-10-10") });
    seed([makeObjective({ quarter: "2026-Q4", keyResults: [keyResult, makeKeyResult()] })], { planItems: [item] });
    renderPage();
    expect(screen.getByText("Done · not marked earned")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark as earned" }));
    expect(useAppStore.getState().data.planItems[0].earnedAt).toBeDefined();
    expect(screen.getByText("Earned")).toBeInTheDocument();
  });

  it("flags a missing target and lets the user pick another in the editor", () => {
    const keyResult = makeKeyResult({ type: "material", materialId: "gone", skillId: "roadmapping", title: "Finish the lost book" });
    seed([makeObjective({ quarter: "2026-Q4", title: "Lost", keyResults: [keyResult, makeKeyResult()] })]);
    renderPage();
    expect(screen.getByText("Material missing")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Pick another" }));
    expect(screen.getByRole("article", { name: "Edit objective in Q4 2026" })).toBeInTheDocument();
  });
});

describe("OKR page: objective actions and read-only states", () => {
  it("edits with the shared editor from the ⋯ menu", () => {
    seed([makeObjective({ id: "obj", quarter: "2026-Q4", title: "Old title", keyResults: [makeKeyResult({ skillId: "roadmapping" }), makeKeyResult({ skillId: "roadmapping" })] })]);
    renderPage();
    openMenu("Old title");
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
    const editor = screen.getByRole("article", { name: "Edit objective in Q4 2026" });
    fireEvent.change(within(editor).getByRole("textbox", { name: "Objective" }), { target: { value: "New title" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Save" }));
    expect(useAppStore.getState().data.objectives[0].title).toBe("New title");
    expect(screen.getByRole("heading", { name: "New title" })).toBeInTheDocument();
  });

  it("deletes with Undo, unlinking cards without deleting them", () => {
    const keyResult = makeKeyResult({ id: "kr", type: "material", materialId: book.id, skillId: "roadmapping" });
    seed([makeObjective({ quarter: "2026-Q4", title: "Doomed", keyResults: [keyResult, makeKeyResult()] })], {
      planItems: [makeItem({ id: "card", materialId: book.id, keyResultId: "kr" })],
    });
    renderPage();
    openMenu("Doomed");
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(useAppStore.getState().data.objectives).toEqual([]);
    expect(useAppStore.getState().data.planItems[0].keyResultId).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(useAppStore.getState().data.objectives).toHaveLength(1);
    expect(useAppStore.getState().data.planItems[0].keyResultId).toBe("kr");
  });

  it("renders closed and moved objectives read-only with their labels", () => {
    seed([
      makeObjective({ quarter: "2026-Q3", title: "Closed one", status: "closed", finalProgress: 64, keyResults: [makeKeyResult()] }),
      makeObjective({ quarter: "2026-Q2", title: "Met one", status: "closed", finalProgress: 100, keyResults: [makeKeyResult()] }),
      makeObjective({ quarter: "2026-Q4", title: "Moved one", movedFrom: "2026-Q3", keyResults: [makeKeyResult()] }),
    ]);
    renderPage();
    expect(screen.getByText("Closed at 64%")).toBeInTheDocument();
    expect(screen.getByText("· Met")).toBeInTheDocument();
    expect(screen.getByText("Moved from Q3")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: 'Actions for "Closed one"' })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: 'Actions for "Moved one"' })).toBeInTheDocument();
  });

  it("shows archived years read-only under Archive", () => {
    seed([makeObjective({ quarter: "2025-Q4", title: "Last year", status: "closed", finalProgress: 80, keyResults: [makeKeyResult()] })], {
      archivedYears: [2025],
    });
    search.params = new URLSearchParams("year=archive");
    renderPage();
    expect(screen.queryByRole("tab", { name: "2025" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Archive" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "2025" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Last year" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Actions for/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add objective/ })).not.toBeInTheDocument();
  });

  it("offers Archive on a finished, unarchived past year", () => {
    seed([makeObjective({ quarter: "2025-Q4", title: "Last year", status: "closed", finalProgress: 80, keyResults: [makeKeyResult()] })]);
    search.params = new URLSearchParams("year=2025");
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Archive 2025" }));
    expect(useAppStore.getState().data.archivedYears).toEqual([2025]);
    expect(router.replace).toHaveBeenCalledWith("/okrs?year=archive", { scroll: false });
  });
});
