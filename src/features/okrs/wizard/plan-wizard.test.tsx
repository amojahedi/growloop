// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster, dismissToast } from "@/components/ui/toast";
import { AIRequestError } from "@/lib/ai/request-error";
import type { PlanDraft } from "@/lib/domain/plan-draft";
import { makeObjective } from "@/lib/testing/fixtures";
import { useAppStore } from "@/lib/store/app-store";
import { TodayContext } from "@/lib/store/hooks";
import { emptyWorkspace } from "@/lib/store/seed";
import { useUIStore } from "@/lib/store/ui-store";
import { PlanWizard } from "./plan-wizard";

const router = vi.hoisted(() => ({ push: vi.fn(), back: vi.fn(), replace: vi.fn() }));
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => search.params,
  usePathname: () => "/okrs/plan",
}));

/** Claude is mocked: no test makes a real call. */
const ai = vi.hoisted(() => ({
  provider: null as "key" | "local" | null,
  status: { state: "unavailable" } as { state: string },
  draftPlan: { run: vi.fn(), reset: vi.fn(), lastError: vi.fn() },
}));
vi.mock("@/lib/ai/use-ai", () => ({ useAI: () => ai }));

const TODAY = "2026-10-18";

function renderWizard() {
  return render(
    <TodayContext value={TODAY}>
      <PlanWizard />
      <Toaster />
    </TodayContext>,
  );
}

const click = (element: HTMLElement) => fireEvent.click(element);
const radio = (name: string) => screen.getByRole("radio", { name });

function answerStepOne() {
  click(radio("Product Manager"));
  click(radio("A promotion"));
  click(screen.getByRole("button", { name: "Next" }));
}

function pickSkills(...names: string[]) {
  for (const name of names) click(screen.getByRole("checkbox", { name }));
}

function setLevel(skill: string, which: "Now" | "Goal", value: number) {
  const group = screen.getByRole("group", { name: `${which} for ${skill}` });
  click(within(group).getByRole("radio", { name: new RegExp(`^${value},`) }));
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  useAppStore.setState({ data: emptyWorkspace() });
  useUIStore.getState().resetWizard();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 18, 12));
  router.push.mockReset();
  router.back.mockReset();
  search.params = new URLSearchParams();
  ai.provider = null;
  ai.status = { state: "unavailable" };
  ai.draftPlan.run.mockReset();
  ai.draftPlan.reset.mockReset();
  ai.draftPlan.lastError.mockReset();
});

afterEach(() => {
  act(() => dismissToast());
  cleanup();
  vi.useRealTimers();
});

describe("PlanWizard: questions", () => {
  it("asks role and goal first, with years from the scope; Next waits for both", () => {
    renderWizard();
    expect(screen.getByRole("heading", { level: 1, name: "Set your year" })).toBeInTheDocument();
    expect(
      screen.getByText("Two quick questions, then a draft plan for the rest of 2026 and 2027. You can change everything."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Where are you now?" })).toBeInTheDocument();

    const next = screen.getByRole("button", { name: "Next" });
    expect(next).toBeDisabled();
    click(radio("Senior PM"));
    expect(next).toBeDisabled();
    click(radio("Something else"));
    // "Something else" needs a few words.
    expect(next).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Your goal, in a few words" }), { target: { value: "Lead a platform team" } });
    expect(next).toBeEnabled();
  });

  it("offers the CV box only when Claude is available", () => {
    const { unmount } = renderWizard();
    expect(screen.queryByText("Add your LinkedIn or CV")).not.toBeInTheDocument();
    unmount();

    ai.provider = "key";
    ai.status = { state: "available" };
    renderWizard();
    expect(screen.getByText("Add your LinkedIn or CV")).toBeInTheDocument();
    expect(screen.getByText("Claude reads it once for this draft. It isn't saved.")).toBeInTheDocument();
  });

  it("asks for 2 to 4 skills with Now and Goal levels", () => {
    renderWizard();
    answerStepOne();
    expect(screen.getByRole("heading", { name: "What do you want to grow?" })).toBeInTheDocument();
    const draft = screen.getByRole("button", { name: "Draft my plan" });
    expect(draft).toBeDisabled();

    pickSkills("Roadmapping");
    expect(screen.getByText("Pick at least one more.")).toBeInTheDocument();
    // Defaults: Now 2, Goal 4.
    expect(within(screen.getByRole("group", { name: "Now for Roadmapping" })).getByRole("radio", { name: "2, Learning" })).toBeChecked();
    expect(within(screen.getByRole("group", { name: "Goal for Roadmapping" })).getByRole("radio", { name: "4, Strong" })).toBeChecked();

    pickSkills("Prioritization", "Communication", "Leadership");
    expect(screen.getByText("Four is plenty for a year.")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Product Strategy" })).toBeDisabled();
    expect(draft).toBeEnabled();

    setLevel("Leadership", "Now", 4);
    expect(screen.getByText("Set a goal above where you are.")).toBeInTheDocument();
    expect(draft).toBeDisabled();
    setLevel("Leadership", "Goal", 5);
    expect(screen.queryByText("Set a goal above where you are.")).not.toBeInTheDocument();
    expect(useUIStore.getState().wizard.skills.map((s) => s.skillId)).toEqual(["roadmapping", "prioritization", "communication", "leadership"]);
  });

  it("prefills answers and levels from the saved profile", () => {
    useAppStore.getState().updateProfile({ role: "lead_pm", goal: "leadership" });
    useAppStore.getState().setSkillLevel("roadmapping", { current: 3, target: 5 });
    renderWizard();
    expect(radio("Lead or Group PM")).toBeChecked();
    expect(radio("A step into leadership")).toBeChecked();
    click(screen.getByRole("button", { name: "Next" }));
    pickSkills("Roadmapping");
    expect(within(screen.getByRole("group", { name: "Now for Roadmapping" })).getByRole("radio", { name: "3, Capable" })).toBeChecked();
  });

  it("says so when every quarter in the window already has an objective", () => {
    const quarters = ["2026-Q4", "2027-Q1", "2027-Q2", "2027-Q3", "2027-Q4"];
    useAppStore.setState({ data: { ...emptyWorkspace(), objectives: quarters.map((quarter) => makeObjective({ quarter })) } });
    renderWizard();
    expect(screen.getByText("Every quarter through 2027 already has an objective.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to OKRs" })).toHaveAttribute("href", "/okrs");
  });

  it("cancels to the previous page, or to the Dashboard from the first-launch screen", () => {
    search.params = new URLSearchParams("from=welcome");
    renderWizard();
    click(screen.getByRole("button", { name: "Cancel" }));
    expect(router.push).toHaveBeenCalledWith("/");
  });
});

function draftQuickly() {
  answerStepOne();
  pickSkills("Product Discovery", "Roadmapping");
  setLevel("Roadmapping", "Now", 1);
  click(screen.getByRole("button", { name: "Draft my plan" }));
}

describe("PlanWizard: quick draft and review", () => {
  it("drafts instantly without Claude and reviews it in quarter columns", () => {
    renderWizard();
    draftQuickly();
    expect(screen.getByRole("heading", { level: 1, name: "Your draft for 2026–2027" })).toBeInTheDocument();
    expect(screen.getByText("Biggest gaps first: Roadmapping, then Product Discovery.")).toBeInTheDocument();
    expect(screen.getByText(/Quick draft from your answers\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Turn on Claude" })).toHaveAttribute("href", "/settings#claude");
    expect(screen.getAllByRole("article")).toHaveLength(5);
    expect(screen.getAllByRole("textbox", { name: "Objective" }).map((field) => (field as HTMLTextAreaElement).value)).toEqual([
      "Lead roadmap conversations with confidence",
      "Make customer discovery a weekly habit",
      "Run an outcome-based roadmap",
      "Test ideas before they cost engineering time",
      "Keep growing in Roadmapping",
    ]);
    expect(ai.draftPlan.run).not.toHaveBeenCalled();
    // Nothing is saved yet.
    expect(useAppStore.getState().data.objectives).toEqual([]);
  });

  it("saves nothing while problems remain, names how many, and focuses the first", async () => {
    renderWizard();
    draftQuickly();
    click(screen.getByRole("button", { name: "Add objective to Q4 2026" }));
    const accept = screen.getByRole("button", { name: "Fix 4 things to accept" });
    click(accept);
    expect(useAppStore.getState().data.objectives).toEqual([]);
    expect(screen.getByText("Give it a title.")).toBeInTheDocument();
    expect(screen.getAllByText("Pick a skill.")).toHaveLength(2);
    await waitFor(() => expect(document.activeElement).toHaveAccessibleName("Objective"));
    expect((document.activeElement as HTMLTextAreaElement).value).toBe("");
  });

  it("removes an objective with Undo and keeps 2-3 KRs per objective", () => {
    renderWizard();
    draftQuickly();
    const first = screen.getAllByRole("article")[0];
    const remove = within(first).getByRole("button", { name: "Remove key result 1" });
    expect(remove).toHaveAttribute("aria-disabled", "true");
    click(remove);
    expect(within(first).getAllByRole("listitem", { name: /Key result/ })).toHaveLength(2);
    click(within(first).getByRole("button", { name: "Key result" }));
    expect(within(first).getAllByRole("listitem", { name: /Key result/ })).toHaveLength(3);
    expect(within(first).queryByRole("button", { name: "Key result" })).not.toBeInTheDocument();
  });

  it("Accept all saves the plan, lands on the first year and can be undone", () => {
    renderWizard();
    draftQuickly();
    click(screen.getByRole("button", { name: "Accept all" }));

    const { data } = useAppStore.getState();
    expect(data.objectives).toHaveLength(5);
    expect(data.objectives.every((o) => o.source === "quick" && o.status === "active")).toBe(true);
    expect(data.profile).toMatchObject({ role: "pm", goal: "promotion" });
    expect(data.profile.skillLevels.map((l) => [l.skillId, l.current, l.target])).toEqual([
      ["product-discovery", 2, 4],
      ["roadmapping", 1, 4],
    ]);
    // Only the current quarter's material KR gets a Backlog card, linked.
    expect(data.planItems).toHaveLength(1);
    expect(data.planItems[0]).toMatchObject({ status: "backlog", keyResultId: data.objectives[0].keyResults[0].id });
    expect(data.savedMaterialIds.length).toBeGreaterThan(0);
    expect(router.push).toHaveBeenCalledWith("/okrs?year=2026");
    expect(screen.getByText("Your year is set. 5 objectives saved.")).toBeInTheDocument();
    expect(useUIStore.getState().wizard.step).toBe("answers");

    click(screen.getByRole("button", { name: "Undo" }));
    const after = useAppStore.getState().data;
    expect(after.objectives).toEqual([]);
    expect(after.planItems).toEqual([]);
    expect(after.savedMaterialIds).toEqual([]);
    expect(after.profile.skillLevels).toEqual([]);
    // The review comes back if the wizard is opened again.
    expect(useUIStore.getState().wizard.step).toBe("review");
  });

  it("goes Back keeping the draft, and replaces it only when the answers change", () => {
    renderWizard();
    draftQuickly();
    fireEvent.change(screen.getAllByRole("textbox", { name: "Objective" })[0], { target: { value: "My own title" } });
    click(screen.getByRole("button", { name: "Back" }));
    click(screen.getByRole("button", { name: "Draft my plan" }));
    expect(screen.getAllByRole("textbox", { name: "Objective" })[0]).toHaveValue("My own title");
    expect(screen.queryByText("New draft ready.")).not.toBeInTheDocument();

    click(screen.getByRole("button", { name: "Back" }));
    setLevel("Product Discovery", "Goal", 5);
    click(screen.getByRole("button", { name: "Draft my plan" }));
    expect(screen.getAllByRole("textbox", { name: "Objective" })[0]).not.toHaveValue("My own title");
    expect(screen.getByText("New draft ready.")).toBeInTheDocument();
  });
});

describe("PlanWizard: Claude", () => {
  beforeEach(() => {
    ai.provider = "key";
    ai.status = { state: "available" };
  });

  function answerAll(cv = "") {
    answerStepOne();
    pickSkills("Roadmapping", "Product Discovery");
    if (cv) {
      click(screen.getByRole("button", { name: "Back" }));
      fireEvent.change(screen.getByRole("textbox", { name: "Your LinkedIn or CV" }), { target: { value: cv } });
      click(screen.getByRole("button", { name: "Next" }));
    }
  }

  it("sends the answers (and the CV, used once and never stored), then repairs Claude's draft for review", async () => {
    const draft: PlanDraft = {
      rationale: "Roadmaps first, because your goal is a promotion.",
      objectives: [
        {
          quarter: "2027-Q1",
          title: "Own the roadmap story",
          why: "Builds your case.",
          keyResults: [{ skillId: "roadmapping", type: "material", materialId: "invented-id", title: "Finish a made-up book" }],
        },
        { quarter: "2031-Q1", title: "Out of scope", why: "", keyResults: [] },
      ],
    };
    ai.draftPlan.run.mockResolvedValue(draft);
    renderWizard();
    answerAll("Ten years in fintech, CSPO.");
    click(screen.getByRole("button", { name: "Draft with Claude" }));

    expect(ai.draftPlan.run).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "pm",
        goal: "promotion",
        context: "Ten years in fintech, CSPO.",
        quarters: ["2026-Q4", "2027-Q1", "2027-Q2", "2027-Q3", "2027-Q4"],
      }),
    );
    await screen.findByText("Roadmaps first, because your goal is a promotion.");
    expect(screen.queryByText(/Quick draft from your answers/)).not.toBeInTheDocument();
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(1);
    // The invented material became a count KR, and a second KR was added.
    expect(within(articles[0]).getAllByRole("group", { name: "Number of items" })).toHaveLength(2);
    expect(sessionStorage.getItem("growloop:wizard")).not.toContain("fintech");

    click(screen.getByRole("button", { name: "Accept all" }));
    expect(useAppStore.getState().data.objectives[0]).toMatchObject({ source: "claude", title: "Own the roadmap story" });
    expect(JSON.stringify(useAppStore.getState().data)).not.toContain("fintech");
  });

  it("shows the drafting state with a way out to the quick draft", async () => {
    let resolve!: (value: PlanDraft | undefined) => void;
    ai.draftPlan.run.mockReturnValue(new Promise((r) => (resolve = r)));
    renderWizard();
    answerAll();
    click(screen.getByRole("button", { name: "Draft with Claude" }));
    expect(screen.getByText("Claude is drafting your plan. This can take up to a minute.")).toBeInTheDocument();

    click(screen.getByRole("button", { name: "Use the quick draft instead" }));
    expect(ai.draftPlan.reset).toHaveBeenCalled();
    expect(screen.getByText(/Quick draft from your answers\./)).toBeInTheDocument();
    // The cancelled request resolves with nothing and changes nothing.
    await act(async () => resolve(undefined));
    expect(screen.getByText(/Quick draft from your answers\./)).toBeInTheDocument();
  });

  it("explains a failure with the reason when known, and offers Try again and the quick draft", async () => {
    ai.draftPlan.run.mockResolvedValue(undefined);
    ai.draftPlan.lastError.mockReturnValue(new AIRequestError("Your Claude key was rejected. Check it in Settings.", "key-rejected"));
    renderWizard();
    answerAll();
    click(screen.getByRole("button", { name: "Draft with Claude" }));

    expect(await screen.findByText("Claude couldn't draft a plan this time.")).toBeInTheDocument();
    expect(screen.getByText("Your Claude key was rejected. Check it in Settings.")).toBeInTheDocument();
    click(screen.getByRole("button", { name: "Try again" }));
    expect(ai.draftPlan.run).toHaveBeenCalledTimes(2);
    await screen.findByText("Claude couldn't draft a plan this time.");
    click(screen.getByRole("button", { name: "Use the quick draft" }));
    expect(screen.getByText(/Quick draft from your answers\./)).toBeInTheDocument();
    // Answers are never lost.
    expect(useUIStore.getState().wizard).toMatchObject({ role: "pm", goal: "promotion" });
  });

  it("treats a draft that can't be repaired as a failure", async () => {
    ai.draftPlan.run.mockResolvedValue({ rationale: "", objectives: [{ quarter: "2030-Q1", title: "Nope", why: "", keyResults: [] }] });
    renderWizard();
    answerAll();
    click(screen.getByRole("button", { name: "Draft with Claude" }));
    expect(await screen.findByText("Claude couldn't draft a plan this time.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("waits for Claude's status when Draft is clicked while it's being checked", async () => {
    ai.provider = null;
    ai.status = { state: "checking" };
    ai.draftPlan.run.mockResolvedValue(undefined);
    const { rerender } = renderWizard();
    answerAll();
    const button = screen.getByRole("button", { name: "Draft my plan" });
    expect(button).toHaveAttribute("aria-busy", "true");
    click(button);
    expect(ai.draftPlan.run).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "What do you want to grow?" })).toBeInTheDocument();

    ai.provider = "local";
    ai.status = { state: "available" };
    rerender(
      <TodayContext value={TODAY}>
        <PlanWizard />
        <Toaster />
      </TodayContext>,
    );
    await waitFor(() => expect(ai.draftPlan.run).toHaveBeenCalledTimes(1));
  });
});
