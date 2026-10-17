import { create } from "zustand";
import type { ImpactSource } from "@/lib/domain/skill-impact";
import type { ID, MonthKey } from "@/lib/domain/types";

/** An item being hovered or focused, whose skill impact radars show as a faint preview. */
export interface SkillPreview {
  /** The plan item or material id, so a leaving element only clears its own preview. */
  id: ID;
  label: string;
  source: ImpactSource;
}

/** Session-only UI state (not persisted). */
interface UIState {
  /** Month being viewed; `null` follows the current calendar month. */
  selectedMonth: MonthKey | null;
  setSelectedMonth: (month: MonthKey | null) => void;
  skillPreview: SkillPreview | null;
  showSkillPreview: (preview: SkillPreview) => void;
  /** Clears the preview if it still belongs to `id`. */
  hideSkillPreview: (id: ID) => void;
}

export const useUIStore = create<UIState>()((set) => ({
  selectedMonth: null,
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),
  skillPreview: null,
  showSkillPreview: (skillPreview) => set({ skillPreview }),
  hideSkillPreview: (id) => set((state) => (state.skillPreview?.id === id ? { skillPreview: null } : state)),
}));
