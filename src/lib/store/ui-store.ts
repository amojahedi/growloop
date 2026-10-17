import { create } from "zustand";
import type { MonthKey } from "@/lib/domain/types";

/** Session-only UI state (not persisted). */
interface UIState {
  /** Month being viewed; `null` follows the current calendar month. */
  selectedMonth: MonthKey | null;
  setSelectedMonth: (month: MonthKey | null) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  selectedMonth: null,
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
}));
