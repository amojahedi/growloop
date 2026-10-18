// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Toaster, dismissToast } from "@/components/ui/toast";
import { readBackup, readBackups, saveBackup } from "@/lib/store/backup";
import { BackupBanner } from "./backup-banner";

beforeEach(() => localStorage.clear());
afterEach(() => {
  act(() => dismissToast());
  cleanup();
});

function renderBanner() {
  render(
    <>
      <main id="content" tabIndex={-1} />
      <BackupBanner />
      <Toaster />
    </>,
  );
}

describe("BackupBanner", () => {
  it("appears when a backup is made and offers it for download", () => {
    renderBanner();
    expect(screen.queryByRole("alert")).toBeNull();

    act(() => saveBackup("{corrupt"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your saved data couldn't be read, so Growloop started fresh. A copy of the old data was kept.",
    );
    expect(screen.getByRole("button", { name: "Download backup" })).toBeInTheDocument();
  });

  it("deletes without asking, and Undo brings every kept copy back in order", () => {
    const confirm = vi.spyOn(window, "confirm");
    act(() => {
      saveBackup("{oldest");
      saveBackup("{newest");
    });
    renderBanner();

    fireEvent.click(screen.getByRole("button", { name: "Delete backup" }));
    expect(confirm).not.toHaveBeenCalled();
    expect(readBackup()).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(document.getElementById("content")).toHaveFocus();
    expect(screen.getByRole("status")).toHaveTextContent("Backup deleted.");

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(readBackups().map((backup) => backup.raw)).toEqual(["{newest", "{oldest"]);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
