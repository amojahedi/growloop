"use client";

import { DndContext, DragOverlay, type DropAnimation } from "@dnd-kit/core";
import { useId, useMemo, useState } from "react";
import { boardColumns } from "@/lib/domain/board";
import { objectivesForQuarter } from "@/lib/domain/okrs";
import { BOARD_COLUMNS, type ID, type PlanItem } from "@/lib/domain/types";
import { useActions, useMaterialMap, useMonthNavigation, useObjectives, usePlanItems, useSkills } from "@/lib/store/hooks";
import { BoardCard } from "./board-card";
import { BoardColumn } from "./board-column";
import { SortableBoardCard } from "./sortable-board-card";
import { useBoardDrag } from "./use-board-drag";

const DROP_ANIMATION: DropAnimation = { duration: 220, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.1)" };

// Optional call: jsdom has no matchMedia.
const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/** Kanban board for the selected month (B-1..B-4), filterable by skill and objective. */
export function BoardView() {
  const items = usePlanItems();
  const materials = useMaterialMap();
  const skills = useSkills({ includeHidden: true });
  const objectives = useObjectives();
  const { month, quarter } = useMonthNavigation();
  const { movePlanItem, deletePlanItem } = useActions();
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
  const itemById = new Map(items.map((item) => [item.id, item]));
  const titleOf = (itemId: ID) => {
    const item = itemById.get(itemId);
    return (item && materials.get(item.materialId)?.title) ?? "Unknown material";
  };
  const drag = useBoardDrag({ columns, items, month, titleOf, onMove: movePlanItem });
  // Stable ids for dnd-kit's aria attributes, so they match between server and client.
  const dndId = useId();
  const activeItem = drag.activeId ? itemById.get(drag.activeId) : undefined;

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

      <DndContext id={dndId} {...drag.contextProps}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {BOARD_COLUMNS.map((status) => {
            const ids = drag.columns[status];
            const column = ids.map((itemId) => itemById.get(itemId)).filter((item) => item !== undefined);
            return (
              <BoardColumn key={status} status={status} itemIds={ids} highlighted={drag.overStatus === status}>
                {column.map((item) => (
                  <SortableBoardCard
                    key={item.id}
                    item={item}
                    material={materials.get(item.materialId)}
                    skills={skillMap}
                    onDelete={() => window.confirm(`Remove "${titleOf(item.id)}" from your plan?`) && deletePlanItem(item.id)}
                  />
                ))}
              </BoardColumn>
            );
          })}
        </div>
        <DragOverlay dropAnimation={prefersReducedMotion() ? null : DROP_ANIMATION}>
          {activeItem && (
            <BoardCard
              item={activeItem}
              material={materials.get(activeItem.materialId)}
              skills={skillMap}
              className="rotate-2 cursor-grabbing shadow-lg ring-2 ring-ring/40 motion-reduce:rotate-0"
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
