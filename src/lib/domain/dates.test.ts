import { describe, expect, it } from "vitest";
import { at } from "@/lib/testing/fixtures";
import {
  addDays,
  addMonths,
  addQuarters,
  compareMonths,
  dayKey,
  daysInMonth,
  formatMonth,
  formatQuarter,
  monthKey,
  monthOf,
  monthsInQuarter,
  prevMonth,
  quarterOf,
  toDayKey,
} from "./dates";

describe("month keys", () => {
  it("formats a date as a zero-padded local month key", () => {
    expect(monthKey(new Date(2026, 0, 15))).toBe("2026-01");
    expect(monthKey(new Date(2026, 9, 31, 23, 59))).toBe("2026-10");
  });

  it("steps across year boundaries", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(prevMonth("2026-01")).toBe("2025-12");
    expect(addMonths("2026-10", 15)).toBe("2028-01");
    expect(addMonths("2026-10", -22)).toBe("2024-12");
  });

  it("compares months chronologically", () => {
    expect(compareMonths("2026-09", "2026-10")).toBeLessThan(0);
    expect(compareMonths("2027-01", "2026-12")).toBeGreaterThan(0);
    expect(compareMonths("2026-10", "2026-10")).toBe(0);
  });

  it("rejects malformed keys", () => {
    expect(() => addMonths("October", 1)).toThrow(/Invalid month key/);
  });
});

describe("quarters", () => {
  it.each([
    ["2026-01", "2026-Q1"],
    ["2026-03", "2026-Q1"],
    ["2026-04", "2026-Q2"],
    ["2026-09", "2026-Q3"],
    ["2026-10", "2026-Q4"],
    ["2026-12", "2026-Q4"],
  ])("%s belongs to %s", (month, quarter) => {
    expect(quarterOf(month)).toBe(quarter);
  });

  it("lists the three months of a quarter", () => {
    expect(monthsInQuarter("2026-Q4")).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(monthsInQuarter("2027-Q1")).toEqual(["2027-01", "2027-02", "2027-03"]);
  });

  it("steps quarters across years", () => {
    expect(addQuarters("2026-Q4", 1)).toBe("2027-Q1");
    expect(addQuarters("2026-Q1", -1)).toBe("2025-Q4");
  });

  it("formats labels", () => {
    expect(formatQuarter("2026-Q4")).toBe("Q4 2026");
    expect(formatMonth("2026-10")).toBe("October 2026");
  });
});

describe("days", () => {
  it("keeps plain dates and converts timestamps to the local day", () => {
    expect(toDayKey("2026-10-05")).toBe("2026-10-05");
    expect(toDayKey(at("2026-10-05"))).toBe("2026-10-05");
    expect(dayKey(new Date(2026, 1, 3))).toBe("2026-02-03");
  });

  it("derives the month of a stored value", () => {
    expect(monthOf("2026-10-31")).toBe("2026-10");
    expect(monthOf(at("2026-11-01", 0))).toBe("2026-11");
  });

  it("lists every day of a month, including leap days", () => {
    expect(daysInMonth("2026-10")).toHaveLength(31);
    expect(daysInMonth("2028-02").at(-1)).toBe("2028-02-29");
    expect(daysInMonth("2026-02")).toHaveLength(28);
  });

  it("adds days across month boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("rejects invalid dates", () => {
    expect(() => toDayKey("not a date")).toThrow(/Invalid date/);
  });
});
