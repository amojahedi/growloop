"use client";

import { XIcon } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { SavedHint } from "@/components/notes/note-editor";
import { useAutosave } from "@/components/notes/use-autosave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Material, PlanItem } from "@/lib/domain/types";
import { formatHours, formatShortDate } from "@/lib/format";
import { useActions, useToday } from "@/lib/store/hooks";
import { Disclosure } from "./card-section";

export const MAX_LOG_HOURS = 24;
export const MAX_ESTIMATE_HOURS = 1_000;

/** Hours typed as text: a positive number up to `max`, or undefined. */
export function parseHours(text: string, max: number): number | undefined {
  const value = Number(text.trim().replace(",", "."));
  return text.trim() !== "" && Number.isFinite(value) && value > 0 && value <= max ? value : undefined;
}

/**
 * Time (C-5), collapsed by default and optional: an estimate and time logs.
 * The only place hours appear (ADR 006), including the material's typical length.
 */
export function CardTime({ item, material, readOnly }: { item: PlanItem; material?: Material; readOnly: boolean }) {
  const logged = item.timeLogs.reduce((sum, log) => sum + log.hours, 0);
  if (readOnly && item.estimatedHours === undefined && item.timeLogs.length === 0) return null;

  return (
    <Disclosure title="Time (optional)">
      {material?.estimatedHours !== undefined && (
        <p className="text-sm text-muted-foreground">Typical length: {formatHours(material.estimatedHours)}</p>
      )}
      {readOnly ? (
        item.estimatedHours !== undefined && <p className="text-sm">Estimate: {formatHours(item.estimatedHours)}</p>
      ) : (
        <EstimateField item={item} placeholder={material?.estimatedHours} />
      )}
      {item.timeLogs.length > 0 && (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">Logged {formatHours(logged)}</p>
          <ul className="flex flex-col">
            {[...item.timeLogs]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((log) => (
                <TimeLogRow key={log.id} itemId={item.id} log={log} readOnly={readOnly} />
              ))}
          </ul>
        </div>
      )}
      {!readOnly && <LogTimeForm itemId={item.id} />}
    </Disclosure>
  );
}

function EstimateField({ item, placeholder }: { item: PlanItem; placeholder?: number }) {
  const { updatePlanItem } = useActions();
  const id = useId();
  // The field is the only editor of the estimate, so it never needs to follow outside changes.
  const [initial] = useState(item.estimatedHours === undefined ? "" : String(item.estimatedHours));
  const estimate = useAutosave(initial, (text) => {
    if (text.trim() === "") updatePlanItem(item.id, { estimatedHours: undefined });
    const hours = parseHours(text, MAX_ESTIMATE_HOURS);
    if (hours !== undefined) updatePlanItem(item.id, { estimatedHours: hours });
  });
  const invalid = estimate.draft.trim() !== "" && parseHours(estimate.draft, MAX_ESTIMATE_HOURS) === undefined;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">
        Estimate (hours)
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step="0.5"
          className="w-28"
          placeholder={placeholder === undefined ? undefined : String(placeholder)}
          value={estimate.draft}
          aria-invalid={invalid || undefined}
          onChange={(event) => estimate.change(event.target.value)}
          onBlur={estimate.flush}
        />
        <SavedHint saved={estimate.saved && !invalid} />
      </div>
      {invalid && <p className="text-xs text-destructive">Enter hours between 0 and 1,000.</p>}
    </div>
  );
}

function TimeLogRow({ itemId, log, readOnly }: { itemId: string; log: PlanItem["timeLogs"][number]; readOnly: boolean }) {
  const { deleteTimeLog } = useActions();
  const label = `${formatHours(log.hours)} on ${formatShortDate(log.date)}`;
  return (
    <li className="flex min-h-8 items-center gap-3 text-sm">
      <span className="w-16 text-muted-foreground">{formatShortDate(log.date)}</span>
      <span className="tabular-nums">{formatHours(log.hours)}</span>
      {!readOnly && (
        <Button variant="ghost" size="icon-xs" className="ml-auto" aria-label={`Delete ${label}`} onClick={() => deleteTimeLog(itemId, log.id)}>
          <XIcon aria-hidden />
        </Button>
      )}
    </li>
  );
}

function LogTimeForm({ itemId }: { itemId: string }) {
  const { logTime } = useActions();
  const today = useToday();
  const dateId = useId();
  const hoursId = useId();
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState("");
  const [error, setError] = useState<string>();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = parseHours(hours, MAX_LOG_HOURS);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return setError("Pick a date up to today.");
    if (value === undefined) return setError(`Enter hours between 0 and ${MAX_LOG_HOURS}.`);
    logTime(itemId, { date, hours: value });
    setHours("");
    setError(undefined);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1">
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={dateId} className="text-xs font-medium text-muted-foreground">
            Date
          </label>
          <Input id={dateId} type="date" max={today} className="w-40" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={hoursId} className="text-xs font-medium text-muted-foreground">
            Hours
          </label>
          <Input
            id={hoursId}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.25"
            className="w-24"
            value={hours}
            aria-invalid={error ? true : undefined}
            onChange={(event) => setHours(event.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" size="sm" className="mb-0.5">
          Log time
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
