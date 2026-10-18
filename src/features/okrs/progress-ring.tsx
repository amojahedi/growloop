import { cn } from "cn";

/** A small progress ring (decorative: the percentage is always shown as text next to it). */
export function ProgressRing({ value, size = 18, className }: { value: number; size?: number; className?: string }) {
  const stroke = size <= 20 ? 2.5 : 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.min(100, Math.max(0, value)) / 100) * circumference;
  return (
    <svg aria-hidden width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={cn("shrink-0", className)}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-border" />
      {filled > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={value >= 100 ? "stroke-chart-2" : "stroke-primary"}
        />
      )}
    </svg>
  );
}
