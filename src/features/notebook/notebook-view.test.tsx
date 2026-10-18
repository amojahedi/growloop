// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAI, resetFakeAI } from "@/components/notes/testing/fake-ai";
import { dismissToast, Toaster } from "@/components/ui/toast";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { findCardNote } from "@/lib/domain/notes";
import { useAppStore } from "@/lib/store/app-store";
import { TodayContext } from "@/lib/store/hooks";
import { emptyWorkspace } from "@/lib/store/seed";
import { NotebookView } from "./notebook-view";
import { createNoteAndOpen } from "./use-notebook-params";

vi.mock("@/lib/ai/use-ai", async () => (await import("@/components/notes/testing/fake-ai")).fakeUseAIModule);

/** Next's router mirrors pushState/replaceState into useSearchParams; this stand-in does the same. */
vi.mock("next/navigation", async () => {
  const { useMemo, useSyncExternalStore } = await import("react");
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  for (const method of ["pushState", "replaceState"] as const) {
    const original = window.history[method].bind(window.history);
    window.history[method] = (...args: Parameters<History["pushState"]>) => {
      original(...args);
      notify();
    };
  }
  window.addEventListener("popstate", notify);
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return {
    usePathname: () => "/notebook",
    useSearchParams: () => {
      const search = useSyncExternalStore(subscribe, () => window.location.search);
      return useMemo(() => new URLSearchParams(search), [search]);
    },
  };
});

const TODAY = "2026-10-18";
const book = CURATED_MATERIALS.find((material) => material.type === "book")!;
const store = () => useAppStore.getState();
const data = () => store().data;
const search = () => decodeURIComponent(window.location.search);
const tick = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

function renderNotebook(url = "/notebook") {
  window.history.replaceState(null, "", url);
  return render(
    <TodayContext value={TODAY}>
      <NotebookView />
      <Toaster />
    </TodayContext>,
  );
}

/** A card with a summary (due Oct 12) and notes, plus a free note. */
function seed() {
  const itemId = store().addPlanItem(book.id, "2026-10")!;
  const summaryId = store().setCardNote(itemId, "summary", "Good teams are handed problems, not features.")!;
  store().setNoteReview(summaryId, "2026-10-12");
  const cardNoteId = store().setCardNote(itemId, "item_note", "Try outcome roadmaps")!;
  const freeId = store().createNote({ title: "Questions for my 1:1", body: "Ask about the Résumé review", skillIds: ["roadmapping"] });
  // Distinct edit times, so "newest first" is deterministic.
  const updatedAt: Record<string, string> = {
    [summaryId]: "2026-10-15T09:00:00.000Z",
    [cardNoteId]: "2026-10-16T09:00:00.000Z",
    [freeId]: "2026-10-17T09:00:00.000Z",
  };
  useAppStore.setState((state) => ({
    data: { ...state.data, notes: state.data.notes.map((note) => ({ ...note, updatedAt: updatedAt[note.id] ?? note.updatedAt })) },
  }));
  return { itemId, summaryId, cardNoteId, freeId };
}

const list = () => screen.getByRole("listbox", { name: "Notes" });
const options = () => within(list()).getAllByRole("option");
const toaster = () => document.querySelector<HTMLElement>("[data-toaster]")!;
const openMenu = (trigger: HTMLElement) => fireEvent.keyDown(trigger, { key: "Enter" });

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  useAppStore.setState({ data: emptyWorkspace() });
  resetFakeAI();
});

afterEach(() => {
  act(() => dismissToast());
  cleanup();
});

describe("NotebookView", () => {
  it("shows the empty state with New note, which opens a free note with the title focused", () => {
    renderNotebook();
    expect(screen.getByText("Your notebook is empty.")).toBeInTheDocument();
    expect(screen.getByText("Summaries you write on cards land here automatically.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "New note" }));
    const [note] = data().notes;
    expect(note).toMatchObject({ kind: "free", title: "", body: "" });
    expect(search()).toBe(`?note=${note.id}`);
    expect(document.activeElement).toBe(screen.getByRole("textbox", { name: "Title" }));
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveAttribute("placeholder", "Untitled note");
  });

  it("lists every kind newest first and filters by source, Due, skills and search, all in the URL", () => {
    seed();
    renderNotebook();
    expect(options().map((option) => option.textContent)).toEqual([
      expect.stringContaining("Questions for my 1:1"),
      expect.stringContaining("Try outcome roadmaps"),
      expect.stringContaining("Good teams are handed problems"),
    ]);
    expect(options()[2]).toHaveTextContent("Due Oct 12");

    fireEvent.click(screen.getByRole("button", { name: "Summaries" }));
    expect(search()).toBe("?show=summaries");
    expect(options()).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Notes" }));
    expect(options()).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.click(screen.getByRole("button", { name: "Due 1" }));
    expect(search()).toBe("?due=1");
    expect(options()).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Due 1" }));

    fireEvent.click(screen.getByRole("button", { name: "Skills" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Roadmapping" }));
    expect(search()).toBe("?skill=roadmapping");
    expect(options().some((option) => option.textContent?.includes("Questions for my 1:1"))).toBe(true);
  });

  it("searches titles, material titles and bodies, ignoring accents, and offers Clear filters when nothing matches", async () => {
    seed();
    renderNotebook("/notebook?q=resume");
    expect(options()).toHaveLength(1);
    expect(options()[0]).toHaveTextContent("Questions for my 1:1");

    const field = screen.getByRole("searchbox", { name: "Search notes" });
    fireEvent.change(field, { target: { value: "zzz" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(search()).toBe("?q=zzz");
    expect(screen.getByText("No notes match.")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Clear filters" })[0]);
    expect(search()).toBe("");
    expect(options()).toHaveLength(3);
  });

  it("says Nothing due when the Due filter is empty", () => {
    const { summaryId } = seed();
    store().markNoteReviewed(summaryId);
    renderNotebook("/notebook?due=1");
    expect(screen.getByText("Nothing due. Nice.")).toBeInTheDocument();
  });

  it("is a listbox: arrows move, Enter opens the note", () => {
    const { cardNoteId } = seed();
    renderNotebook();
    list().focus();
    fireEvent.keyDown(list(), { key: "ArrowDown" });
    expect(list()).toHaveAttribute("aria-activedescendant", options()[1].id);
    fireEvent.keyDown(list(), { key: "Enter" });
    expect(search()).toBe(`?note=${cardNoteId}`);
    expect(options()[1]).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(list(), { key: "End" });
    expect(list()).toHaveAttribute("aria-activedescendant", options()[2].id);
  });

  it("edits a card's summary in place: the same record the card shows, with Open card and Get feedback", () => {
    const { itemId, summaryId } = seed();
    renderNotebook(`/notebook?note=${summaryId}`);
    const pane = screen.getByRole("article", { name: `Summary: ${book.title}` });
    expect(within(pane).getByRole("link", { name: /Open card/ })).toHaveAttribute("href", `/board?item=${itemId}`);
    expect(within(pane).getByRole("button", { name: "Get feedback from Claude" })).toBeEnabled();

    const body = within(pane).getByRole("textbox", { name: "Summary" });
    fireEvent.change(body, { target: { value: "Teams solve problems." } });
    fireEvent.blur(body);
    expect(findCardNote(data().notes, itemId, "summary")).toMatchObject({ id: summaryId, body: "Teams solve problems." });
    expect(data().notes.filter((note) => note.kind === "summary")).toHaveLength(1);
  });

  it("shows Card removed for a removed card's notes, which stay", () => {
    const { itemId, cardNoteId } = seed();
    store().removePlanItem(itemId);
    renderNotebook(`/notebook?note=${cardNoteId}`);
    expect(screen.getByText("Card removed")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveValue("Try outcome roadmaps");
    // No Claude on card notes or free notes.
    expect(screen.queryByRole("button", { name: /Get feedback/ })).not.toBeInTheDocument();
  });

  it("shows Turn on Claude on summaries when Claude is off", () => {
    fakeAI.state = "unavailable";
    const { summaryId } = seed();
    renderNotebook(`/notebook?note=${summaryId}`);
    expect(screen.getByText(/Want feedback on this\?/)).toBeInTheDocument();
  });

  it("offers Reviewed and Again on a due note", () => {
    const { summaryId } = seed();
    renderNotebook(`/notebook?note=${summaryId}`);
    expect(screen.getByText("Due for review")).toBeInTheDocument();

    openMenu(screen.getByRole("button", { name: /Again/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "In a week" }));
    expect(data().notes.find((note) => note.id === summaryId)?.reviewAt).toBe("2026-10-25");
    expect(toaster()).toHaveTextContent("Nice. See you in a week.");
    expect(screen.queryByText("Due for review")).not.toBeInTheDocument();

    act(() => store().setNoteReview(summaryId, "2026-10-18"));
    fireEvent.click(screen.getByRole("button", { name: "Reviewed" }));
    const note = data().notes.find((candidate) => candidate.id === summaryId)!;
    expect(note.reviewAt).toBeUndefined();
    expect(note.lastReviewedAt).toBeDefined();
  });

  it("deletes free notes and clears card notes, both undoable", () => {
    const { freeId, cardNoteId } = seed();
    renderNotebook(`/notebook?note=${freeId}`);

    openMenu(screen.getByRole("button", { name: "Note actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(data().notes.some((note) => note.id === freeId)).toBe(false);
    expect(search()).toBe("");
    expect(toaster()).toHaveTextContent("Note deleted");
    fireEvent.click(within(toaster()).getByRole("button", { name: "Undo" }));
    expect(data().notes.find((note) => note.id === freeId)?.title).toBe("Questions for my 1:1");

    fireEvent.click(options().find((option) => option.textContent?.includes("Try outcome roadmaps"))!);
    openMenu(screen.getByRole("button", { name: "Note actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Clear" }));
    expect(data().notes.find((note) => note.id === cardNoteId)?.body).toBe("");
    expect(options().some((option) => option.textContent?.includes("Try outcome roadmaps"))).toBe(false);
    fireEvent.click(within(toaster()).getByRole("button", { name: "Undo" }));
    expect(data().notes.find((note) => note.id === cardNoteId)?.body).toBe("Try outcome roadmaps");
  });

  it("picks 0 to 3 skills for free notes", () => {
    const { freeId } = seed();
    renderNotebook(`/notebook?note=${freeId}`);
    fireEvent.click(screen.getByRole("button", { name: "Choose skills for this note" }));
    const boxes = screen.getAllByRole("checkbox").filter((box) => !(box as HTMLInputElement).checked);
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    expect(data().notes.find((note) => note.id === freeId)?.skillIds).toHaveLength(3);
    expect(boxes[2]).toBeDisabled();
  });

  it("says That note is gone for an unknown note, with the list still shown", () => {
    seed();
    renderNotebook("/notebook?note=missing");
    expect(screen.getByText("That note is gone.")).toBeInTheDocument();
    expect(options()).toHaveLength(3);
  });
});

describe("New note", () => {
  it("discards an untouched new note when another note is opened, and keeps a titled one", async () => {
    seed();
    renderNotebook();
    let id = "";
    act(() => {
      id = createNoteAndOpen();
    });
    expect(options()[0]).toHaveTextContent("Untitled note");
    fireEvent.click(options()[1]);
    await tick();
    expect(data().notes.some((note) => note.id === id)).toBe(false);

    act(() => {
      id = createNoteAndOpen();
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Ideas" } });
    // Switching notes stores the pending title before the empty check runs.
    fireEvent.click(options()[1]);
    await tick();
    expect(data().notes.find((note) => note.id === id)?.title).toBe("Ideas");
  });

  it("discards an untouched new note when leaving the Notebook", async () => {
    const view = renderNotebook();
    act(() => {
      createNoteAndOpen();
    });
    expect(data().notes).toHaveLength(1);
    view.unmount();
    await tick();
    expect(data().notes).toHaveLength(0);
  });
});
