"use client";

import { DndContext, DragOverlay, type DropAnimation } from "@dnd-kit/core";
import { cn } from "cn";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { boardColumns, type MoveTarget } from "@/lib/domain/board";
import { isSummarized } from "@/lib/domain/notes";
import { objectivesForQuarter } from "@/lib/domain/okrs";
import type { BoardStatus, ID, PlanItem } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";
import { useActions, useMaterialMap, useObjectives, usePlanItems, useSkills } from "@/lib/store/hooks";
import { CardDetailDrawer } from "../card/card-detail-drawer";
import { monthsLabel } from "../review/labels";
import { ReviewBanner } from "../review/review-banner";
import { BoardCard } from "./board-card";
import { BoardColumn } from "./board-column";
import { BoardFilterChips, BoardFilters } from "./board-filters";
import { STATUS_LABELS } from "./board-labels";
import {
  isReadOnlyMonth,
  matchesFilters,
  menuMoves,
  monthProgress,
  movedToMessage,
  NO_FILTERS,
  visibleColumns,
  type BoardFilters as Filters,
} from "./board-model";
import { EarnedDialog } from "./earned-dialog";
import { SortableBoardCard, StaticBoardCard } from "./sortable-board-card";
import { useBoardDrag } from "./use-board-drag";
import { useBoardMonth } from "./use-board-month";
import { useCardParam } from "./use-card-param";

const DROP_ANIMATION: DropAnimation = { duration: 220, easing: "cubic-bezier(0.2, 0.9, 0.3, 1.1)" };

export const SUMMARY_NUDGE = "Nice. Add a two-line summary while it's fresh?";

// Optional call: jsdom has no matchMedia.
const prefersReducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const cardSelector = (id: ID) => `[data-item-id="${id}"] [data-card-handle]`;
const columnSelector = (status: BoardStatus) => `[data-column="${status}"]`;
const focusNow = (selector: string) => document.querySelector<HTMLElement>(selector)?.focus();

/**
 * Moves focus once the next render is on screen: a card that changed column
 * is a new element, and a removed card's neighbour may have shifted.
 */
function useFocusAfterRender() {
  const [request, setRequest] = useState<{ selector: string; id: number } | null>(null);
  useEffect(() => {
    if (!request) return;
    // After Radix has finished restoring focus for a closing menu or dialog.
    const timer = setTimeout(() => focusNow(request.selector), 0);
    return () => clearTimeout(timer);
  }, [request]);
  return (selector: string) => setRequest((current) => ({ selector, id: (current?.id ?? 0) + 1 }));
}

/** A polite live region for moves made with the ⋯ menu (drag moves are announced by dnd-kit). */
function useAnnouncer() {
  const [message, setMessage] = useState("");
  // Alternating a trailing no-break space makes a repeated message a change, so it is read again.
  const toggle = useRef(false);
  const announce = (text: string) => {
    toggle.current = !toggle.current;
    setMessage(toggle.current ? text : `${text} `);
  };
  const region = (
    <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </p>
  );
  return { announce, region };
}

/**
 * The board for the viewed month (B-1 to B-7, board.md): progress line,
 * filters, four columns with drag and drop and a ⋯ menu per card, the
 * month-end review banner, read-only past months and the card drawer for
 * `?item=<id>`. Must be inside `<DataGate>` and a `<Suspense>` boundary (it reads the URL).
 */
export function BoardView() {
  const items = usePlanItems();
  const materials = useMaterialMap();
  const skills = useSkills();
  const objectives = useObjectives();
  const { month, quarter, currentMonth, goToCurrentMonth } = useBoardMonth();
  const { movePlanItem, removePlanItem, restorePlanItem, setItemEarned, markSummaryNudged } = useActions();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  // The certification the "Did you earn…?" dialog asks about; kept after closing so focus can return to it.
  const [earned, setEarned] = useState<{ id: ID; open: boolean } | null>(null);
  const { itemId: openItemId, openCard, closeCard } = useCardParam();
  const focusAfterRender = useFocusAfterRender();
  const { announce, region } = useAnnouncer();

  const readOnly = isReadOnlyMonth(month, currentMonth);
  const statuses = visibleColumns(readOnly);
  const monthName = monthsLabel([month]);
  const quarterObjectives = objectivesForQuarter(objectives, quarter);
  const objective = quarterObjectives.find((candidate) => candidate.id === filters.objectiveId);
  const filtering = filters.skillIds.length > 0 || objective !== undefined;

  const all = boardColumns(items, month);
  const columns = filtering ? boardColumns(items, month, matchesFilters(filters, objective)) : all;
  const itemById = new Map(items.map((item) => [item.id, item]));
  const titleOf = (itemId: ID) => {
    const item = itemById.get(itemId);
    return (item && materials.get(item.materialId)?.title) ?? "Unknown material";
  };
  const focusCard = (id: ID) => focusAfterRender(cardSelector(id));
  /** Guard for every change: only cards on the current month's board can be moved, removed or marked. */
  const editable = (id: ID) => !readOnly && statuses.some((status) => all[status].some((item) => item.id === id));

  // --- Moving to Done (board.md §Moving to Done) ----------------------------------

  const nudgeSummary = (id: ID) => {
    const { data } = useAppStore.getState();
    const item = data.planItems.find((candidate) => candidate.id === id);
    if (!item || item.summaryNudgedAt || isSummarized(id, data.notes)) return;
    markSummaryNudged(id);
    toast({ message: SUMMARY_NUDGE, action: { label: "Write summary", onClick: () => openCard(id, { focus: "summary" }) } });
  };

  /** Moves a card; returns true when the move opened the "Did you earn…?" dialog. */
  const move = (id: ID, target: MoveTarget): boolean => {
    const before = itemById.get(id);
    if (!editable(id)) return false;
    // Always onto this board's month (the current one).
    movePlanItem(id, { ...target, month });
    if (!before || before.status === "done" || target.status !== "done") return false;
    const certification = materials.get(before.materialId)?.type === "certification";
    if (certification && !before.earnedAt) {
      setEarned({ id, open: true });
      return true;
    }
    nudgeSummary(id);
    return false;
  };

  const answerEarned = (answer: boolean | undefined) => {
    if (!earned?.open) return;
    setEarned({ id: earned.id, open: false });
    if (answer) setItemEarned(earned.id, true);
    nudgeSummary(earned.id);
  };

  const drag = useBoardDrag({ columns, items, month, titleOf, onMove: move });
  // Stable ids for dnd-kit's aria attributes, so they match between server and client.
  const dndId = useId();
  const activeItem = drag.activeId ? itemById.get(drag.activeId) : undefined;

  // --- ⋯ menu actions ------------------------------------------------------------

  const open = (id: ID) => {
    // From the menu, the card takes focus first, so the drawer returns focus to it on close.
    focusNow(cardSelector(id));
    openCard(id);
  };

  const menuMove = (item: PlanItem, target: MoveTarget, kind: "column" | "up" | "down") => {
    if (!editable(item.id)) return;
    const title = titleOf(item.id);
    const opensDialog = move(item.id, target);
    announce(kind === "column" ? movedToMessage(title, STATUS_LABELS[target.status]) : `Moved ${title} ${kind}.`);
    if (!opensDialog) focusCard(item.id);
  };

  const remove = (item: PlanItem) => {
    if (!editable(item.id)) return;
    const status = statuses.find((candidate) => drag.columns[candidate].includes(item.id));
    const column = status ? drag.columns[status] : [];
    const index = column.indexOf(item.id);
    const neighbour = column[index + 1] ?? column[index - 1];
    // Its slot in the full column, so Undo puts it back there even if the column changed meanwhile.
    const slot = all[item.status].findIndex((candidate) => candidate.id === item.id);
    const removed = removePlanItem(item.id);
    if (!removed) return;
    toast({
      message: `Removed from ${monthName}`,
      action: {
        label: "Undo",
        onClick: () => {
          restorePlanItem(removed);
          // Re-slotting renumbers the column, so a reorder made before Undo can't leave two cards with one order.
          movePlanItem(item.id, { status: item.status, index: Math.max(0, slot), month });
          focusCard(item.id);
        },
      },
    });
    if (neighbour) focusCard(neighbour);
    else if (status) focusAfterRender(columnSelector(status));
  };

  const markEarned = (id: ID) => {
    if (!editable(id)) return;
    setItemEarned(id, true);
    focusCard(id);
  };

  // --- Rendering -----------------------------------------------------------------

  const progress = monthProgress(items, month);
  const nothingInMonth = statuses.every((status) => all[status].length === 0);
  const nothingMatches = filtering && !nothingInMonth && statuses.every((status) => columns[status].length === 0);
  const clearFilters = () => setFilters(NO_FILTERS);
  const backToCurrentMonth = () => {
    goToCurrentMonth();
    // The button goes away with the past month: continue from the top of the page content.
    focusAfterRender("#content");
  };

  const emptyCopy = (status: BoardStatus): React.ReactNode => {
    if (filtering || readOnly) return null;
    switch (status) {
      case "backlog":
        return "Things you'll do, just not this month.";
      case "todo":
        return all.backlog.length > 0 ? (
          `Pick 3 for ${monthName}. Drag from Backlog, or use ⋯ → Move to To do.`
        ) : (
          <>
            Add from the{" "}
            <Link href="/library" className="font-medium text-primary underline underline-offset-4">
              Library
            </Link>{" "}
            to plan this month.
          </>
        );
      case "in_progress":
        return "Drag a card here when you start.";
      case "done":
        return "Finished cards land here.";
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {region}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          {progress.planned > 0 && `${progress.done} of ${progress.planned} done`}
        </p>
        <BoardFilters filters={filters} skills={skills} objectives={quarterObjectives} onChange={setFilters} />
      </div>
      <BoardFilterChips filters={filters} skills={skills} objective={objective} onChange={setFilters} />

      <ReviewBanner />

      {readOnly && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-xs">
          <p className="flex-1">
            You&apos;re looking at {monthName}. Cards are read-only, but notes stay editable.
          </p>
          <Button variant="outline" size="sm" onClick={backToCurrentMonth}>
            Back to {monthsLabel([currentMonth])}
          </Button>
        </div>
      )}

      {nothingMatches && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <p>No cards match these filters.</p>
          <Button variant="outline" size="sm" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      )}

      {nothingInMonth ? (
        <EmptyBoard readOnly={readOnly} monthName={monthName} currentMonthName={monthsLabel([currentMonth])} onBack={backToCurrentMonth} />
      ) : (
        <DndContext id={dndId} {...drag.contextProps}>
          <div className={cn("grid gap-4 md:grid-cols-2", readOnly ? "xl:grid-cols-3" : "xl:grid-cols-4")}>
            {statuses.map((status) => {
              const ids = drag.columns[status];
              const column = ids.map((itemId) => itemById.get(itemId)).filter((item) => item !== undefined);
              return (
                <BoardColumn
                  key={status}
                  status={status}
                  itemIds={ids}
                  highlighted={drag.overStatus === status}
                  empty={emptyCopy(status)}
                >
                  {column.map((item) =>
                    readOnly ? (
                      <StaticBoardCard key={item.id} item={item} material={materials.get(item.materialId)} onOpen={() => open(item.id)} />
                    ) : (
                      <SortableBoardCard
                        key={item.id}
                        item={item}
                        material={materials.get(item.materialId)}
                        dragging={drag.activeId !== undefined}
                        moves={menuMoves(drag.columns, item.id, items, month, statuses)}
                        onOpen={() => open(item.id)}
                        onMove={(target, kind) => menuMove(item, target, kind)}
                        onRemove={() => remove(item)}
                        onMarkEarned={
                          item.status === "done" &&
                          !item.earnedAt &&
                          materials.get(item.materialId)?.type === "certification"
                            ? () => markEarned(item.id)
                            : undefined
                        }
                      />
                    ),
                  )}
                </BoardColumn>
              );
            })}
          </div>
          <DragOverlay dropAnimation={prefersReducedMotion() ? null : DROP_ANIMATION}>
            {activeItem && (
              <BoardCard
                item={activeItem}
                material={materials.get(activeItem.materialId)}
                className="rotate-2 cursor-grabbing shadow-lg ring-2 ring-ring/40 motion-reduce:rotate-0"
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      <EarnedDialog
        title={earned?.open ? titleOf(earned.id) : null}
        onAnswer={answerEarned}
        onCloseAutoFocus={() => earned && focusNow(cardSelector(earned.id))}
      />
      <CardDetailDrawer
        itemId={openItemId}
        onClose={() => {
          const id = openItemId;
          closeCard();
          if (id) focusCard(id);
        }}
      />
    </div>
  );
}

function EmptyBoard({
  readOnly,
  monthName,
  currentMonthName,
  onBack,
}: {
  readOnly: boolean;
  monthName: string;
  currentMonthName: string;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed bg-card px-6 py-10 text-sm">
      {readOnly ? (
        <>
          <p>Nothing was planned for {monthName}.</p>
          <Button variant="outline" size="sm" onClick={onBack}>
            Back to {currentMonthName}
          </Button>
        </>
      ) : (
        <>
          <p>
            <strong className="font-display text-base font-semibold">Nothing on your {monthName} board yet.</strong>{" "}
            <span className="text-muted-foreground">Three to five things is a good month.</span>
          </p>
          <Button asChild size="sm">
            <Link href="/library">Find something to learn</Link>
          </Button>
        </>
      )}
    </div>
  );
}
