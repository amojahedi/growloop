"use client";

import { PanelRightOpenIcon } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Section } from "@/components/app/section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import type { Skill, SkillColor } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";
import { isSampleModeOn } from "@/lib/store/device";
import { useActions, useSkills } from "@/lib/store/hooks";
import { useUIStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";
import { SkillColorPicker } from "./skill-color-picker";
import {
  canHideMore,
  canShowMore,
  deleteWouldBreakMinimum,
  firstUnusedColor,
  KEEP_THREE_VISIBLE,
  MAX_SKILL_NAME_LENGTH,
  PICK_A_DIFFERENT_NAME,
  restorableSkill,
  USED_BY_KEY_RESULT,
  validSkillName,
} from "./skill-rules";

/**
 * Settings → Skills (skills.md §Settings → Skills, S-2): color, inline rename,
 * hide / show (3 to 16 visible), delete own skills with undo, add. Each row
 * also opens the skill's sheet.
 */
export function SkillsSettings() {
  const skills = useSkills({ includeHidden: true });
  const { deleteSkill, restoreSkill } = useActions();
  const limitsId = useId();
  const keepThreeId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const addInputRef = useRef<HTMLInputElement>(null);
  const hideBlocked = !canHideMore(skills);
  const showBlocked = !canShowMore(skills);

  const remove = (skill: Skill, index: number) => {
    if (deleteWouldBreakMinimum(skill, skills)) return;
    const result = deleteSkill(skill.id);
    if (!result.ok) {
      if (result.reason === "used-by-key-result") toast({ message: USED_BY_KEY_RESULT });
      return;
    }
    const cards = result.removedFromItems;
    const sampleMode = isSampleModeOn();
    toast({
      message: `Deleted ${skill.name}${cards > 0 ? ` · removed from ${cards} ${cards === 1 ? "card" : "cards"}` : ""}`,
      action: {
        label: "Undo",
        onClick: () => {
          // Another workspace is loaded now (e.g. sample data switched in another tab).
          if (isSampleModeOn() !== sampleMode) return;
          // The rules that hold now: hidden at 16 visible, renamed if the name was reused.
          restoreSkill(restorableSkill(result.deleted, useAppStore.getState().data.skills));
        },
      },
    });
    // The row is gone: keep focus in the list (the next row, else the add field).
    requestAnimationFrame(() => {
      const names = listRef.current?.querySelectorAll<HTMLElement>("[data-skill-name]");
      (names?.[Math.min(index, names.length - 1)] ?? addInputRef.current)?.focus();
    });
  };

  return (
    <Section
      title="Skills"
      action={
        <p id={limitsId} className="text-xs text-muted-foreground">
          Keep 3 to 16 visible.
        </p>
      }
    >
      <ul ref={listRef} className="flex flex-col divide-y">
        {skills.map((skill, index) => (
          <SkillRow
            key={skill.id}
            skill={skill}
            skills={skills}
            hideBlocked={hideBlocked}
            showBlocked={showBlocked}
            keepThreeId={keepThreeId}
            limitsId={limitsId}
            onDelete={() => remove(skill, index)}
          />
        ))}
      </ul>
      {hideBlocked && (
        <p id={keepThreeId} className="mt-2 text-xs text-muted-foreground">
          {KEEP_THREE_VISIBLE}
        </p>
      )}
      <AddSkillForm skills={skills} disabled={showBlocked} limitsId={limitsId} inputRef={addInputRef} />
    </Section>
  );
}

function SkillRow({
  skill,
  skills,
  hideBlocked,
  showBlocked,
  keepThreeId,
  limitsId,
  onDelete,
}: {
  skill: Skill;
  skills: readonly Skill[];
  hideBlocked: boolean;
  showBlocked: boolean;
  keepThreeId: string;
  limitsId: string;
  onDelete: () => void;
}) {
  const { updateSkill, setSkillHidden } = useActions();
  const openSkillSheet = useUIStore((state) => state.openSkillSheet);
  const [editing, setEditing] = useState(false);
  const nameButtonRef = useRef<HTMLButtonElement>(null);
  const refocusName = useRef(false);

  useEffect(() => {
    if (!editing && refocusName.current) {
      refocusName.current = false;
      nameButtonRef.current?.focus();
    }
  }, [editing]);

  /** Enter and Esc return focus to the name; Tab or a click elsewhere keeps it where it went. */
  const stopEditing = (refocus: boolean) => {
    refocusName.current = refocus;
    setEditing(false);
  };

  // Hiding is blocked at 3 visible, showing at 16; the reason stays readable on the focusable button.
  const toggleBlocked = skill.hidden ? showBlocked : hideBlocked;
  // Deleting a visible skill at 3 visible would break the radar too.
  const deleteBlocked = deleteWouldBreakMinimum(skill, skills);

  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 text-sm">
      <SkillColorPicker
        value={skill.color}
        label={`Color for ${skill.name}`}
        onChange={(color) => updateSkill(skill.id, { color })}
      />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {editing ? (
          <RenameField skill={skill} skills={skills} onDone={stopEditing} />
        ) : (
          <button
            ref={nameButtonRef}
            type="button"
            data-skill-name
            title="Rename"
            aria-label={`Rename ${skill.name}`}
            className={cn(
              "min-w-0 truncate rounded-md px-1 py-0.5 text-left font-medium outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
              skill.hidden && "text-muted-foreground",
            )}
            onClick={() => setEditing(true)}
          >
            {skill.name}
          </button>
        )}
        {!editing && skill.hidden && (
          <Badge variant="outline" className="text-muted-foreground">
            Hidden
          </Badge>
        )}
      </div>
      {/* Narrow screens keep the room for the name; built-ins still show by having no Delete. */}
      {skill.builtIn && <span className="hidden text-xs text-muted-foreground sm:inline">Built-in</span>}
      <span className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Open ${skill.name}`}
          title="Open"
          aria-haspopup="dialog"
          onClick={() => openSkillSheet(skill.id)}
        >
          <PanelRightOpenIcon aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="xs"
          aria-label={`${skill.hidden ? "Show" : "Hide"} ${skill.name}`}
          aria-disabled={toggleBlocked || undefined}
          aria-describedby={toggleBlocked ? (skill.hidden ? limitsId : keepThreeId) : undefined}
          className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          onClick={() => {
            if (!toggleBlocked) setSkillHidden(skill.id, !skill.hidden);
          }}
        >
          {skill.hidden ? "Show" : "Hide"}
        </Button>
        {!skill.builtIn && (
          <Button
            variant="ghost"
            size="xs"
            aria-label={`Delete ${skill.name}`}
            aria-disabled={deleteBlocked || undefined}
            aria-describedby={deleteBlocked ? keepThreeId : undefined}
            className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            onClick={() => {
              if (!deleteBlocked) onDelete();
            }}
          >
            Delete
          </Button>
        )}
      </span>
    </li>
  );
}

/** Enter or blur saves, Esc cancels; empty or duplicate names are rejected. */
function RenameField({
  skill,
  skills,
  onDone,
}: {
  skill: Skill;
  skills: readonly Skill[];
  /** `refocus`: finished from the keyboard (Enter or Esc), so focus goes back to the name. */
  onDone: (refocus: boolean) => void;
}) {
  const { updateSkill } = useActions();
  const [value, setValue] = useState(skill.name);
  const [invalid, setInvalid] = useState(false);
  const errorId = useId();
  const done = useRef(false);

  const finish = (save: boolean, refocus: boolean) => {
    if (done.current) return;
    if (save) {
      const name = validSkillName(value, skills, skill.id);
      if (!name) {
        setInvalid(true);
        return;
      }
      if (name !== skill.name) updateSkill(skill.id, { name });
    }
    done.current = true;
    onDone(refocus);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <Input
        autoFocus
        value={value}
        maxLength={MAX_SKILL_NAME_LENGTH}
        aria-label={`Name of ${skill.name}`}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className="h-7"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => {
          setValue(event.target.value);
          setInvalid(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            finish(true, true);
          } else if (event.key === "Escape") {
            event.preventDefault();
            finish(false, true);
          }
        }}
        onBlur={() => finish(true, false)}
      />
      {invalid && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {PICK_A_DIFFERENT_NAME}
        </p>
      )}
    </div>
  );
}

function AddSkillForm({
  skills,
  disabled,
  limitsId,
  inputRef,
}: {
  skills: readonly Skill[];
  disabled: boolean;
  limitsId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const { addSkill } = useActions();
  const [name, setName] = useState("");
  // Follows the first unused color until the user picks one.
  const [pickedColor, setPickedColor] = useState<SkillColor | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const errorId = useId();
  const color = pickedColor ?? firstUnusedColor(skills);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (disabled || !name.trim()) return;
    const valid = validSkillName(name, skills);
    if (!valid) {
      setInvalid(true);
      return;
    }
    addSkill({ name: valid, color });
    setName("");
    setPickedColor(null);
    setAnnouncement(`Added ${valid}.`);
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={submit} className="mt-3 flex flex-col gap-1 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          ref={inputRef}
          value={name}
          maxLength={MAX_SKILL_NAME_LENGTH}
          placeholder="New skill name"
          aria-label="New skill name"
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : disabled ? limitsId : undefined}
          className="min-w-0 flex-1 basis-48"
          onChange={(event) => {
            setName(event.target.value);
            setInvalid(false);
            setAnnouncement("");
          }}
        />
        <SkillColorPicker value={color} label="Color for the new skill" onChange={setPickedColor} />
        <Button type="submit" size="sm" disabled={disabled || !name.trim()}>
          Add skill
        </Button>
      </div>
      {invalid && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {PICK_A_DIFFERENT_NAME}
        </p>
      )}
      <p className="sr-only" role="status">
        {announcement}
      </p>
    </form>
  );
}
