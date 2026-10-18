// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dismissToast, toast, Toaster } from "./toast";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  act(() => dismissToast());
  cleanup();
  vi.useRealTimers();
});

describe("Toaster", () => {
  it("announces a toast politely and hides it after 6 s", () => {
    render(<Toaster />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-live", "polite");

    act(() => toast({ message: "Back to your own data." }));
    expect(region).toHaveTextContent("Back to your own data.");

    act(() => vi.advanceTimersByTime(5_999));
    expect(region).toHaveTextContent("Back to your own data.");
    act(() => vi.advanceTimersByTime(1));
    expect(region).toBeEmptyDOMElement();
  });

  it("runs an action such as Undo once, and keeps toasts with an action for 8 s", () => {
    const undo = vi.fn();
    render(<Toaster />);
    act(() => toast({ message: "Removed from October", action: { label: "Undo", onClick: undo } }));

    act(() => vi.advanceTimersByTime(7_000));
    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(undo).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Removed from October")).not.toBeInTheDocument();
  });

  it("shows one toast at a time: a new one replaces the old", () => {
    render(<Toaster />);
    act(() => toast({ message: "First" }));
    act(() => vi.advanceTimersByTime(4_000));
    act(() => toast({ message: "Second" }));

    expect(screen.queryByText("First")).not.toBeInTheDocument();
    // The new toast gets its own full duration.
    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("waits while the pointer or focus is on the toast", () => {
    render(<Toaster />);
    act(() => toast({ message: "Saved" }));
    const message = screen.getByText("Saved");

    fireEvent.mouseEnter(message.parentElement!);
    act(() => vi.advanceTimersByTime(10_000));
    expect(screen.getByText("Saved")).toBeInTheDocument();

    fireEvent.mouseLeave(message.parentElement!);
    act(() => vi.advanceTimersByTime(6_000));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("can be dismissed", () => {
    render(<Toaster />);
    act(() => toast({ message: "Saved" }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });
});
