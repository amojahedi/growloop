// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster, dismissToast } from "@/components/ui/toast";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { STORAGE_KEY, useAppStore } from "@/lib/store/app-store";
import { clearDevicePreferences, readDevicePreferences, updateDevicePreferences } from "@/lib/store/device";
import { emptyWorkspace } from "@/lib/store/seed";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/board", useRouter: () => ({ push: navigation.push }) }));

const { FirstLaunch, shouldShowFirstLaunch } = await import("./first-launch");

async function renderFirstLaunch() {
  await act(async () => {
    await useAppStore.persist.rehydrate();
  });
  return render(
    <>
      <main id="content" tabIndex={-1}>
        <button type="button">Page</button>
      </main>
      <FirstLaunch />
      <Toaster />
    </>,
  );
}

beforeEach(() => {
  localStorage.clear();
  clearDevicePreferences();
  navigation.push.mockReset();
  useAppStore.persist.setOptions({ name: STORAGE_KEY });
  useAppStore.setState({ data: emptyWorkspace() });
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 18, 12));
});

afterEach(() => {
  act(() => dismissToast());
  if (useAppStore.getState().data.planItems.length) act(() => void useAppStore.getState().exitSampleMode());
  cleanup();
  vi.useRealTimers();
});

describe("shouldShowFirstLaunch", () => {
  const ready = { hydrated: true, workspaceEmpty: true };
  it("shows once per device, for an empty workspace, outside sample mode", () => {
    expect(shouldShowFirstLaunch({}, ready)).toBe(true);
    expect(shouldShowFirstLaunch({ welcomeDoneAt: "x" }, ready)).toBe(false);
    expect(shouldShowFirstLaunch({}, { ...ready, workspaceEmpty: false })).toBe(false);
    expect(shouldShowFirstLaunch({ sampleMode: true }, ready)).toBe(false);
    expect(shouldShowFirstLaunch(null, ready)).toBe(false);
    expect(shouldShowFirstLaunch({}, { ...ready, hydrated: false })).toBe(false);
  });
});

describe("FirstLaunch", () => {
  it("is a modal labelled by its heading, with focus on Set your year, and asks no questions", async () => {
    await renderFirstLaunch();
    const dialog = screen.getByRole("dialog", { name: "Grow on purpose, a month at a time." });
    expect(dialog).toHaveAccessibleDescription("Set a few goals for the year, learn a little each month, and keep what sticks.");
    expect(screen.getByRole("button", { name: "Set your year" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Try sample data" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip for now" })).toBeInTheDocument();
    expect(screen.getByText("No account. Your data stays in this browser.")).toBeInTheDocument();
    expect(dialog.querySelector("input, textarea, select")).toBeNull();
  });

  it("Set your year opens the wizard and remembers the choice", async () => {
    await renderFirstLaunch();
    fireEvent.click(screen.getByRole("button", { name: "Set your year" }));
    expect(navigation.push).toHaveBeenCalledWith("/okrs/plan");
    expect(readDevicePreferences().welcomeDoneAt).toBe(new Date(2026, 9, 18, 12).toISOString());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Try sample data enters sample mode and lands on the Dashboard", async () => {
    await renderFirstLaunch();
    const own = localStorage.getItem(STORAGE_KEY);
    fireEvent.click(screen.getByRole("button", { name: "Try sample data" }));
    expect(readDevicePreferences()).toMatchObject({ sampleMode: true, welcomeDoneAt: expect.any(String) });
    expect(useAppStore.getState().data.planItems.length).toBeGreaterThan(0);
    expect(navigation.push).toHaveBeenCalledWith("/");
    // growloop:data is untouched, byte for byte.
    expect(localStorage.getItem(STORAGE_KEY)).toBe(own);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Skip for now and Esc close it, stay on the page and give focus to the page", async () => {
    await renderFirstLaunch();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(readDevicePreferences().welcomeDoneAt).toBeDefined();
    expect(navigation.push).not.toHaveBeenCalled();

    cleanup();
    clearDevicePreferences();
    await renderFirstLaunch();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(readDevicePreferences().welcomeDoneAt).toBeDefined();
    // The dialog hands focus back on the next tick.
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));
    expect(document.getElementById("content")).toHaveFocus();
  });

  it("is never shown on a device with workspace data, even without welcomeDoneAt", async () => {
    await renderFirstLaunch();
    act(() => void useAppStore.getState().saveMaterial(CURATED_MATERIALS[0].id));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("is not shown while another tab has sample mode on", async () => {
    updateDevicePreferences({ sampleMode: true });
    await renderFirstLaunch();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    updateDevicePreferences({ sampleMode: undefined });
  });

  it("keeps its device preferences out of exports", async () => {
    await renderFirstLaunch();
    fireEvent.click(screen.getByRole("button", { name: "Skip for now" }));
    const exported = useAppStore.getState().exportData();
    expect(exported).not.toContain("welcomeDoneAt");
    expect(exported).not.toContain("tourSeenAt");
  });
});
