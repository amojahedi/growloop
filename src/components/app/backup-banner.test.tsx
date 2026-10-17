// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readBackup, saveBackup } from "@/lib/store/backup";
import { BackupBanner } from "./backup-banner";

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("BackupBanner", () => {
  it("appears when a backup is made and can delete it", () => {
    render(<BackupBanner />);
    expect(screen.queryByRole("alert")).toBeNull();

    act(() => saveBackup("{corrupt"));
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't be read");
    expect(screen.getByRole("button", { name: "Download backup" })).toBeInTheDocument();

    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete backup" }));

    expect(readBackup()).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
