// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NoteEditor } from "./note-editor";
import { AUTOSAVE_DELAY_MS, SAVED_VISIBLE_MS } from "./use-autosave";

/** A tiny "store" so the editor sees its own saves echoed back, like the real one. */
function Harness({ onSave, initial = "" }: { onSave: (body: string) => void; initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <NoteEditor
        label="In my words"
        value={value}
        placeholder="What's the one idea?"
        onSave={(body) => {
          onSave(body);
          setValue(body);
        }}
      />
      <button type="button" onClick={() => setValue("Replaced from outside")}>
        Replace
      </button>
      <button type="button" onClick={() => setValue("first")}>
        Restore first
      </button>
    </>
  );
}

const field = () => screen.getByRole("textbox", { name: "In my words" });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("NoteEditor", () => {
  it("autosaves after a pause and shows a quiet Saved for 1.5 s", () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);
    expect(field()).toHaveAttribute("placeholder", "What's the one idea?");

    fireEvent.change(field(), { target: { value: "Out" } });
    fireEvent.change(field(), { target: { value: "Outcomes" } });
    act(() => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS - 1));
    expect(onSave).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1));
    expect(onSave).toHaveBeenCalledExactlyOnceWith("Outcomes");
    expect(screen.getByRole("status")).toHaveTextContent("Saved");

    act(() => vi.advanceTimersByTime(SAVED_VISIBLE_MS));
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("saves pending text on blur and when it unmounts", () => {
    const onSave = vi.fn();
    const { unmount } = render(<Harness onSave={onSave} />);

    fireEvent.change(field(), { target: { value: "On blur" } });
    fireEvent.blur(field());
    expect(onSave).toHaveBeenLastCalledWith("On blur");

    fireEvent.change(field(), { target: { value: "On close" } });
    unmount();
    expect(onSave).toHaveBeenLastCalledWith("On close");
    expect(onSave).toHaveBeenCalledTimes(2);
  });

  it("follows outside changes, including an undo back to text it saved", () => {
    render(<Harness onSave={() => {}} />);
    fireEvent.change(field(), { target: { value: "first" } });
    act(() => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(field()).toHaveValue("first");

    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(field()).toHaveValue("Replaced from outside");

    fireEvent.click(screen.getByRole("button", { name: "Restore first" }));
    expect(field()).toHaveValue("first");
  });

  it("keeps unsaved typing over an outside change, and stores it next", () => {
    const saves: string[] = [];
    render(<Harness onSave={(body) => saves.push(body)} />);
    fireEvent.change(field(), { target: { value: "Typing in progress" } });
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));
    expect(field()).toHaveValue("Typing in progress");
    act(() => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(saves).toEqual(["Typing in progress"]);
    expect(field()).toHaveValue("Typing in progress");
  });

  it("keeps typing that is newer than the save being echoed back", () => {
    const saves: string[] = [];
    render(<Harness onSave={(body) => saves.push(body)} />);
    fireEvent.change(field(), { target: { value: "abc" } });
    act(() => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    fireEvent.change(field(), { target: { value: "abcd" } });
    expect(field()).toHaveValue("abcd");
    act(() => vi.advanceTimersByTime(AUTOSAVE_DELAY_MS));
    expect(saves).toEqual(["abc", "abcd"]);
  });
});
