"use client";

import { useState } from "react";
import { SkillIcon } from "@/components/icons";
import { Section } from "@/components/app/section";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { skillColorVar } from "@/lib/theme/skill-colors";
import { useActions, useSkills } from "@/lib/store/hooks";
import { useUIStore } from "@/lib/store/ui-store";

/** Skill list with add, hide / show and delete (S-1, S-2); a skill's name opens its sheet. */
export function SkillsView() {
  const skills = useSkills({ includeHidden: true });
  const { addSkill, setSkillHidden, deleteSkill, restoreSkill } = useActions();
  const openSkillSheet = useUIStore((state) => state.openSkillSheet);

  const remove = (id: string, name: string) => {
    const result = deleteSkill(id);
    if (!result.ok) {
      if (result.reason === "used-by-key-result") toast({ message: "Used by a key result. Hide it, or change that key result first." });
      return;
    }
    const cards = result.removedFromItems;
    toast({
      message: `Deleted ${name}${cards > 0 ? ` · removed from ${cards} ${cards === 1 ? "card" : "cards"}` : ""}`,
      action: { label: "Undo", onClick: () => restoreSkill(result.deleted) },
    });
  };
  const [name, setName] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    addSkill({ name });
    setName("");
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Your skills">
        <ul className="divide-y">
          {skills.map((skill) => (
            <li key={skill.id} className="flex items-center justify-between gap-2 py-2 text-sm">
              <button
                type="button"
                onClick={() => openSkillSheet(skill.id)}
                className={skill.hidden ? "text-muted-foreground" : "hover:underline"}
              >
                <span className="inline-flex items-center gap-2">
                  <SkillIcon name={skill.icon} className="size-4" style={{ color: skillColorVar(skill.color) }} />
                  {skill.name}
                  {skill.hidden && " (hidden)"}
                </span>
              </button>
              <span className="flex gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setSkillHidden(skill.id, !skill.hidden)}
                  aria-label={`${skill.hidden ? "Show" : "Hide"} ${skill.name}`}
                >
                  {skill.hidden ? "Show" : "Hide"}
                </Button>
                {!skill.builtIn && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => remove(skill.id, skill.name)}
                    aria-label={`Delete ${skill.name}`}
                  >
                    Delete
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Add a skill">
        <form onSubmit={submit} className="flex gap-2">
          <input
            aria-label="Skill name"
            placeholder="e.g. Negotiation"
            className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <Button type="submit" size="sm" disabled={!name.trim()}>
            Add skill
          </Button>
        </form>
      </Section>
    </div>
  );
}
