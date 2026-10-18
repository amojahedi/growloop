// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import NotFound from "@/app/not-found";
import { GUIDE } from "@/content/help/guide";
import { GuideView, parseEmphasis } from "./guide-view";
import { useTourStore } from "./tour-store";

afterEach(cleanup);

describe("parseEmphasis", () => {
  it("bolds **marked** words and leaves everything else as text", () => {
    expect(parseEmphasis("**Add** puts it on the board. <b>no</b>")).toEqual([
      { text: "Add", bold: true },
      { text: " puts it on the board. <b>no</b>", bold: false },
    ]);
  });
});

describe("GuideView", () => {
  it("renders the eight sections from data, with the loop and working links", () => {
    render(<GuideView guide={GUIDE} />);
    expect(screen.getByRole("heading", { level: 1, name: "How Growloop works" })).toBeInTheDocument();
    expect(screen.getByText("A growth loop for yourself: plan, learn, reflect, repeat.")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "1. The loop",
      "2. Set your year",
      "3. Plan the month",
      "4. Learn and reflect",
      "5. Wrap up the month",
      "6. Skills and the radar",
      "7. Claude (optional)",
      "8. Your data",
    ]);

    const loop = screen.getByRole("region", { name: "1. The loop" });
    expect(within(loop).getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")])).toEqual([
      ["Set your year", "/okrs"],
      ["Find something", "/library"],
      ["Plan the month", "/board"],
      ["Learn", "/board"],
      ["Summarize", "/notebook"],
      ["Wrap up the month", "/board"],
    ]);
    expect(screen.getByText("The year gives direction. The month is the rhythm.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Plan my year" })).toHaveAttribute("href", "/okrs/plan");
    expect(screen.getByRole("link", { name: "Turn on Claude" })).toHaveAttribute("href", "/settings#claude");
    expect(screen.getByRole("link", { name: "Settings → Your data" })).toHaveAttribute("href", "/settings#data");
    expect(screen.getByText("Add", { selector: "strong" })).toBeInTheDocument();
  });

  it("ends with Take the tour", () => {
    useTourStore.setState({ status: "idle" });
    render(<GuideView guide={GUIDE} />);
    fireEvent.click(screen.getByRole("button", { name: "Take the tour" }));
    expect(useTourStore.getState().status).toBe("pending");
  });
});

describe("NotFound", () => {
  it("says the page doesn't exist and links to the dashboard", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { name: "This page doesn't exist." })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to your dashboard" })).toHaveAttribute("href", "/");
  });
});
