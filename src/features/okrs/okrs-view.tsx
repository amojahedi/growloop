"use client";

import { useState } from "react";
import { Section } from "@/components/app/section";
import { Button } from "@/components/ui/button";
import { formatQuarter } from "@/lib/domain/dates";
import { objectivesForQuarter } from "@/lib/domain/okrs";
import { useActions, useMonthNavigation, useObjectives, usePlanItems } from "@/lib/store/hooks";
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

function NewObjectiveForm() {
  const { addObjective } = useActions();
  const { quarter } = useMonthNavigation();
  const [title, setTitle] = useState("");
  const [keyResult, setKeyResult] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    addObjective({ quarter, title, keyResults: keyResult.trim() ? [{ title: keyResult }] : [] });
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
        <input
          aria-label="First key result"
          placeholder="First key result (optional)"
          className="rounded-md border bg-background px-2 py-1"
          value={keyResult}
          onChange={(event) => setKeyResult(event.target.value)}
        />
        <Button type="submit" size="sm" className="self-start" disabled={!title.trim()}>
          Add objective
        </Button>
      </form>
    </Section>
  );
}
