import { describe, expect, it } from "vitest";
import { at } from "@/lib/testing/fixtures";
import {
  addDays,
  addMonths,
  monthsBetween,
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
  daysBetween,
  daysLeftInQuarter,
  nextQuarter,
  quarterDays,
  quarterElapsedShare,
  quarterOfDay,
  quarterRange,
  toDayKey,
  weeksLeftInQuarter,
  yearOf,
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

  it("counts months between keys", () => {
    expect(monthsBetween("2026-10", "2027-01")).toBe(3);
    expect(monthsBetween("2026-10", "2026-10")).toBe(0);
    expect(monthsBetween("2026-10", "2025-12")).toBe(-10);
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

describe("quarters", () => {
  it("knows a quarter's days, neighbours and ranges", () => {
    expect(quarterDays("2026-Q4")).toEqual({ start: "2026-10-01", end: "2026-12-31" });
    expect(quarterDays("2028-Q1")).toEqual({ start: "2028-01-01", end: "2028-03-31" });
    expect(nextQuarter("2026-Q4")).toBe("2027-Q1");
    expect(quarterRange("2026-Q3", "2027-Q1")).toEqual(["2026-Q3", "2026-Q4", "2027-Q1"]);
    expect(quarterRange("2027-Q1", "2026-Q4")).toEqual([]);
    expect(quarterOfDay("2026-12-31")).toBe("2026-Q4");
    expect(yearOf("2027-Q2")).toBe(2027);
    expect(yearOf("2026-10-18")).toBe(2026);
  });

  it("counts whole days across DST changes", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2);
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-10-02", "2026-10-01")).toBe(-1);
  });

  it("counts the days and weeks left in today's quarter, today included", () => {
    expect(daysLeftInQuarter("2026-12-31")).toBe(1);
    expect(daysLeftInQuarter("2026-10-01")).toBe(92);
    expect(weeksLeftInQuarter("2026-11-18")).toBeCloseTo(44 / 7);
  });

  it("measures how much of a quarter has passed", () => {
    expect(quarterElapsedShare("2026-Q4", "2026-09-30")).toBe(0);
    expect(quarterElapsedShare("2026-Q4", "2026-10-01")).toBeCloseTo(1 / 92);
    expect(quarterElapsedShare("2026-Q4", "2026-11-15")).toBeCloseTo(46 / 92);
    expect(quarterElapsedShare("2026-Q4", "2027-02-01")).toBe(1);
  });
});
