/** Small display formatters shared by views. */

export const formatPercent = (value: number) => `${Math.round(value)}%`;

export const formatHours = (hours: number) => `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`;

export const formatDelta = (delta: number) => (delta > 0 ? `+${delta}` : String(delta));

/** "Oct 24" for a "YYYY-MM-DD" date or ISO timestamp, in the user's locale. */
export function formatShortDate(value: string, locale?: string): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}
