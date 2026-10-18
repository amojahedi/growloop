// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster, dismissToast, toast } from "@/components/ui/toast";
import { CURATED_MATERIALS } from "@/lib/catalog";
import { SAMPLE_STORAGE_KEY, STORAGE_KEY, useAppStore } from "@/lib/store/app-store";
import { clearDevicePreferences, DEVICE_STORAGE_KEY, readDevicePreferences, updateDevicePreferences } from "@/lib/store/device";
import { emptyWorkspace } from "@/lib/store/seed";

const navigation = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/board", useRouter: () => ({ push: navigation.push }) }));

const { exitSampleLabel, SampleBanner } = await import("./sample-banner");

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

function blockStorage() {
  // jsdom's Storage keeps methods on the prototype; the Node 25 test stand-in on the instance.
  const target: Storage = localStorage instanceof Storage ? Storage.prototype : localStorage;
  const blocked = () => {
    throw new DOMException("Blocked", "SecurityError");
  };
  for (const method of ["getItem", "setItem", "removeItem"] as const) vi.spyOn(target, method).mockImplementation(blocked);
}

describe("ownWorkspaceHasData", () => {
  it("knows about the own workspace while the sample is loaded", () => {
    expect(store().ownWorkspaceHasData()).toBe(false);
    act(() => void store().saveMaterial(CURATED_MATERIALS[0].id));
    expect(store().ownWorkspaceHasData()).toBe(true);
    act(() => void store().enterSampleMode());
    expect(store().ownWorkspaceHasData()).toBe(true);
    act(() => void store().exitSampleMode());
  });

  it("reads what's stored when sample mode came from another tab or a reload, counting anything unreadable as data", () => {
    // Sample mode switched on elsewhere: no copy in memory, only storage.
    updateDevicePreferences({ sampleMode: true });
    localStorage.removeItem(STORAGE_KEY);
    expect(store().ownWorkspaceHasData()).toBe(false);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state: { data: { ...emptyWorkspace(), savedMaterialIds: ["x"] } }, version: 4 }));
    expect(store().ownWorkspaceHasData()).toBe(true);
    localStorage.setItem(STORAGE_KEY, "{broken");
    expect(store().ownWorkspaceHasData()).toBe(true);
    updateDevicePreferences({ sampleMode: undefined });
  });

  it("counts the in-memory copy when storage is blocked", () => {
    act(() => void store().saveMaterial(CURATED_MATERIALS[0].id));
    blockStorage();
    act(() => void store().enterSampleMode());
    expect(store().ownWorkspaceHasData()).toBe(true);
    renderBanner();
    expect(screen.getByRole("button", { name: "Back to my data" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to my data" }));
    expect(store().data.savedMaterialIds).toEqual([CURATED_MATERIALS[0].id]);
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
    // A toast from the sample (e.g. an Undo) is dismissed before switching workspaces.
    const undo = vi.fn();
    act(() => toast({ message: "Removed from October", action: { label: "Undo", onClick: undo } }));

    const banner = screen.getByRole("region", { name: "Sample data" });
    expect(banner).toHaveTextContent(/^You're viewing sample data\s*·\s*Start fresh$/);
    fireEvent.click(screen.getByRole("button", { name: "Start fresh" }));

    expect(readDevicePreferences().sampleMode).toBeUndefined();
    expect(localStorage.getItem(SAMPLE_STORAGE_KEY)).toBeNull();
    expect(store().data.planItems).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent("Fresh start. It's all yours.");
    expect(screen.queryByRole("button", { name: "Undo" })).not.toBeInTheDocument();
    expect(undo).not.toHaveBeenCalled();
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
