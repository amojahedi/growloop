"use client";

import { cn } from "cn";
import { PlusIcon, XIcon } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import { MAX_KEY_RESULTS, MIN_KEY_RESULTS } from "@/lib/domain/okrs";
import { PLAN_DRAFT_LIMITS } from "@/lib/domain/plan-draft";
import { KEY_RESULT_TYPES, type ID, type KeyResultType, type Material, type Skill } from "@/lib/domain/types";
import { FieldMessage, SegmentedControl } from "./controls/choice-controls";
import { CountStepper, InlineTextField } from "./controls/fields";
import { MaterialCombobox } from "./controls/material-combobox";
import { SkillSelect } from "./controls/skill-controls";
import {
  autoTitle,
  blankKeyResult,
  changeKeyResult,
  DEFAULT_COUNT,
  fieldIds,
  fitsKeyResult,
  isStructural,
  type EditorLookup,
  type KeyResultChange,
  type KeyResultForm,
  type ObjectiveForm,
  type Problem,
} from "./editor-model";
import { focusSoon } from "./focus";
import { KEY_RESULT_TYPE_LABELS } from "./labels";

const TYPE_OPTIONS = KEY_RESULT_TYPES.map((type) => ({ value: type, label: KEY_RESULT_TYPE_LABELS[type] }));
const ORDERED_TYPES: readonly KeyResultType[] = ["material", "count", "certification"];
const TYPE_CHOICES = ORDERED_TYPES.map((type) => TYPE_OPTIONS.find((option) => option.value === type)!);
export const KEY_RESULT_LIMIT_HINT = "Two or three key results per objective";

export interface ObjectiveEditorProps {
  value: ObjectiveForm;
  onChange: (next: ObjectiveForm) => void;
  lookup: EditorLookup;
  /** Skills offered in the pickers: the visible ones (a hidden skill already on a KR stays selectable). */
  skills: readonly Skill[];
  /** Catalog plus the user's own materials, in recommended order. */
  materials: readonly Material[];
  /** This objective's problems (see editor-model.ts). */
  problems: readonly Problem[];
  /** Show every problem, not only those of fields the user has left (after Accept or Save). */
  showAllProblems: boolean;
  /** Accessible name of the card, e.g. "Objective for Q1 2027". */
  label: string;
  /** The ⋯ menu; its trigger should carry `fieldIds.menu(value)`. */
  menu?: ReactNode;
  /** Save / Cancel when editing on the OKR page. */
  footer?: ReactNode;
  className?: string;
}

/**
 * The shared ObjectiveEditor (okrs-and-wizard.md §Review screen): the same
 * inline card edits a drafted objective in the wizard's review and a saved one
 * on the OKR page. Title and why read as text until hovered or focused; each
 * key result has a skill, a type, a target and a title that follows the
 * target until the user writes their own.
 */
export function ObjectiveEditor({
  value,
  onChange,
  lookup,
  skills,
  materials,
  problems,
  showAllProblems,
  label,
  menu,
  footer,
  className,
}: ObjectiveEditorProps) {
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const touch = (fieldId: string) => setTouched((current) => (current.has(fieldId) ? current : new Set(current).add(fieldId)));
  const problemFor = (fieldId: string) => {
    const problem = problems.find((candidate) => candidate.fieldId === fieldId);
    return problem && (showAllProblems || touched.has(fieldId) || isStructural(problem, value)) ? problem : undefined;
  };
  const errorId = useId();

  const update = (patch: Partial<ObjectiveForm>) => onChange({ ...value, ...patch });
  const updateKeyResult = (key: string, change: KeyResultChange) => {
    const keyResults = value.keyResults.map((kr) => (kr.key === key ? changeKeyResult(kr, change, lookup) : kr));
    if (keyResults.some((kr, i) => kr !== value.keyResults[i])) update({ keyResults });
  };

  const addKeyResult = () => {
    const keyResult = blankKeyResult("material", value.keyResults[0]?.skillId ?? "");
    update({ keyResults: [...value.keyResults, keyResult] });
    focusSoon(fieldIds.skill(value, keyResult));
  };
  const removeKeyResult = (key: string) => {
    if (value.keyResults.length <= MIN_KEY_RESULTS) return;
    update({ keyResults: value.keyResults.filter((kr) => kr.key !== key) });
    focusSoon(fieldIds.addKeyResult(value), fieldIds.keyResults(value));
  };

  const placementProblem = problemFor(fieldIds.placement(value));
  const countProblem = problemFor(fieldIds.keyResults(value));
  const titleProblem = problemFor(fieldIds.title(value));
  const titleId = fieldIds.title(value);

  return (
    <article aria-label={label} className={cn("rounded-xl border bg-card p-3 shadow-xs", className)}>
      <div className="flex items-start gap-1">
        <InlineTextField
          id={titleId}
          className="flex-1"
          inputClassName="font-display text-[0.95rem] leading-snug font-semibold"
          aria-label="Objective"
          placeholder="Name the outcome"
          maxLength={PLAN_DRAFT_LIMITS.objectiveTitle}
          value={value.title}
          invalid={Boolean(titleProblem)}
          aria-describedby={titleProblem ? `${errorId}-title` : undefined}
          onChange={(event) => update({ title: event.target.value })}
          onBlur={() => touch(titleId)}
        />
        {menu}
      </div>
      {titleProblem && <FieldMessage id={`${errorId}-title`}>{titleProblem.message}</FieldMessage>}
      <InlineTextField
        id={fieldIds.why(value)}
        className="mt-0.5"
        inputClassName="text-sm text-muted-foreground"
        aria-label="Why it matters"
        placeholder="Why it matters (optional)"
        maxLength={PLAN_DRAFT_LIMITS.why}
        value={value.why}
        onChange={(event) => update({ why: event.target.value })}
      />
      {placementProblem && (
        // Focusable, so "Fix N things" can land here: Move to quarter… or Remove in the ⋯ menu fixes it.
        <p id={fieldIds.placement(value)} tabIndex={-1} className="mt-1 rounded-sm text-xs font-medium text-destructive outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          {placementProblem.message}
        </p>
      )}

      <ol
        id={fieldIds.keyResults(value)}
        tabIndex={-1}
        className="mt-3 flex flex-col gap-2 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        aria-label="Key results"
        aria-describedby={countProblem ? `${errorId}-count` : undefined}
      >
        {value.keyResults.map((keyResult, index) => (
          <KeyResultEditor
            key={keyResult.key}
            objective={value}
            keyResult={keyResult}
            index={index}
            lookup={lookup}
            skills={skills}
            materials={materials}
            problemFor={problemFor}
            touch={touch}
            canRemove={value.keyResults.length > MIN_KEY_RESULTS}
            onChange={(change) => updateKeyResult(keyResult.key, change)}
            onRemove={() => removeKeyResult(keyResult.key)}
          />
        ))}
      </ol>
      {countProblem && (
        <FieldMessage id={`${errorId}-count`}>{countProblem.message}</FieldMessage>
      )}

      {value.keyResults.length < MAX_KEY_RESULTS && (
        <button
          id={fieldIds.addKeyResult(value)}
          type="button"
          onClick={addKeyResult}
          className="mt-2 inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <PlusIcon className="size-3.5" aria-hidden />
          Key result
        </button>
      )}
      {footer && <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3">{footer}</div>}
    </article>
  );
}

function KeyResultEditor({
  objective,
  keyResult,
  index,
  lookup,
  skills,
  materials,
  problemFor,
  touch,
  canRemove,
  onChange,
  onRemove,
}: {
  objective: ObjectiveForm;
  keyResult: KeyResultForm;
  index: number;
  lookup: EditorLookup;
  skills: readonly Skill[];
  materials: readonly Material[];
  problemFor: (fieldId: string) => Problem | undefined;
  touch: (fieldId: string) => void;
  canRemove: boolean;
  onChange: (change: KeyResultChange) => void;
  onRemove: () => void;
}) {
  const describe = useId();
  const skillId = fieldIds.skill(objective, keyResult);
  const targetId = fieldIds.target(objective, keyResult);
  const titleId = fieldIds.krTitle(objective, keyResult);
  const skillProblem = problemFor(skillId);
  const targetProblem = problemFor(targetId);

  const pickable = useMemo(() => {
    const current = lookup.skills.get(keyResult.skillId);
    return current && !skills.some((skill) => skill.id === current.id) ? [...skills, current] : skills;
  }, [skills, lookup, keyResult.skillId]);

  const choices = useMemo(() => {
    if (!keyResult.skillId || keyResult.type === "count") return [];
    const fitting = materials.filter((material) => fitsKeyResult(material, keyResult.type, keyResult.skillId));
    return [...fitting.filter((m) => m.curated), ...fitting.filter((m) => !m.curated)];
  }, [materials, keyResult.skillId, keyResult.type]);

  const generated = autoTitle(keyResult, lookup);
  const position = `Key result ${index + 1}`;

  return (
    <li aria-label={position} className="flex flex-col gap-2 rounded-lg border bg-background/60 p-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <SkillSelect
          id={skillId}
          value={keyResult.skillId}
          skills={pickable}
          invalid={Boolean(skillProblem)}
          describedBy={skillProblem ? `${describe}-skill` : undefined}
          onChange={(next: ID) => onChange({ skillId: next })}
          onBlur={() => touch(skillId)}
        />
        <button
          type="button"
          onClick={onRemove}
          aria-disabled={!canRemove || undefined}
          aria-label={`Remove ${position.toLowerCase()}`}
          aria-describedby={canRemove ? undefined : `${describe}-limit`}
          title={canRemove ? undefined : KEY_RESULT_LIMIT_HINT}
          className={cn(
            "ml-auto grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
            canRemove ? "hover:bg-muted hover:text-foreground" : "cursor-not-allowed opacity-40",
          )}
        >
          <XIcon className="size-3.5" aria-hidden />
        </button>
        {!canRemove && (
          <span id={`${describe}-limit`} className="sr-only">
            {KEY_RESULT_LIMIT_HINT}
          </span>
        )}
      </div>
      {skillProblem && <FieldMessage id={`${describe}-skill`}>{skillProblem.message}</FieldMessage>}

      <SegmentedControl
        legend={`${position} type`}
        hideLegend
        stretch
        options={TYPE_CHOICES}
        value={keyResult.type}
        onChange={(type) => onChange({ type })}
      />

      {keyResult.type === "count" ? (
        <CountStepper id={targetId} value={keyResult.count ?? DEFAULT_COUNT} onChange={(count) => onChange({ count })} />
      ) : (
        <MaterialCombobox
          id={targetId}
          label={keyResult.type === "certification" ? "Certification" : "Material"}
          materials={choices}
          value={keyResult.materialId}
          disabled={!keyResult.skillId}
          placeholder={
            !keyResult.skillId ? "Pick a skill first" : keyResult.type === "certification" ? "Pick a certification" : "Pick a material"
          }
          invalid={Boolean(targetProblem)}
          describedBy={targetProblem ? `${describe}-target` : undefined}
          onChange={(materialId) => onChange({ materialId })}
          onBlur={() => touch(targetId)}
        />
      )}
      {targetProblem && <FieldMessage id={`${describe}-target`}>{targetProblem.message}</FieldMessage>}
      {keyResult.type === "certification" && keyResult.skillId && choices.length === 0 && (
        <FieldMessage tone="hint">No certifications for this skill yet. Try Material or Count.</FieldMessage>
      )}

      <InlineTextField
        id={titleId}
        inputClassName="text-sm"
        aria-label={`${position} title`}
        placeholder={generated || "Key result title"}
        maxLength={PLAN_DRAFT_LIMITS.keyResultTitle}
        value={keyResult.titleEdited ? keyResult.title : keyResult.title || generated}
        onChange={(event) => onChange({ title: event.target.value })}
        onBlur={() => onChange({ resetTitle: true })}
      />
    </li>
  );
}
