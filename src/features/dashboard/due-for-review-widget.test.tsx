// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { useAppStore } from "@/lib/store/app-store";
import { TodayContext } from "@/lib/store/hooks";
import { emptyWorkspace } from "@/lib/store/seed";
import { makeNote } from "@/lib/testing/fixtures";
import { DueForReviewWidget } from "./due-for-review-widget";
import { ReflectionsFeed } from "./reflections-feed";

const TODAY = "2026-10-18";
const book = CURATED_MATERIALS[0];

function renderWith(node: React.ReactNode) {
  return render(<TodayContext value={TODAY}>{node}</TodayContext>);
}

beforeEach(() => useAppStore.setState({ data: emptyWorkspace() }));
afterEach(cleanup);

describe("Due for review widget", () => {
  it("shows the empty copy", () => {
    renderWith(<DueForReviewWidget />);
    expect(screen.getByRole("heading", { name: "Due for review" })).toBeInTheDocument();
    expect(screen.getByText("Nothing to review. Mark a note Review later to see it here.")).toBeInTheDocument();
  });

  it("lists the 3 oldest due notes with links, then n more to the Due filter", () => {
    const notes = [
      makeNote({ id: "today", kind: "free", title: "Questions for my 1:1", reviewAt: "2026-10-18" }),
      makeNote({ id: "yesterday", kind: "summary", materialId: book.id, planItemId: "i1", body: "x", reviewAt: "2026-10-17" }),
      makeNote({ id: "oldest", kind: "item_note", materialId: book.id, planItemId: "i1", body: "y", reviewAt: "2026-10-12" }),
      makeNote({ id: "fourth", kind: "free", title: "Fourth", reviewAt: "2026-10-18", updatedAt: "2026-09-01T00:00:00.000Z" }),
      makeNote({ id: "later", kind: "free", title: "Not yet", reviewAt: "2026-10-25" }),
      makeNote({ id: "empty", kind: "summary", planItemId: "i2", body: "", reviewAt: "2026-10-01" }),
    ];
    useAppStore.setState((state) => ({ data: { ...state.data, notes } }));
    renderWith(<DueForReviewWidget />);

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent(`${book.title}Note · Due Oct 12`);
    expect(within(items[0]).getByRole("link")).toHaveAttribute("href", "/notebook?note=oldest");
    expect(items[1]).toHaveTextContent("Summary · Due yesterday");
    expect(items[2]).toHaveTextContent("Questions for my 1:1Note · Due today");
    expect(screen.getByRole("link", { name: "1 more" })).toHaveAttribute("href", "/notebook?due=1");
  });
});

describe("Notes & summaries widget", () => {
  it("reads the latest notes of every kind, each opening in the Notebook", () => {
    const notes = [
      makeNote({ id: "s", kind: "summary", materialId: book.id, planItemId: "i1", body: "See https://svpg.com for more", updatedAt: "2026-10-17T00:00:00.000Z" }),
      makeNote({ id: "f", kind: "free", title: "Ideas", body: "Plain", updatedAt: "2026-10-16T00:00:00.000Z" }),
    ];
    useAppStore.setState((state) => ({ data: { ...state.data, notes } }));
    renderWith(<ReflectionsFeed />);

    expect(screen.getByRole("link", { name: book.title })).toHaveAttribute("href", "/notebook?note=s");
    expect(screen.getByRole("link", { name: "Ideas" })).toHaveAttribute("href", "/notebook?note=f");
    expect(screen.getByRole("link", { name: "https://svpg.com" })).toHaveAttribute("target", "_blank");
    expect(screen.getByRole("link", { name: "View all" })).toHaveAttribute("href", "/notebook");
  });

  it("shows the empty copy", () => {
    renderWith(<ReflectionsFeed />);
    expect(screen.getByText("Summaries you write land here.")).toBeInTheDocument();
  });
});
