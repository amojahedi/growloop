// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster, dismissToast } from "@/components/ui/toast";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { SAMPLE_STORAGE_KEY, STORAGE_KEY, useAppStore } from "@/lib/store/app-store";
import { clearDevicePreferences, DEVICE_STORAGE_KEY, readDevicePreferences } from "@/lib/store/device";
import { emptyWorkspace } from "@/lib/store/seed";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/board", useRouter: () => ({ push: navigation.push }) }));

const { exitSampleLabel, SampleBanner, storedOwnWorkspaceHasData } = await import("./sample-banner");

const store = () => useAppStore.getState();

function renderBanner() {
  return render(
    <>
      <SampleBanner />
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
  cleanup();
  vi.useRealTimers();
});

describe("storedOwnWorkspaceHasData", () => {
  it("reads the own workspace from storage", () => {
    localStorage.removeItem(STORAGE_KEY);
    expect(storedOwnWorkspaceHasData()).toBe(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { data: emptyWorkspace() }, version: 4 }));
    expect(storedOwnWorkspaceHasData()).toBe(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { data: { ...emptyWorkspace(), savedMaterialIds: ["x"] } }, version: 4 }));
    expect(storedOwnWorkspaceHasData()).toBe(true);
    localStorage.setItem(STORAGE_KEY, "{broken");
    expect(storedOwnWorkspaceHasData()).toBe(true);
  });

  it("names the action after what's waiting", () => {
    expect(exitSampleLabel(false)).toBe("Start fresh");
    expect(exitSampleLabel(true)).toBe("Back to my data");
  });
});

describe("SampleBanner", () => {
  it("shows nothing outside sample mode", () => {
    renderBanner();
    expect(screen.queryByRole("region", { name: "Sample data" })).not.toBeInTheDocument();
  });

  it("offers Start fresh when the own workspace is empty, and leaves with the matching toast", () => {
    localStorage.removeItem(STORAGE_KEY);
    act(() => void store().enterSampleMode());
    renderBanner();

    const banner = screen.getByRole("region", { name: "Sample data" });
    expect(banner).toHaveTextContent(/^You're viewing sample data\s*·\s*Start fresh$/);
    fireEvent.click(screen.getByRole("button", { name: "Start fresh" }));

    expect(readDevicePreferences().sampleMode).toBeUndefined();
    expect(localStorage.getItem(SAMPLE_STORAGE_KEY)).toBeNull();
    expect(store().data.planItems).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent("Fresh start. It's all yours.");
    expect(navigation.push).toHaveBeenCalledWith("/");
    expect(screen.queryByRole("region", { name: "Sample data" })).not.toBeInTheDocument();
  });

  it("offers Back to my data when there is own data, and restores it byte for byte", () => {
    act(() => void store().saveMaterial(CURATED_MATERIALS[0].id));
    const own = localStorage.getItem(STORAGE_KEY);
    act(() => void store().enterSampleMode());
    renderBanner();

    // Editing the sample never touches the own workspace.
    act(() => void store().saveMaterial(CURATED_MATERIALS[1].id));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(own);

    fireEvent.click(screen.getByRole("button", { name: "Back to my data" }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe(own);
    expect(store().data.savedMaterialIds).toEqual([CURATED_MATERIALS[0].id]);
    expect(screen.getByRole("status")).toHaveTextContent("Back to your own data.");
  });

  it("follows sample mode switched in another tab", () => {
    renderBanner();
    act(() => {
      localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify({ sampleMode: true }));
      window.dispatchEvent(new StorageEvent("storage", { key: DEVICE_STORAGE_KEY }));
    });
    expect(screen.getByRole("region", { name: "Sample data" })).toBeInTheDocument();
    act(() => {
      localStorage.setItem(DEVICE_STORAGE_KEY, JSON.stringify({}));
      window.dispatchEvent(new StorageEvent("storage", { key: DEVICE_STORAGE_KEY }));
    });
    expect(screen.queryByRole("region", { name: "Sample data" })).not.toBeInTheDocument();
  });
});
