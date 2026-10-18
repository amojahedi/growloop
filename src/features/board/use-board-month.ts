"use client";

import { useEffect } from "react";
import { compareMonths, quarterOf } from "@/lib/domain/dates";
import { useMonthNavigation, type MonthNavigation } from "@/lib/store/hooks";

/**
 * The month the Board shows: the shared viewed month, but never after the
 * current one (B-5: the board looks back only). A later month (e.g. set by
 * another month switcher) is shown as the current month and reset to it.
 * Must be inside `<DataGate>`.
 */
export function useBoardMonth(): MonthNavigation {
  const navigation = useMonthNavigation();
  const { currentMonth, goToCurrentMonth } = navigation;
  const future = compareMonths(navigation.month, currentMonth) > 0;

  useEffect(() => {
    if (future) goToCurrentMonth();
  }, [future, goToCurrentMonth]);

  if (!future) return navigation;
  return { ...navigation, month: currentMonth, quarter: quarterOf(currentMonth), isCurrentMonth: true };
}
