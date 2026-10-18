import { parseMonthKey } from "@/lib/domain/dates";
import type { MonthKey } from "@/lib/domain/types";

const monthName = (month: MonthKey) => {
  const { year, month: m } = parseMonthKey(month);
  return new Date(year, m - 1, 1).toLocaleDateString("en-US", { month: "long" });
};

/** "September", "August and September", "July, August and September". */
export function monthsLabel(months: readonly MonthKey[]): string {
  const names = months.map(monthName);
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
