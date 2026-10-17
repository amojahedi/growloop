"use client";

import { cn } from "cn";
import { SparklesIcon } from "lucide-react";
import { useId } from "react";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { MATERIAL_COSTS, MATERIAL_LEVELS, MATERIAL_TYPES, type Skill } from "@/lib/domain/types";
import { CheckboxGroup } from "./checkbox-group";
import { COST_LABELS, LEVEL_LABELS, TYPE_LABELS } from "./labels";
import type { FilledField, FormProblems, OwnMaterialForm } from "./own-material";

/** The review form for "Add your own". Fields Claude filled are marked so the user knows to check them. */
export function OwnMaterialFields({
  form,
  filled,
  problems,
  skills,
  onChange,
}: {
  form: OwnMaterialForm;
  filled: ReadonlySet<FilledField>;
  problems: FormProblems;
  skills: readonly Skill[];
  onChange: (patch: Partial<OwnMaterialForm>) => void;
}) {
  const field = (key: FilledField) => ({ filled: filled.has(key) });

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Title" required {...field("title")} error={problems.title} className="sm:col-span-2">
        {(props) => <Input {...props} value={form.title} onChange={(event) => onChange({ title: event.target.value })} />}
      </Field>
      <Field label="Type" {...field("type")}>
        {(props) => (
          <NativeSelect {...props} value={form.type} onChange={(event) => onChange({ type: event.target.value as OwnMaterialForm["type"] })}>
            {MATERIAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <Field label="Author or provider" {...field("author")}>
        {(props) => <Input {...props} value={form.author} onChange={(event) => onChange({ author: event.target.value })} />}
      </Field>
      <Field label="Link" {...field("url")} error={problems.url} className="sm:col-span-2">
        {(props) => (
          <Input {...props} type="url" inputMode="url" value={form.url} onChange={(event) => onChange({ url: event.target.value })} />
        )}
      </Field>
      <Field label="One-line hook" {...field("tagline")} className="sm:col-span-2">
        {(props) => <Input {...props} value={form.tagline} onChange={(event) => onChange({ tagline: event.target.value })} />}
      </Field>
      <Field label="What it covers" {...field("summary")} className="sm:col-span-2">
        {(props) => <Textarea {...props} value={form.summary} onChange={(event) => onChange({ summary: event.target.value })} />}
      </Field>
      <Field label="Length (hours)" {...field("hours")} error={problems.hours}>
        {(props) => (
          <Input {...props} type="number" min="0" step="0.5" inputMode="decimal" value={form.hours} onChange={(event) => onChange({ hours: event.target.value })} />
        )}
      </Field>
      <Field label="Level" {...field("level")}>
        {(props) => (
          <NativeSelect {...props} value={form.level} onChange={(event) => onChange({ level: event.target.value as OwnMaterialForm["level"] })}>
            {MATERIAL_LEVELS.map((level) => (
              <option key={level} value={level}>
                {LEVEL_LABELS[level]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>
      <Field label="Cost" {...field("cost")}>
        {(props) => (
          <NativeSelect {...props} value={form.cost} onChange={(event) => onChange({ cost: event.target.value as OwnMaterialForm["cost"] })}>
            {MATERIAL_COSTS.map((cost) => (
              <option key={cost} value={cost}>
                {COST_LABELS[cost]}
              </option>
            ))}
          </NativeSelect>
        )}
      </Field>

      <div className="sm:col-span-2">
        <CheckboxGroup
          legend={`Skills (required)${filled.has("skillIds") ? " · suggested by Claude" : ""}`}
          options={skills.map((skill) => ({ value: skill.id, label: skill.name, color: skill.color }))}
          selected={form.skillIds}
          onToggle={(id) =>
            onChange({
              skillIds: form.skillIds.includes(id) ? form.skillIds.filter((other) => other !== id) : [...form.skillIds, id],
            })
          }
          className="max-h-48 overflow-y-auto sm:grid sm:grid-cols-2"
        />
        {problems.skillIds && <p className="mt-1 text-xs text-destructive">{problems.skillIds}</p>}
      </div>
    </div>
  );
}

interface ControlProps {
  id: string;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
  required?: boolean;
}

function Field({
  label,
  required,
  filled,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  filled?: boolean;
  error?: string;
  className?: string;
  children: (props: ControlProps) => React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {label}
        {required && <span aria-hidden>*</span>}
        {filled && (
          <span className="inline-flex items-center gap-0.5 text-brand">
            <SparklesIcon aria-hidden className="size-3" />
            Filled by Claude
          </span>
        )}
      </label>
      {children({
        id,
        required,
        ...(error ? { "aria-invalid": true as const, "aria-describedby": errorId } : {}),
      })}
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
