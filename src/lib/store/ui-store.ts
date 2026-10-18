import { create } from "zustand";
import type { DraftSource, PlanDraft, WizardSkillAnswer } from "@/lib/domain/plan-draft";
import type { ImpactSource } from "@/lib/domain/skill-impact";
import type { GoalId, ID, MonthKey, RoleId } from "@/lib/domain/types";

/**
 * Session UI state, shared across pages but not part of the workspace.
 * Frozen after WP0 (build plan): Phase 1 packages add state and actions only,
 * in a clearly marked section, and never change existing ones.
 */

/** An item being hovered or focused, whose skill impact radars show as a faint preview. */
export interface SkillPreview {
  /** The plan item or material id, so a leaving element only clears its own preview. */
  id: ID;
  label: string;
  source: ImpactSource;
}

/**
 * The OKR wizard's answers and draft for this browser session, so reopening
 * /okrs/plan resumes where the user left off (onboarding.md §Closed mid-way).
 * The optional LinkedIn/CV text is deliberately not here: it is never stored.
 */
export interface WizardSession {
  step: "answers" | "skills" | "review";
  role?: RoleId;
  goal?: GoalId;
  goalText?: string;
  /** Focus skills in pick order, with Now and Goal levels. */
  skills: WizardSkillAnswer[];
  /** The draft under review (kept when going Back). */
  draft?: { plan: PlanDraft; source: DraftSource };
}

export const EMPTY_WIZARD_SESSION: WizardSession = { step: "answers", skills: [] };

interface UIState {
  /** Month being viewed on the Dashboard and Board; `null` follows the current calendar month. */
  selectedMonth: MonthKey | null;
  setSelectedMonth: (month: MonthKey | null) => void;

  skillPreview: SkillPreview | null;
  showSkillPreview: (preview: SkillPreview) => void;
  /** Clears the preview if it still belongs to `id`. */
  hideSkillPreview: (id: ID) => void;

  /** The skill whose sheet is open (skills.md); the sheet has no URL. */
  skillSheet: ID | null;
  openSkillSheet: (skillId: ID) => void;
  closeSkillSheet: () => void;

  wizard: WizardSession;
  updateWizard: (patch: Partial<WizardSession>) => void;
  resetWizard: () => void;

  // --- Phase 1 additions go below, one marked section per package. ---
}

export const useUIStore = create<UIState>()((set) => ({
  selectedMonth: null,
  setSelectedMonth: (selectedMonth) => set({ selectedMonth }),

  skillPreview: null,
  showSkillPreview: (skillPreview) => set({ skillPreview }),
  hideSkillPreview: (id) => set((state) => (state.skillPreview?.id === id ? { skillPreview: null } : state)),

  skillSheet: null,
  openSkillSheet: (skillSheet) => set({ skillSheet }),
  closeSkillSheet: () => set({ skillSheet: null }),

  wizard: EMPTY_WIZARD_SESSION,
  updateWizard: (patch) => set((state) => ({ wizard: { ...state.wizard, ...patch } })),
  resetWizard: () => set({ wizard: EMPTY_WIZARD_SESSION }),
}));

// --- Wizard session persistence --------------------------------------------------------
// Only the wizard survives a reload (in sessionStorage, so it ends with the tab); the viewed
// month resets to the current one (board.md). Written only when the wizard changes.

const WIZARD_SESSION_KEY = "growloop:wizard";

/** Restores the wizard after mount (called by useStoreRehydration), so server and first client render match. */
export function rehydrateWizardSession(): void {
  try {
    const raw = sessionStorage.getItem(WIZARD_SESSION_KEY);
    const wizard = raw ? (JSON.parse(raw) as WizardSession) : undefined;
    if (wizard && typeof wizard === "object" && Array.isArray(wizard.skills)) useUIStore.setState({ wizard });
  } catch {
    // Unreadable or blocked: start the wizard fresh.
  }
}

/** Forgets the wizard's answers in memory and in sessionStorage (Erase everything). */
export function clearWizardSession(): void {
  useUIStore.getState().resetWizard();
  try {
    sessionStorage.removeItem(WIZARD_SESSION_KEY);
  } catch {
    // Blocked storage: nothing was kept.
  }
}

if (typeof window !== "undefined") {
  useUIStore.subscribe((state, previous) => {
    if (state.wizard === previous.wizard) return;
    try {
      sessionStorage.setItem(WIZARD_SESSION_KEY, JSON.stringify(state.wizard));
    } catch {
      // Blocked storage: the wizard lasts until reload.
    }
  });
}
