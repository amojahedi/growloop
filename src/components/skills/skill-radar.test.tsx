// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { axisSummary, SkillRadar, type SkillRadarAxis, type SkillRadarSeries } from "./skill-radar";

const axes: SkillRadarAxis[] = [
  { skillId: "roadmapping", name: "Roadmapping", color: "violet" },
  { skillId: "discovery", name: "Discovery", color: "teal" },
  { skillId: "strategy", name: "Strategy", color: "amber" },
];

const series: SkillRadarSeries[] = [
  { key: "projected", label: "Projected", values: [5, 2, 0.75], variant: "dashed" },
  { key: "completed", label: "Completed", unit: "done", values: [3.5, 1, 0], variant: "solid" },
];

beforeAll(() => {
  // jsdom has no layout or ResizeObserver; report a fixed size so Recharts draws the chart.
  globalThis.ResizeObserver = class {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) {
      this.callback = callback;
    }
    observe(target: Element) {
      this.callback([{ target, contentRect: { width: 400, height: 280 } } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  };
});
afterEach(cleanup);

describe("SkillRadar", () => {
  it("lists every value in a hidden table for screen readers", () => {
    render(<SkillRadar axes={axes} series={series} title="Skill impact, October 2026" />);

    const table = screen.getByRole("table", { name: "Skill impact, October 2026" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual([
      "Skill",
      "Projected",
      "Completed",
    ]);
    expect(within(table).getByRole("row", { name: /Roadmapping/ })).toHaveTextContent("Roadmapping53.5");
    expect(within(table).getByRole("row", { name: /Strategy/ })).toHaveTextContent("Strategy0.750");
  });

  it("shows a legend when there is more than one series", () => {
    const { rerender } = render(<SkillRadar axes={axes} series={series} title="Radar" />);
    expect(screen.getByRole("list")).toHaveTextContent("ProjectedCompleted");

    rerender(<SkillRadar axes={axes} series={series.slice(1)} title="Radar" />);
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("labels each axis with the skill name in the skill's color", () => {
    const { container } = render(<SkillRadar axes={axes} series={series} title="Radar" />);
    const label = [...container.querySelectorAll("text")].find((text) => text.textContent === "Roadmapping");

    expect(label).toBeDefined();
    expect(label?.getAttribute("style")).toContain("--skill-violet");
  });

  it("makes axis labels buttons when asked, by click and keyboard", () => {
    const onAxisClick = vi.fn();
    const { rerender } = render(<SkillRadar axes={axes} series={series} title="Radar" />);
    expect(screen.queryByRole("button", { name: "Open Roadmapping" })).toBeNull();

    rerender(<SkillRadar axes={axes} series={series} title="Radar" onAxisClick={onAxisClick} />);
    const axis = screen.getByRole("button", { name: "Open Roadmapping" });
    expect(axis).toHaveAttribute("tabindex", "0");
    fireEvent.click(axis);
    expect(onAxisClick).toHaveBeenLastCalledWith("roadmapping");

    fireEvent.keyDown(screen.getByRole("button", { name: "Open Strategy" }), { key: "Enter" });
    expect(onAxisClick).toHaveBeenLastCalledWith("strategy");
    fireEvent.keyDown(screen.getByRole("button", { name: "Open Discovery" }), { key: " " });
    expect(onAxisClick).toHaveBeenLastCalledWith("discovery");
    expect(onAxisClick).toHaveBeenCalledTimes(3);
  });

  it("summarizes an axis for the tooltip", () => {
    expect(axisSummary(axes[0], 0, series)).toBe("Roadmapping: 5 projected · 3.5 done");
  });
});
