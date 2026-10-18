import { parseQuarterKey, yearOf, type DayKey } from "@/lib/domain/dates";
import type { KeyResultProgress, Pace } from "@/lib/domain/okrs";
import type { BoardStatus, KeyResultType, QuarterKey } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";

/** Copy for the OKR page, the wizard and the OKR widget (okrs-and-wizard.md). */

export const KEY_RESULT_TYPE_LABELS: Record<KeyResultType, string> = {
  material: "Material",
  count: "Count",
  certification: "Certification",
};

export const BOARD_STATUS_LABELS: Record<BoardStatus, string> = {
  backlog: "Backlog",
  todo: "To do",
  in_progress: "In progress",
  done: "Done",
};

/** "Q4" */
export const quarterLabel = (quarter: QuarterKey): string => `Q${parseQuarterKey(quarter).quarter}`;

/** "Ahead of pace", "Starts Jan 1", "Closed at 64%", "Met"… */
export function paceLabel(pace: Pace): string {
  switch (pace.kind) {
    case "ahead":
      return "Ahead of pace";
    case "on":
      return "On pace";
    case "behind":
      return "Behind pace";
    case "upcoming":
      return `Starts ${formatShortDate(pace.startsOn, "en-US")}`;
    case "closed":
      return pace.met ? "Met" : `Closed at ${pace.finalProgress}%`;
    case "ended":
      return "Quarter ended";
  }
}

/** A key result's progress in words: "2 of 3", "In progress · 60%", "Not on your board yet". */
export function keyResultStatus(progress: KeyResultProgress): string {
  if (progress.type === "count") return `${progress.done} of ${progress.target}`;
  const { item } = progress;
  if (!item) return "Not on your board yet";
  const certification = progress.type === "certification";
  if (progress.met) return certification ? "Earned" : "Done";
  if (progress.awaitingEarned) return "Done · not marked earned";
  if (item.status === "backlog") return "In your backlog";
  if (item.status === "todo") return progress.progress > 0 ? `To do · ${progress.progress}%` : "To do";
  return `${certification ? "Preparing" : "In progress"} · ${progress.progress}%`;
}

/** "the rest of 2026 and 2027" (step 1's header), from the years in scope. */
export function scopeYearsPhrase(scope: readonly QuarterKey[], today: DayKey): string {
  const years = [...new Set(scope.map(yearOf))];
  const current = yearOf(today);
  return years.map((year) => (year === current ? `the rest of ${year}` : String(year))).join(" and ");
}

/** "2026–2027" or "2027" (the review's header). */
export function scopeYearsRange(scope: readonly QuarterKey[]): string {
  const years = [...new Set(scope.map(yearOf))].sort((a, b) => a - b);
  return years.length > 1 ? `${years[0]}–${years.at(-1)}` : String(years[0] ?? "");
}

export const pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;
