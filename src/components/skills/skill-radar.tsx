"use client";

import { useId } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  type DotItemDotProps,
} from "recharts";
import type { ID, SkillColor } from "@/lib/domain/types";
import { formatWeight } from "@/lib/format";
import { skillColorVar, skillTextColor } from "@/lib/theme/skill-colors";
import { cn } from "@/lib/utils";

export interface SkillRadarAxis {
  skillId: ID;
  name: string;
  color: SkillColor;
}

export type SkillRadarVariant = "solid" | "dashed" | "preview";

export interface SkillRadarSeries {
  key: string;
  /** Legend and table header, e.g. "Completed". */
  label: string;
  /** Word after each value in the tooltip, e.g. "done" → "Roadmapping: 3.5 done". Defaults to the label. */
  unit?: string;
  /** One value per axis, in axis order. */
  values: readonly number[];
  variant: SkillRadarVariant;
}

interface SkillRadarProps {
  axes: readonly SkillRadarAxis[];
  series: readonly SkillRadarSeries[];
  /** Names the chart for assistive tech and captions the data table. */
  title: string;
  height?: number;
  className?: string;
  /** Makes each axis label a button, e.g. to open the skill sheet. */
  onAxisClick?: (skillId: ID) => void;
}

type Row = SkillRadarAxis & Record<string, number | string>;

const unitOf = (series: SkillRadarSeries) => series.unit ?? series.label.toLowerCase();

/** "Roadmapping: 3.5 done · 5 projected" */
export function axisSummary(axis: SkillRadarAxis, index: number, series: readonly SkillRadarSeries[]): string {
  const values = series.map((s) => `${formatWeight(s.values[index] ?? 0)} ${unitOf(s)}`);
  return `${axis.name}: ${values.join(" · ")}`;
}

/**
 * Spider chart with one axis per skill (D-2, S-4). Series are drawn in order,
 * so pass the reference series (e.g. projected) before the one it frames.
 * Values are also rendered as a visually hidden table for screen readers.
 */
export function SkillRadar({ axes, series, title, height = 300, className, onAxisClick }: SkillRadarProps) {
  const tableId = useId();
  const rows: Row[] = axes.map((axis, index) => ({
    ...axis,
    ...Object.fromEntries(series.map((s) => [s.key, s.values[index] ?? 0])),
  }));

  return (
    <figure className={cn("flex flex-col gap-2", className)} aria-describedby={tableId}>
      <ResponsiveContainer width="100%" height={height} initialDimension={{ width: 320, height }}>
        <RadarChart data={rows} outerRadius="68%" title={title} margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="name" tick={(props) => <AxisTick {...props} axes={axes} onClick={onAxisClick} />} />
          {/* Fixed at 0 so small values don't fill the chart; at least 1 so an empty month still has a shape. */}
          <PolarRadiusAxis domain={[0, (max: number) => Math.max(1, max)]} tick={false} axisLine={false} />
          {series.map((s) => (
            <Radar key={s.key} name={s.label} dataKey={s.key} isAnimationActive={false} {...seriesStyle(s.variant, axes)} />
          ))}
          <Tooltip
            content={({ active, label }) => <AxisTooltip active={active} label={label} axes={axes} series={series} />}
          />
        </RadarChart>
      </ResponsiveContainer>
      <Legend series={series} />
      <table id={tableId} className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Skill</th>
            {series.map((s) => (
              <th key={s.key} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {axes.map((axis, index) => (
            <tr key={axis.skillId}>
              <th scope="row">{axis.name}</th>
              {series.map((s) => (
                <td key={s.key}>{formatWeight(s.values[index] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

// --- Marks -------------------------------------------------------------------

function renderDot({ cx, cy, index, value }: DotItemDotProps, axes: readonly SkillRadarAxis[], filled: boolean) {
  const color = axes[index]?.color;
  // Zero values all sit on the center; a pile of dots there reads as noise.
  if (cx === undefined || cy === undefined || !color || !value) return null;
  return (
    <circle
      key={index}
      cx={cx}
      cy={cy}
      r={4}
      strokeWidth={2}
      style={{ fill: filled ? skillColorVar(color) : "var(--card)", stroke: skillTextColor(color) }}
    />
  );
}

function seriesStyle(variant: SkillRadarVariant, axes: readonly SkillRadarAxis[]) {
  const dot = (filled: boolean) => (props: DotItemDotProps) => renderDot(props, axes, filled);

  switch (variant) {
    case "solid":
      return { stroke: "var(--primary)", strokeWidth: 2, fill: "var(--primary)", fillOpacity: 0.2, dot: dot(true) };
    case "dashed":
      return { stroke: "var(--muted-foreground)", strokeWidth: 2, strokeDasharray: "5 4", fill: "none", dot: dot(false) };
    case "preview":
      return {
        stroke: "var(--foreground)",
        strokeOpacity: 0.45,
        strokeWidth: 1.5,
        strokeDasharray: "2 3",
        fill: "var(--foreground)",
        fillOpacity: 0.08,
        dot: false,
      };
  }
}

function AxisTick({
  x,
  y,
  textAnchor,
  index,
  axes,
  onClick,
}: {
  x: number | string;
  y: number | string;
  textAnchor: string;
  index: number;
  axes: readonly SkillRadarAxis[];
  onClick?: (skillId: ID) => void;
}) {
  const axis = axes[index];
  if (!axis) return null;
  const label = (
    <text
      x={x}
      y={y}
      textAnchor={textAnchor as "start" | "middle" | "end"}
      dominantBaseline="central"
      className={cn("text-xs font-medium", onClick && "group-hover/axis:underline group-focus-visible/axis:underline")}
      style={{ fill: skillTextColor(axis.color) }}
    >
      {axis.name}
    </text>
  );
  if (!onClick) return label;
  return (
    <g
      role="button"
      aria-label={`Open ${axis.name}`}
      aria-haspopup="dialog"
      tabIndex={0}
      className="group/axis cursor-pointer outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      onClick={() => onClick(axis.skillId)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(axis.skillId);
        }
      }}
    >
      {label}
    </g>
  );
}

function AxisTooltip({
  active,
  label,
  axes,
  series,
}: {
  active?: boolean;
  label?: unknown;
  axes: readonly SkillRadarAxis[];
  series: readonly SkillRadarSeries[];
}) {
  const index = axes.findIndex((axis) => axis.name === label);
  if (!active || index === -1) return null;
  const axis = axes[index];
  return (
    <div className="rounded-md bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md ring-1 ring-foreground/10">
      <span className="mr-1.5 inline-block size-2 rounded-full" style={{ backgroundColor: skillColorVar(axis.color) }} />
      {axisSummary(axis, index, series)}
    </div>
  );
}

// --- Legend --------------------------------------------------------------------

const SWATCH: Record<SkillRadarVariant, string> = {
  solid: "h-2.5 border-token-strong border-primary bg-primary/20",
  dashed: "h-0 border-t-2 border-dashed border-muted-foreground",
  preview: "h-2.5 border border-dotted border-foreground/45 bg-foreground/8",
};

function Legend({ series }: { series: readonly SkillRadarSeries[] }) {
  if (series.length < 2) return null;
  return (
    <ul className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5">
          <span aria-hidden className={`inline-block w-4 rounded-xs ${SWATCH[s.variant]}`} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
