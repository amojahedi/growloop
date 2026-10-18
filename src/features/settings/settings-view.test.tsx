// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { dismissToast, Toaster } from "@/components/ui/toast";
import { API_KEY_STORAGE_KEY, forgetApiKey } from "@/lib/ai/providers/key-storage";
import { STORAGE_KEY, useAppStore } from "@/lib/store/app-store";
import { DEVICE_STORAGE_KEY, updateDevicePreferences } from "@/lib/store/device";
import { emptyWorkspace } from "@/lib/store/seed";
import { serializeWorkspace } from "@/lib/store/serialization";
import { makeItem } from "@/lib/testing/fixtures";
import { SETTINGS_SECTIONS, SettingsView } from "./settings-view";

const push = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), prefetch: vi.fn() }) }));

// Sections gate on loaded data and today's date; pin both here.
vi.mock("@/components/app/data-gate", async () => {
  const { TodayContext } = await import("@/lib/store/hooks");
  return {
    DataGate: ({ children }: { children: React.ReactNode }) => <TodayContext value="2026-10-18">{children}</TodayContext>,
  };
});

beforeAll(() => {
  // next-themes reads the system preference; jsdom has no matchMedia.
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
});

beforeEach(() => {
  localStorage.clear();
  forgetApiKey();
  updateDevicePreferences({ sampleMode: undefined });
  useAppStore.setState({ data: emptyWorkspace() });
  dismissToast();
  push.mockReset();
  // Hosted: the local Claude Code bridge is disabled.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(Response.json({ available: false, code: "disabled" }))),
  );
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderSettings() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <SettingsView />
      <Toaster />
    </ThemeProvider>,
  );
}

const jsonFile = (content: string, name = "growloop-2026-10-01.json") => new File([content], name, { type: "application/json" });
const chooseFile = (file: File) =>
  act(async () => {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!;
    fireEvent.change(input, { target: { files: [file] } });
  });

describe("SettingsView", () => {
  it("shows Profile, Skills, Claude, Appearance and Your data in order, each with its anchor", () => {
    renderSettings();
    expect(screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent)).toEqual([
      "Profile",
      "Skills",
      "Claude",
      "Appearance",
      "Your data",
    ]);
    for (const id of SETTINGS_SECTIONS) {
      const anchor = document.getElementById(id);
      expect(anchor, id).not.toBeNull();
      expect(anchor?.querySelector("h2")).not.toBeNull();
    }
  });

  it("autosaves the name after a short pause and says so", () => {
    vi.useFakeTimers();
    renderSettings();
    const name = screen.getByRole("textbox", { name: "Your name" });
    expect(name).toHaveAccessibleDescription("Used in your greeting. Stays on this device.");
    expect(name).toHaveAttribute("maxlength", "40");

    fireEvent.change(name, { target: { value: "Aisan " } });
    expect(useAppStore.getState().data.profile.name).toBeUndefined();
    act(() => vi.advanceTimersByTime(400));
    expect(useAppStore.getState().data.profile.name).toBe("Aisan");
    expect(screen.getByText("Saved")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1_500));
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();

    // Clearing removes it; blur saves right away.
    fireEvent.change(name, { target: { value: "" } });
    fireEvent.blur(name);
    expect(useAppStore.getState().data.profile).not.toHaveProperty("name");
  });

  it("keeps the appearance mode in sync with the top-bar toggle", async () => {
    render(
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <ThemeToggle />
        <SettingsView />
      </ThemeProvider>,
    );
    const mode = screen.getByRole("group", { name: "Mode" });
    await waitFor(() => expect(within(mode).getByRole("radio", { name: "System" })).toBeChecked());

    fireEvent.click(within(mode).getByRole("radio", { name: "Dark" }));
    await waitFor(() => expect(document.documentElement).toHaveClass("dark"));

    const toggle = screen.getByRole("button", { name: "Color mode" });
    fireEvent.keyDown(toggle, { key: "Enter" });
    const darkItem = await screen.findByRole("menuitemradio", { name: "Dark" });
    expect(darkItem).toHaveAttribute("aria-checked", "true");

    fireEvent.click(await screen.findByRole("menuitemradio", { name: "Light" }));
    await waitFor(() => expect(within(mode).getByRole("radio", { name: "Light" })).toBeChecked());
  });

  it("imports a file only after the replace dialog, never with window.confirm", async () => {
    const confirm = vi.spyOn(window, "confirm");
    const imported = { ...emptyWorkspace(), planItems: [makeItem()] };
    renderSettings();

    await chooseFile(jsonFile(serializeWorkspace(imported, "2026-10-01T09:00:00.000Z")));
    const dialog = await screen.findByRole("alertdialog", { name: "Replace everything with this file?" });
    expect(dialog).toHaveTextContent(
      "Your current plans, notes and objectives will be replaced. Export first if you might want them back.",
    );
    expect(useAppStore.getState().data.planItems).toHaveLength(0);

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(useAppStore.getState().data.planItems).toHaveLength(0);

    await chooseFile(jsonFile(serializeWorkspace(imported, "2026-10-01T09:00:00.000Z")));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Replace" }));
    expect(useAppStore.getState().data.planItems).toHaveLength(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByText("Import complete.")).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("shows the parser's reason for a bad file, without a dialog", async () => {
    renderSettings();
    await chooseFile(jsonFile("{ not json"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't import that file. The file is not valid JSON.");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("erases everything, including the saved Claude key, after the dialog", async () => {
    const confirm = vi.spyOn(window, "confirm");
    localStorage.setItem(API_KEY_STORAGE_KEY, "sk-ant-api03-secret");
    const item = makeItem();
    useAppStore.setState({ data: { ...emptyWorkspace(), planItems: [item] } });
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Erase everything" }));
    const dialog = screen.getByRole("alertdialog", { name: "Erase everything on this device?" });
    expect(dialog).toHaveTextContent(
      "This deletes your plans, notes, objectives, settings and saved Claude key from this browser. It can't be undone.",
    );
    // Cancel is first, so Enter on open doesn't erase.
    await waitFor(() => expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus());

    fireEvent.click(within(dialog).getByRole("button", { name: "Erase everything" }));
    expect(useAppStore.getState().data.planItems).toHaveLength(0);
    expect(localStorage.getItem(API_KEY_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY) ?? "").not.toContain(item.id);
    expect(push).toHaveBeenCalledWith("/");
    expect(confirm).not.toHaveBeenCalled();
  });

  it("enters sample data from Settings, then disables Import and hides Erase", () => {
    const { unmount } = renderSettings();
    expect(screen.getByText("Your own data stays safe and comes back when you exit.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Try sample data" }));
    expect(localStorage.getItem(DEVICE_STORAGE_KEY)).toContain('"sampleMode":true');
    expect(push).toHaveBeenCalledWith("/");
    unmount();

    renderSettings();
    expect(screen.getByRole("button", { name: "Import…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Import…" })).toHaveAccessibleDescription("Leave sample data to import.");
    expect(screen.queryByRole("button", { name: "Erase everything" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Back to my data" }));
    expect(screen.getByText("Fresh start. It's all yours.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import…" })).toBeEnabled();
  });

  it("exports the workspace without the Claude key", () => {
    localStorage.setItem(API_KEY_STORAGE_KEY, "sk-ant-api03-secret-wxyz");
    const created: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      created.push(blob as Blob);
      return "blob:export";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderSettings();

    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    expect(click).toHaveBeenCalled();
    expect(created).toHaveLength(1);
    return created[0].text().then((text) => {
      expect(text).toContain('"version": 4');
      expect(text).not.toContain("sk-ant");
    });
  });
});
