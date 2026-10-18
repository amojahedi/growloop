// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeAI, resetFakeAI } from "@/components/notes/testing/fake-ai";
import { dismissToast, Toaster } from "@/components/ui/toast";
import { CURATED_MATERIALS, SUMMARIZE_TASK_TITLE } from "@/lib/catalog";
import { findCardNote } from "@/lib/domain/notes";
import { summaryTask } from "@/lib/domain/plan-items";
import type { BoardStatus } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";
import { TodayContext } from "@/lib/store/hooks";
import { emptyWorkspace } from "@/lib/store/seed";
import { useUIStore } from "@/lib/store/ui-store";
import { CardDetailDrawer } from "./card-detail-drawer";

vi.mock("@/lib/ai/use-ai", async () => (await import("@/components/notes/testing/fake-ai")).fakeUseAIModule);

const TODAY = "2026-10-17";
const book = CURATED_MATERIALS.find((material) => material.type === "book" && (material.milestones?.length ?? 0) > 0 && material.url)!;
const certification = CURATED_MATERIALS.find((material) => material.type === "certification")!;

const store = () => useAppStore.getState();
const data = () => store().data;
const item = (id: string) => data().planItems.find((candidate) => candidate.id === id)!;

function addCard(materialId = book.id, month = "2026-10", status: BoardStatus = "todo") {
  return store().addPlanItem(materialId, month, { status })!;
}

function renderDrawer(itemId: string | null, props: Partial<React.ComponentProps<typeof CardDetailDrawer>> = {}) {
  const onClose = vi.fn();
  const view = render(
    <TodayContext value={TODAY}>
      <CardDetailDrawer itemId={itemId} onClose={onClose} {...props} />
      <Toaster />
    </TodayContext>,
  );
  return { ...view, onClose };
}

const dialog = () => screen.getByRole("dialog");
const inDialog = () => within(dialog());
/** Radix menus open from the keyboard in jsdom (pointer events are incomplete there). */
const openMenu = (trigger: HTMLElement) => fireEvent.keyDown(trigger, { key: "Enter" });
const type = (field: HTMLElement, value: string) => {
  fireEvent.change(field, { target: { value } });
  fireEvent.blur(field);
};
const summaryField = () => inDialog().getByRole("textbox", { name: "In my words" });

beforeAll(() => {
  // Radix popovers measure with ResizeObserver, which jsdom lacks.
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  useAppStore.setState({ data: emptyWorkspace() });
  useUIStore.setState({ skillSheet: null });
  resetFakeAI();
});

afterEach(() => {
  act(() => dismissToast());
  cleanup();
});

describe("CardDetailDrawer", () => {
  it("is a labelled dialog with the sections in order; About and Time start collapsed and hold the only hours", () => {
    const id = addCard();
    renderDrawer(id);

    expect(screen.getByRole("dialog", { name: book.title })).toBeInTheDocument();
    expect(inDialog().getByRole("link", { name: /Open link/ })).toHaveAttribute("rel", expect.stringContaining("noopener"));

    const order = [
      inDialog().getByRole("heading", { name: "Tasks" }),
      summaryField(),
      inDialog().getByRole("textbox", { name: "Notes" }),
      inDialog().getByRole("heading", { name: "Reminder" }),
      inDialog().getByRole("button", { name: "About this material" }),
      inDialog().getByRole("button", { name: "Time (optional)" }),
    ];
    for (let index = 1; index < order.length; index++) {
      expect(order[index - 1].compareDocumentPosition(order[index]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }

    const about = inDialog().getByRole("button", { name: "About this material" });
    const time = inDialog().getByRole("button", { name: "Time (optional)" });
    expect(about).toHaveAttribute("aria-expanded", "false");
    expect(time).toHaveAttribute("aria-expanded", "false");
    const hours = /\bhours?\b|\d(\.\d)?h\b/i;
    expect(dialog().textContent).not.toMatch(hours);

    fireEvent.click(about);
    expect(about).toHaveAttribute("aria-expanded", "true");
    expect(inDialog().getByText(book.summary)).toBeInTheDocument();
    expect(dialog().textContent).not.toMatch(hours);

    fireEvent.click(time);
    expect(inDialog().getByLabelText("Estimate (hours)")).toBeInTheDocument();
  });

  it("stays closed without a card, and closes through onClose", () => {
    const { rerender, onClose } = renderDrawer("gone");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    const id = addCard();
    rerender(
      <TodayContext value={TODAY}>
        <CardDetailDrawer itemId={id} onClose={onClose} />
      </TodayContext>,
    );
    fireEvent.keyDown(dialog(), { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(inDialog().getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("writes the summary into the card's summary note and ticks Summarize in my words once", () => {
    const id = addCard();
    renderDrawer(id);
    expect(summaryTask(item(id))?.done).toBe(false);
    expect(summaryField()).toHaveAttribute("placeholder", "What's the one idea you'll use? Two or three sentences is plenty.");

    type(summaryField(), "Outcomes beat output.");
    const note = findCardNote(data().notes, id, "summary")!;
    expect(note).toMatchObject({ kind: "summary", planItemId: id, materialId: book.id, body: "Outcomes beat output." });
    expect(summaryTask(item(id))?.done).toBe(true);
    expect(inDialog().getAllByRole("status").some((status) => status.textContent === "Saved")).toBe(true);

    // Unchecked by hand, it stays unchecked on later saves.
    fireEvent.click(inDialog().getByRole("checkbox", { name: SUMMARIZE_TASK_TITLE }));
    type(summaryField(), "Outcomes beat output, every time.");
    expect(summaryTask(item(id))?.done).toBe(false);
    expect(data().notes.filter((candidate) => candidate.kind === "summary")).toHaveLength(1);

    // An edit made elsewhere (the Notebook) shows up here: it's the same record.
    act(() => store().updateNote(note.id, { body: "Edited in the Notebook" }));
    expect(summaryField()).toHaveValue("Edited in the Notebook");
  });

  it("writes notes into the card's item note, removing it from the Notebook when cleared", () => {
    const id = addCard();
    renderDrawer(id);
    const notes = inDialog().getByRole("textbox", { name: "Notes" });
    expect(notes).toHaveAttribute("placeholder", "Quotes, ideas, things to try…");

    type(notes, "Try outcome roadmaps");
    expect(findCardNote(data().notes, id, "item_note")?.body).toBe("Try outcome roadmaps");
    type(notes, "");
    expect(findCardNote(data().notes, id, "item_note")?.body).toBe("");
  });

  it("schedules the summary for review once it has text", () => {
    const id = addCard();
    renderDrawer(id);
    expect(inDialog().getByRole("button", { name: /Review later/ })).toBeDisabled();

    type(summaryField(), "Outcomes beat output.");
    openMenu(inDialog().getByRole("button", { name: /Review later/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "In a week" }));
    expect(findCardNote(data().notes, id, "summary")?.reviewAt).toBe("2026-10-24");
    expect(inDialog().getByRole("button", { name: /Review Oct 24/ })).toBeInTheDocument();

    fireEvent.click(inDialog().getByRole("button", { name: "Clear the review date for your summary" }));
    expect(findCardNote(data().notes, id, "summary")?.reviewAt).toBeUndefined();
  });

  it("gets feedback at 20+ characters and only replaces the summary on Use this version, undoably", async () => {
    const id = addCard();
    fakeAI.refine.mockResolvedValue({
      strengths: ["You name the core trade-off clearly."],
      gaps: ["The book's point about outcome metrics."],
      suggestions: ["Lead with the idea, then the example."],
      improvedVersion: "Measure outcomes, not output.",
    });
    renderDrawer(id);
    const button = () => inDialog().getByRole("button", { name: /Get feedback from Claude|Reading your summary/ });

    type(summaryField(), "Too short");
    expect(button()).toBeDisabled();
    type(summaryField(), "Output is not the same as outcome.");
    expect(button()).toBeEnabled();

    await act(async () => fireEvent.click(button()));
    expect(fakeAI.refine).toHaveBeenCalledWith({
      material: { title: book.title, author: book.author, brief: book.summary },
      summary: "Output is not the same as outcome.",
    });
    const panel = inDialog().getByRole("region", { name: "Feedback from Claude" });
    expect(panel).toHaveTextContent("What works");
    expect(panel).toHaveTextContent("You name the core trade-off clearly.");
    expect(panel).toHaveTextContent("What's missing");
    expect(panel).toHaveTextContent("Try");
    expect(panel).toHaveTextContent("A tighter version (optional)");
    // Feedback never replaces the summary on its own.
    expect(summaryField()).toHaveValue("Output is not the same as outcome.");

    fireEvent.click(within(panel).getByRole("button", { name: "Use this version" }));
    expect(summaryField()).toHaveValue("Measure outcomes, not output.");
    expect(findCardNote(data().notes, id, "summary")?.refinedAt).toBeDefined();
    expect(inDialog().queryByRole("region", { name: "Feedback from Claude" })).not.toBeInTheDocument();

    const toaster = document.querySelector<HTMLElement>("[data-toaster]")!;
    expect(toaster).toHaveTextContent("Summary replaced");
    fireEvent.click(within(toaster).getByRole("button", { name: "Undo" }));
    expect(summaryField()).toHaveValue("Output is not the same as outcome.");
    expect(findCardNote(data().notes, id, "summary")?.refinedAt).toBeUndefined();
    // Undo didn't close the drawer.
    expect(dialog()).toBeInTheDocument();
  });

  it("discards feedback on Keep mine and shows errors inline with Try again", async () => {
    const id = addCard();
    fakeAI.refine.mockResolvedValueOnce({ strengths: ["Clear"], gaps: [], suggestions: [], improvedVersion: "Shorter." });
    renderDrawer(id);
    type(summaryField(), "Output is not the same as outcome.");

    await act(async () => fireEvent.click(inDialog().getByRole("button", { name: "Get feedback from Claude" })));
    fireEvent.click(inDialog().getByRole("button", { name: "Keep mine" }));
    expect(inDialog().queryByRole("region", { name: "Feedback from Claude" })).not.toBeInTheDocument();
    expect(summaryField()).toHaveValue("Output is not the same as outcome.");

    fakeAI.refine.mockRejectedValueOnce(Object.assign(new Error("Claude couldn't respond this time."), { code: "refusal" }));
    await act(async () => fireEvent.click(inDialog().getByRole("button", { name: "Get feedback from Claude" })));
    expect(inDialog().getByRole("alert")).toHaveTextContent("Claude couldn't respond this time.");
    expect(inDialog().getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("offers Turn on Claude instead of Get feedback when Claude is off", () => {
    fakeAI.state = "unavailable";
    renderDrawer(addCard());
    expect(inDialog().queryByRole("button", { name: /Get feedback/ })).not.toBeInTheDocument();
    expect(inDialog().getByText(/Want feedback on this\?/)).toBeInTheDocument();
    expect(inDialog().getByRole("link", { name: "Turn on Claude" })).toHaveAttribute("href", "/settings#claude");
  });

  it("checks, renames, deletes and adds tasks; Enter keeps the field open for the next", () => {
    const id = addCard();
    renderDrawer(id);
    const [first] = item(id).tasks;
    const total = item(id).tasks.length;
    expect(inDialog().getByText(`0 of ${total}`)).toBeInTheDocument();

    fireEvent.click(inDialog().getByRole("checkbox", { name: first.title }));
    expect(item(id).tasks[0].done).toBe(true);
    expect(inDialog().getByText(`1 of ${total}`)).toBeInTheDocument();

    fireEvent.click(inDialog().getByRole("button", { name: `Rename ${first.title}` }));
    const rename = inDialog().getByRole("textbox", { name: `Rename task ${first.title}` });
    // Escape cancels the rename without closing the drawer.
    fireEvent.keyDown(rename, { key: "Escape" });
    expect(dialog()).toBeInTheDocument();
    fireEvent.click(inDialog().getByRole("button", { name: `Rename ${first.title}` }));
    const renameAgain = inDialog().getByRole("textbox", { name: `Rename task ${first.title}` });
    fireEvent.change(renameAgain, { target: { value: "Part 1 again" } });
    fireEvent.keyDown(renameAgain, { key: "Enter" });
    expect(item(id).tasks[0].title).toBe("Part 1 again");

    fireEvent.click(inDialog().getByRole("button", { name: "Delete Part 1 again" }));
    expect(item(id).tasks).toHaveLength(total - 1);

    fireEvent.click(inDialog().getByRole("button", { name: "Add a task" }));
    const field = inDialog().getByRole("textbox", { name: "New task" });
    fireEvent.change(field, { target: { value: "Write a one-pager" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(field).toHaveValue("");
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: "Share it" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(item(id).tasks.slice(-2).map((task) => [task.title, task.kind])).toEqual([
      ["Write a one-pager", "custom"],
      ["Share it", "custom"],
    ]);
  });

  it("moves the card with the status select, like Move to", () => {
    const id = addCard(book.id, "2026-04", "backlog");
    renderDrawer(id);
    const status = inDialog().getByRole("combobox", { name: "Status" });
    expect(status).toHaveValue("backlog");

    fireEvent.change(status, { target: { value: "in_progress" } });
    // Leaving Backlog schedules it into this month.
    expect(item(id)).toMatchObject({ status: "in_progress", month: "2026-10" });
    fireEvent.change(status, { target: { value: "done" } });
    expect(item(id).completedAt).toBeDefined();
  });

  it("edits the card's skills: 1 to 3, with a primary, without touching the material", () => {
    const id = addCard();
    renderDrawer(id);
    const original = [...item(id).skillIds];
    fireEvent.click(inDialog().getByRole("button", { name: "Edit skills for this card" }));
    const editor = screen.getByRole("group", { name: "Skills for this card" });

    const unchecked = within(editor)
      .getAllByRole("checkbox")
      .filter((box) => !(box as HTMLInputElement).checked);
    fireEvent.click(unchecked[0]);
    expect(item(id).skillIds).toHaveLength(original.length + 1);
    // At three skills the rest are disabled.
    if (item(id).skillIds.length === 3) expect(unchecked[1]).toBeDisabled();

    const added = item(id).skillIds.at(-1)!;
    const name = data().skills.find((skill) => skill.id === added)!.name;
    fireEvent.click(within(editor).getByRole("radio", { name: `Make ${name} the primary skill` }));
    expect(item(id).skillIds[0]).toBe(added);
    expect(CURATED_MATERIALS.find((material) => material.id === book.id)!.skillIds).toEqual(book.skillIds);
  });

  it("opens the skill sheet from a chip", () => {
    const id = addCard();
    renderDrawer(id);
    const skill = data().skills.find((candidate) => candidate.id === item(id).skillIds[0])!;
    fireEvent.click(inDialog().getByRole("button", { name: new RegExp(`^${skill.name}`) }));
    expect(useUIStore.getState().skillSheet).toBe(skill.id);
  });

  it("shows the KR row states: Set your year, link, linked with Change and Unlink, and Also counts toward", () => {
    const id = addCard();
    const { unmount } = renderDrawer(id);
    expect(inDialog().getByRole("link", { name: "Set your year to connect this to a goal" })).toHaveAttribute("href", "/okrs/plan");
    unmount();

    const skillId = item(id).skillIds[0];
    act(() => {
      store().addObjective({
        quarter: "2026-Q4",
        title: "Lead roadmap conversations",
        keyResults: [
          { title: "Finish 1 book", skillId, type: "material", materialId: "some-other-book" },
          { title: "Complete 3 items", skillId, type: "count", count: 3 },
        ],
      });
    });
    renderDrawer(id);
    expect(inDialog().getByText(/Also counts toward Complete 3 items/)).toBeInTheDocument();
    openMenu(inDialog().getByRole("button", { name: /Link to a key result/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: /Finish 1 book/ }));
    expect(inDialog().getByText("Lead roadmap conversations · Finish 1 book")).toBeInTheDocument();

    fireEvent.click(inDialog().getByRole("button", { name: "Unlink from this key result" }));
    expect(item(id).keyResultId).toBeUndefined();
  });

  it("adds, edits and clears a reminder (today or later, at most 120 characters)", () => {
    const id = addCard();
    renderDrawer(id);
    fireEvent.click(inDialog().getByRole("button", { name: "Add reminder" }));
    const date = inDialog().getByLabelText("Date");
    expect(date).toHaveAttribute("min", TODAY);
    const note = inDialog().getByLabelText("Note (optional)");
    expect(note).toHaveAttribute("maxLength", "120");

    fireEvent.change(note, { target: { value: "Finish the strategy section" } });
    fireEvent.change(date, { target: { value: "2026-10-24" } });
    expect(item(id).reminder).toEqual({ date: "2026-10-24", note: "Finish the strategy section" });
    fireEvent.click(inDialog().getByRole("button", { name: "Done" }));
    expect(inDialog().getByText("Oct 24")).toBeInTheDocument();

    fireEvent.click(inDialog().getByRole("button", { name: "Clear reminder" }));
    expect(item(id).reminder).toBeUndefined();
  });

  it("logs time in the Time section", () => {
    const id = addCard();
    renderDrawer(id);
    fireEvent.click(inDialog().getByRole("button", { name: "Time (optional)" }));
    fireEvent.change(inDialog().getByLabelText("Hours"), { target: { value: "1.5" } });
    fireEvent.click(inDialog().getByRole("button", { name: "Log time" }));
    expect(item(id).timeLogs).toEqual([expect.objectContaining({ date: TODAY, hours: 1.5 })]);
    fireEvent.click(inDialog().getByRole("button", { name: "Delete 1.5h on Oct 17" }));
    expect(item(id).timeLogs).toEqual([]);
  });

  it("follows a move to Done like the board: Did you earn…? for certifications, then the summary toast once", () => {
    const id = addCard(certification.id, "2026-10", "in_progress");
    renderDrawer(id);
    fireEvent.change(inDialog().getByRole("combobox", { name: "Status" }), { target: { value: "done" } });

    const ask = screen.getByRole("dialog", { name: /^Did you earn .+\?$/ });
    fireEvent.click(within(ask).getByRole("button", { name: "Yes, I earned it" }));
    expect(item(id).earnedAt).toBeDefined();
    expect(inDialog().getByText(/^Earned /)).toBeInTheDocument();

    const toaster = document.querySelector<HTMLElement>("[data-toaster]")!;
    expect(toaster).toHaveTextContent("Nice. Add a two-line summary while it's fresh?");
    fireEvent.click(within(toaster).getByRole("button", { name: "Write summary" }));
    expect(document.activeElement).toBe(summaryField());
    expect(item(id).summaryNudgedAt).toBeDefined();

    // At most once per card.
    act(() => dismissToast());
    fireEvent.change(inDialog().getByRole("combobox", { name: "Status" }), { target: { value: "in_progress" } });
    fireEvent.change(inDialog().getByRole("combobox", { name: "Status" }), { target: { value: "done" } });
    expect(toaster).not.toHaveTextContent("Nice. Add a two-line summary");
  });

  it("offers Mark as earned after Not yet, and no summary toast when there is a summary", () => {
    const id = addCard(certification.id, "2026-10", "in_progress");
    renderDrawer(id);
    type(summaryField(), "Already summarized.");
    fireEvent.change(inDialog().getByRole("combobox", { name: "Status" }), { target: { value: "done" } });
    fireEvent.click(within(screen.getByRole("dialog", { name: /^Did you earn/ })).getByRole("button", { name: "Not yet" }));
    expect(item(id).earnedAt).toBeUndefined();
    expect(document.querySelector("[data-toaster]")).not.toHaveTextContent("Nice. Add");

    fireEvent.click(inDialog().getByRole("button", { name: /Mark as earned/ }));
    expect(item(id).earnedAt).toBeDefined();
  });

  it("removes the card with an undo toast, keeping its notes", () => {
    const id = addCard();
    const { onClose } = renderDrawer(id);
    type(summaryField(), "Keep this summary");

    fireEvent.click(inDialog().getByRole("button", { name: "Remove from board" }));
    expect(onClose).toHaveBeenCalled();
    expect(data().planItems.some((candidate) => candidate.id === id)).toBe(false);
    expect(findCardNote(data().notes, id, "summary")?.body).toBe("Keep this summary");

    const toaster = document.querySelector<HTMLElement>("[data-toaster]")!;
    expect(toaster).toHaveTextContent("Removed from October");
    fireEvent.click(within(toaster).getByRole("button", { name: "Undo" }));
    expect(data().planItems.some((candidate) => candidate.id === id)).toBe(true);
  });

  it("is read-only for past months except the summary, notes and review later", () => {
    const id = addCard(book.id, "2026-09", "in_progress");
    act(() => store().setReminder(id, { date: "2026-09-20", note: "Old" }));
    renderDrawer(id);

    expect(inDialog().getByText(/From September\. The card is read-only/)).toBeInTheDocument();
    expect(inDialog().queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument();
    expect(inDialog().getByText("In progress")).toBeInTheDocument();
    expect(inDialog().queryByRole("button", { name: "Remove from board" })).not.toBeInTheDocument();
    expect(inDialog().queryByRole("button", { name: "Edit skills for this card" })).not.toBeInTheDocument();
    expect(inDialog().queryByRole("button", { name: "Add a task" })).not.toBeInTheDocument();
    inDialog()
      .getAllByRole("checkbox")
      .forEach((box) => expect(box).toBeDisabled());
    expect(inDialog().queryByRole("button", { name: "Edit reminder" })).not.toBeInTheDocument();
    expect(inDialog().queryByRole("link", { name: /Set your year/ })).not.toBeInTheDocument();

    type(summaryField(), "Still learning from this");
    expect(findCardNote(data().notes, id, "summary")?.body).toBe("Still learning from this");
    type(inDialog().getByRole("textbox", { name: "Notes" }), "And this");
    expect(findCardNote(data().notes, id, "item_note")?.body).toBe("And this");
    expect(inDialog().getByRole("button", { name: /Review later/ })).toBeEnabled();
  });

  it("shows Removed material when the material is missing, with writing still editable", () => {
    const id = addCard();
    act(() =>
      useAppStore.setState((state) => ({
        data: { ...state.data, planItems: state.data.planItems.map((candidate) => ({ ...candidate, materialId: "missing" })) },
      })),
    );
    renderDrawer(id);
    expect(screen.getByRole("dialog", { name: "Removed material" })).toBeInTheDocument();
    expect(inDialog().queryByRole("button", { name: "About this material" })).not.toBeInTheDocument();
    type(summaryField(), "Still mine");
    expect(findCardNote(data().notes, id, "summary")?.body).toBe("Still mine");
  });

  it("switching cards while open saves pending typing to the first card and starts the next one fresh", async () => {
    const first = addCard();
    const second = addCard(certification.id);
    fakeAI.refine.mockResolvedValue({ strengths: ["Clear"], gaps: [], suggestions: [], improvedVersion: "Shorter." });
    const { rerender, onClose } = renderDrawer(first);
    const show = (id: string) =>
      rerender(
        <TodayContext value={TODAY}>
          <CardDetailDrawer itemId={id} onClose={onClose} />
          <Toaster />
        </TodayContext>,
      );

    type(summaryField(), "Output is not the same as outcome.");
    await act(async () => fireEvent.click(inDialog().getByRole("button", { name: "Get feedback from Claude" })));
    expect(inDialog().getByRole("region", { name: "Feedback from Claude" })).toBeInTheDocument();
    // Typing still inside the debounce window when the card changes.
    fireEvent.change(inDialog().getByRole("textbox", { name: "Notes" }), { target: { value: "Pending note" } });

    show(second);
    expect(screen.getByRole("dialog", { name: certification.title })).toBeInTheDocument();
    expect(findCardNote(data().notes, first, "item_note")?.body).toBe("Pending note");
    expect(findCardNote(data().notes, second, "item_note")).toBeUndefined();
    expect(inDialog().getByRole("textbox", { name: "Notes" })).toHaveValue("");
    expect(summaryField()).toHaveValue("");
    expect(inDialog().queryByRole("region", { name: "Feedback from Claude" })).not.toBeInTheDocument();
  });

  it("hands Write summary to the board once the drawer has closed", () => {
    const id = addCard(book.id, "2026-10", "in_progress");
    const onWriteSummary = vi.fn();
    const { rerender, onClose } = renderDrawer(id, { onWriteSummary });
    fireEvent.change(inDialog().getByRole("combobox", { name: "Status" }), { target: { value: "done" } });
    rerender(
      <TodayContext value={TODAY}>
        <CardDetailDrawer itemId={null} onClose={onClose} onWriteSummary={onWriteSummary} />
        <Toaster />
      </TodayContext>,
    );
    const toaster = document.querySelector<HTMLElement>("[data-toaster]")!;
    fireEvent.click(within(toaster).getByRole("button", { name: "Write summary" }));
    expect(onWriteSummary).toHaveBeenCalledWith(id);
  });

  it("doesn't tick a read-only card's Summarize task with its first summary", () => {
    const id = addCard(book.id, "2026-09", "in_progress");
    renderDrawer(id);
    type(summaryField(), "Written after the month ended");
    expect(findCardNote(data().notes, id, "summary")?.body).toBe("Written after the month ended");
    expect(summaryTask(item(id))?.done).toBe(false);
  });

  it("undoing Use this version restores only the text, keeping a review date set since", async () => {
    const id = addCard();
    fakeAI.refine.mockResolvedValue({ strengths: [], gaps: [], suggestions: ["Shorter"], improvedVersion: "Measure outcomes." });
    renderDrawer(id);
    type(summaryField(), "Output is not the same as outcome.");
    await act(async () => fireEvent.click(inDialog().getByRole("button", { name: "Get feedback from Claude" })));
    fireEvent.click(inDialog().getByRole("button", { name: "Use this version" }));
    const noteId = findCardNote(data().notes, id, "summary")!.id;
    act(() => store().setNoteReview(noteId, "2026-10-30"));

    const toaster = document.querySelector<HTMLElement>("[data-toaster]")!;
    fireEvent.click(within(toaster).getByRole("button", { name: "Undo" }));
    expect(findCardNote(data().notes, id, "summary")).toMatchObject({ body: "Output is not the same as outcome.", reviewAt: "2026-10-30" });
    expect(findCardNote(data().notes, id, "summary")?.refinedAt).toBeUndefined();
  });

  it("keeps a reminder note without a date pending: no Saved, a Pick a date hint, and Done doesn't drop it", () => {
    const id = addCard();
    renderDrawer(id);
    fireEvent.click(inDialog().getByRole("button", { name: "Add reminder" }));
    const note = inDialog().getByLabelText("Note (optional)");
    fireEvent.change(note, { target: { value: "Bring outcome ideas" } });
    fireEvent.blur(note);
    expect(item(id).reminder).toBeUndefined();
    expect(inDialog().getAllByRole("status").some((status) => status.textContent === "Saved")).toBe(false);
    expect(inDialog().getByText("Pick a date")).toBeInTheDocument();

    fireEvent.click(inDialog().getByRole("button", { name: "Done" }));
    const date = inDialog().getByLabelText("Date");
    expect(document.activeElement).toBe(date);
    expect(date).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(date, { target: { value: "2026-10-20" } });
    expect(item(id).reminder).toEqual({ date: "2026-10-20", note: "Bring outcome ideas" });
    fireEvent.click(inDialog().getByRole("button", { name: "Done" }));
    expect(inDialog().getByText("Oct 20")).toBeInTheDocument();
  });

  it("takes a decimal comma in the estimate", () => {
    const id = addCard();
    renderDrawer(id);
    fireEvent.click(inDialog().getByRole("button", { name: "Time (optional)" }));
    const estimate = inDialog().getByLabelText("Estimate (hours)");
    expect(estimate).toHaveAttribute("type", "text");
    fireEvent.change(estimate, { target: { value: "1,5" } });
    fireEvent.blur(estimate);
    expect(item(id).estimatedHours).toBe(1.5);
  });

  it("opens with the summary or the notes focused", () => {
    const id = addCard();
    const { unmount } = renderDrawer(id, { focus: "summary" });
    expect(document.activeElement).toBe(summaryField());
    unmount();
    renderDrawer(id, { focus: "notes" });
    expect(document.activeElement).toBe(inDialog().getByRole("textbox", { name: "Notes" }));
  });

  it("edits an own material's details with the Add-your-own form", () => {
    const materialId = store().addCustomMaterial({ title: "My talk notes", type: "custom", skillIds: [book.skillIds[0]] });
    const id = addCard(materialId);
    renderDrawer(id);
    fireEvent.click(inDialog().getByRole("button", { name: "About this material" }));
    fireEvent.click(inDialog().getByRole("button", { name: "Edit details" }));

    const form = screen.getByRole("dialog", { name: "Edit details" });
    const title = within(form).getByLabelText(/^Title/);
    expect(title).toHaveValue("My talk notes");
    fireEvent.change(title, { target: { value: "My conference talk" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save" }));

    expect(data().customMaterials[0].title).toBe("My conference talk");
    expect(screen.getByRole("dialog", { name: "My conference talk" })).toBeInTheDocument();
  });
});
