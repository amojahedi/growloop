"use client";

import { useMemo, useState } from "react";
import { boardColumns, columnItems } from "@/lib/domain/board";
import { objectivesForQuarter } from "@/lib/domain/okrs";
import { BOARD_COLUMNS, type ID, type PlanItem } from "@/lib/domain/types";
import { useActions, useMaterialMap, useMonthNavigation, useObjectives, usePlanItems, useSkills } from "@/lib/store/hooks";
import { BoardCard } from "./board-card";
import { STATUS_LABELS } from "./board-labels";

/** Kanban board for the selected month (B-1..B-4), filterable by skill and objective. */
export function BoardView() {
  const items = usePlanItems();
  const materials = useMaterialMap();
  const skills = useSkills({ includeHidden: true });
  const objectives = useObjectives();
  const { month, quarter } = useMonthNavigation();
  const [skillFilter, setSkillFilter] = useState<ID>("");
  const [objectiveFilter, setObjectiveFilter] = useState<ID>("");

  const skillMap = useMemo(() => new Map(skills.map((skill) => [skill.id, skill])), [skills]);
  const quarterObjectives = objectivesForQuarter(objectives, quarter);
  const objectiveKeyResults = new Set(
    quarterObjectives.find((o) => o.id === objectiveFilter)?.keyResults.map((kr) => kr.id) ?? [],
  );

  const matches = (item: PlanItem) =>
    (!skillFilter || item.skillIds.includes(skillFilter)) &&
    (!objectiveFilter || (item.keyResultId !== undefined && objectiveKeyResults.has(item.keyResultId)));
  const columns = boardColumns(items, month, matches);

  const { movePlanItem } = useActions();
  /** Moves an item to its visible neighbour's slot in the full (unfiltered) column. */
  const moveNextTo = (item: PlanItem, neighbour: PlanItem | undefined) =>
    neighbour
      ? () => {
          const index = columnItems(items, month, item.status).findIndex((candidate) => candidate.id === neighbour.id);
          movePlanItem(item.id, { status: item.status, index });
        }
      : undefined;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <select
          aria-label="Filter by skill"
          className="rounded-md border bg-background px-2 py-1"
          value={skillFilter}
          onChange={(event) => setSkillFilter(event.target.value)}
        >
          <option value="">All skills</option>
          {skills.filter((skill) => !skill.hidden).map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by objective"
          className="rounded-md border bg-background px-2 py-1"
          value={objectiveFilter}
          onChange={(event) => setObjectiveFilter(event.target.value)}
        >
          <option value="">All objectives</option>
          {quarterObjectives.map((objective) => (
            <option key={objective.id} value={objective.id}>
              {objective.title}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {BOARD_COLUMNS.map((status) => (
          <section key={status} aria-labelledby={`column-${status}`} className="rounded-xl bg-muted p-3">
            <h2 id={`column-${status}`} className="mb-3 text-sm font-medium">
              {STATUS_LABELS[status]} <span className="text-muted-foreground">{columns[status].length}</span>
            </h2>
            <ul className="flex flex-col gap-2">
              {columns[status].map((item, index) => (
                <BoardCard
                  key={item.id}
                  item={item}
                  onMoveUp={moveNextTo(item, columns[status][index - 1])}
                  onMoveDown={moveNextTo(item, columns[status][index + 1])}
                  material={materials.get(item.materialId)}
                  skills={skillMap}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
