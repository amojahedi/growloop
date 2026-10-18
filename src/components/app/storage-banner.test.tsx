// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { reportStorageError, reportStorageWrite, resetStorageHealth } from "@/lib/store/storage-health";
import { UpdateBanner } from "@/components/layout/update-banner";
import { handleStorageEvent, resetNewerVersionFlag } from "@/lib/store/hydration";
import { STORAGE_KEY, useAppStore } from "@/lib/store/app-store";
import { StorageBanner } from "./storage-banner";

afterEach(() => {
  act(() => resetStorageHealth());
  resetNewerVersionFlag();
  cleanup();
});

describe("StorageBanner", () => {
  it("says changes won't last when storage is blocked, for the rest of the session", () => {
    render(<StorageBanner />);
    expect(screen.queryByRole("alert")).toBeNull();

    act(() => reportStorageError(new DOMException("denied", "SecurityError")));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your browser is blocking storage, so changes last only until you close this tab.",
    );
    act(() => reportStorageWrite());
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("says when storage is full, until a later save works", () => {
    render(<StorageBanner />);
    act(() => reportStorageError(new DOMException("full", "QuotaExceededError")));
    expect(screen.getByRole("alert")).toHaveTextContent("Your browser's storage is full");
    act(() => reportStorageWrite());
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("UpdateBanner", () => {
  it("offers a reload when another tab saved with a newer build", () => {
    useAppStore.persist.setOptions({ name: STORAGE_KEY });
    render(<UpdateBanner />);
    expect(screen.queryByRole("alert")).toBeNull();

    act(() => handleStorageEvent({ key: STORAGE_KEY, newValue: JSON.stringify({ state: {}, version: 99 }) }));
    expect(screen.getByRole("alert")).toHaveTextContent("Growloop was updated in another tab.");
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});
