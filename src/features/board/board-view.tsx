"use client";

import { DndContext, DragOverlay, type DropAnimation } from "@dnd-kit/core";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { boardColumns, columnItems } from "@/lib/domain/board";
import { objectivesForQuarter } from "@/lib/domain/okrs";
import { BOARD_COLUMNS, type ID, type PlanItem } from "@/lib/domain/types";
import { useActions, useMaterialMap, useMonthNavigation, useObjectives, usePlanItems, useSkills } from "@/lib/store/hooks";
import { BoardCard, type MoveAction } from "./board-card";
import { BoardColumn } from "./board-column";
import { SortableBoardCard } from "./sortable-board-card";
import { useBoardDrag } from "./use-board-drag";

const OPPOSITE: Record<MoveAction, MoveAction> = { left: "right", right: "left", up: "down", down: "up" };
const NO_MOVES: Record<MoveAction, boolean> = { left: false, up: false, down: false, right: false };
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

  // A moved card re-renders (often in another column), which drops keyboard focus. Put it back.
  const boardRef = useRef<HTMLDivElement>(null);
  const focusRequest = useRef<{ itemId: ID; action: MoveAction } | null>(null);
  useEffect(() => {
    const request = focusRequest.current;
    if (!request) return;
    focusRequest.current = null;
    const cards = boardRef.current?.querySelectorAll<HTMLElement>("[data-item-id]") ?? [];
    const card = [...cards].find((element) => element.dataset.itemId === request.itemId);
    // Same control if still enabled (e.g. at the edge of the board), else the opposite one, else any arrow.
    const target = [request.action, OPPOSITE[request.action]]
      .map((action) => card?.querySelector<HTMLButtonElement>(`[data-move="${action}"]:not(:disabled)`))
      .find(Boolean) ?? card?.querySelector<HTMLButtonElement>("[data-move]:not(:disabled)");
    target?.focus();
  }, [items]);

  const move = (item: PlanItem, action: MoveAction, visibleColumn: PlanItem[], index: number) => {
    focusRequest.current = { itemId: item.id, action };
    if (action === "left" || action === "right") {
      const status = BOARD_COLUMNS[BOARD_COLUMNS.indexOf(item.status) + (action === "left" ? -1 : 1)];
      movePlanItem(item.id, { status, month });
      return;
    }
    // Reorder relative to the visible neighbour, resolved in the full (unfiltered) column.
    const neighbour = visibleColumn[index + (action === "up" ? -1 : 1)];
    const target = columnItems(items, month, item.status).findIndex((candidate) => candidate.id === neighbour.id);
    movePlanItem(item.id, { status: item.status, index: target, month });
  };

  return (
    <div ref={boardRef} className="flex flex-col gap-4">
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
          {BOARD_COLUMNS.map((status, columnIndex) => {
            const ids = drag.columns[status];
            const column = ids.map((itemId) => itemById.get(itemId)).filter((item) => item !== undefined);
            return (
              <BoardColumn key={status} status={status} itemIds={ids} highlighted={drag.overStatus === status}>
                {column.map((item, index) => (
                  <SortableBoardCard
                    key={item.id}
                    item={item}
                    material={materials.get(item.materialId)}
                    skills={skillMap}
                    canMove={{
                      left: columnIndex > 0,
                      right: columnIndex < BOARD_COLUMNS.length - 1,
                      up: index > 0,
                      down: index < column.length - 1,
                    }}
                    onMove={(action) => move(item, action, column, index)}
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
              canMove={NO_MOVES}
              onMove={() => {}}
              onDelete={() => {}}
              className="rotate-2 cursor-grabbing shadow-lg ring-2 ring-ring/40 motion-reduce:rotate-0"
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
