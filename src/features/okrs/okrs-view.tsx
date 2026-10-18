"use client";

import { useState } from "react";
import { Section } from "@/components/app/section";
import { Button } from "@/components/ui/button";
import { formatQuarter } from "@/lib/domain/dates";
import { objectivesForQuarter } from "@/lib/domain/okrs";
import { useActions, useMonthNavigation, useObjectives, usePlanItems, useSkills } from "@/lib/store/hooks";
import { ObjectiveProgressList } from "./objective-progress-list";

/** Quarterly objectives and key results for the quarter of the viewed month (O-1..O-3). */
export function OkrsView() {
  const objectives = useObjectives();
  const items = usePlanItems();
  const { quarter } = useMonthNavigation();

  return (
    <div className="flex flex-col gap-6">
      <Section title={formatQuarter(quarter)}>
        <ObjectiveProgressList objectives={objectivesForQuarter(objectives, quarter)} items={items} />
      </Section>
      <NewObjectiveForm />
    </div>
  );
}

/** Kept minimal until the wizard and the shared objective editor arrive: one count key result on a chosen skill. */
function NewObjectiveForm() {
  const { addObjective } = useActions();
  const { quarter } = useMonthNavigation();
  const skills = useSkills();
  const [title, setTitle] = useState("");
  const [keyResult, setKeyResult] = useState("");
  const [skillId, setSkillId] = useState(skills[0]?.id ?? "");
  const skill = skills.find((candidate) => candidate.id === skillId);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !skill) return;
    const keyResultTitle = keyResult.trim() || `Complete 3 ${skill.name} items`;
    addObjective({ quarter, title, keyResults: [{ title: keyResultTitle, skillId: skill.id, type: "count", count: 3 }] });
    setTitle("");
    setKeyResult("");
  };

  return (
    <Section title="New objective" description={`For ${formatQuarter(quarter)}`}>
      <form onSubmit={submit} className="flex flex-col gap-2 text-sm">
        <input
          aria-label="Objective"
          placeholder="Objective, e.g. Lead roadmap conversations with confidence"
          className="rounded-md border bg-background px-2 py-1"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <select
          aria-label="Skill"
          className="rounded-md border bg-background px-2 py-1"
          value={skillId}
          onChange={(event) => setSkillId(event.target.value)}
        >
          {skills.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <input
          aria-label="Key result"
          placeholder={skill ? `Key result (optional), e.g. Complete 3 ${skill.name} items` : "Key result (optional)"}
          className="rounded-md border bg-background px-2 py-1"
          value={keyResult}
          onChange={(event) => setKeyResult(event.target.value)}
        />
        <Button type="submit" size="sm" className="self-start" disabled={!title.trim() || !skill}>
          Add objective
        </Button>
      </form>
    </Section>
  );
}
