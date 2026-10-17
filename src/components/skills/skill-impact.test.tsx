// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useAppStore } from "@/lib/store/app-store";
import { emptyWorkspace } from "@/lib/store/seed";
import { makeSkill } from "@/lib/testing/fixtures";
import { SkillImpact } from "./skill-impact";

beforeEach(() =>
  useAppStore.setState({
    data: {
      ...emptyWorkspace(),
      skills: [makeSkill({ id: "discovery", name: "Discovery" }), makeSkill({ id: "roadmapping", name: "Roadmapping" })],
    },
  }),
);
afterEach(cleanup);

describe("SkillImpact", () => {
  it("lists each skill with a spoken strength, primary first", () => {
    render(<SkillImpact material={{ skillIds: ["discovery", "roadmapping"], estimatedHours: 25 }} />);
    expect(screen.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "Discovery: strong impact (2)",
      "Roadmapping: moderate impact (1)",
    ]);
  });

  it("renders nothing for untagged materials", () => {
    const { container } = render(<SkillImpact material={{ skillIds: [] }} />);
    expect(container).toBeEmptyDOMElement();
  });
});
