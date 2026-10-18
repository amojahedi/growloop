"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "cn";
import { AwardIcon } from "lucide-react";
import type { KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import type { MoveTarget } from "@/lib/domain/board";
import type { Material, PlanItem } from "@/lib/domain/types";
import { useSkillPreviewTrigger } from "@/lib/store/hooks";
import { BoardCard } from "./board-card";
import type { MenuMoves } from "./board-model";
import { CardMenu } from "./card-menu";

export interface BoardCardItemProps {
  item: PlanItem;
  material: Material | undefined;
  /** Some card is being dragged: ⋯ buttons hide on every card. */
  dragging: boolean;
  /** What the ⋯ menu offers; ignored by the read-only card, whose menu only opens it. */
  moves: MenuMoves;
  onOpen: () => void;
  onMove: (target: MoveTarget, kind: "column" | "up" | "down") => void;
  onRemove: () => void;
  /** Shown for a Done certification that isn't marked earned yet. */
  onMarkEarned?: () => void;
}

const HANDLE_CLASSES =
  "outline-none hover:border-input hover:shadow-md focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * The ⋯ button: shown on hover and focus-within for fine pointers, always on
 * touch screens (`hover: none`), and kept while its menu is open.
 */
const MENU_CLASSES =
  "absolute top-2.5 right-2.5 opacity-0 group-hover/card:opacity-100 group-focus-within/card:opacity-100 data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100";

/** Opens the card on these keys when the card itself has focus. Draggable cards keep Space for picking up. */
const opensOn = (keys: readonly string[], onOpen: () => void) => (event: KeyboardEvent<HTMLDivElement>) => {
  if (keys.includes(event.key) && event.target === event.currentTarget) {
    event.preventDefault();
    onOpen();
  }
};

/**
 * A draggable board card (B-2). The card itself is the focusable drag handle
 * for the keyboard (Space picks it up) and opens the drawer on click or Enter;
 * the ⋯ menu and "Mark as earned" are its siblings, not its children, so the
 * handle holds no nested controls. The drag listeners sit on the handle only:
 * presses on the siblings (and on the menu, whose portal events bubble through
 * the React tree to the list item) never start a drag. Pointers can grab
 * anywhere on the card: the sensors' activation distance keeps clicks working.
 * Hovering or focusing the card previews its skill impact on any radar on screen
 * (S-4); previews are cleared and paused while any card is being dragged.
 */
export function SortableBoardCard({ dragging, moves, onOpen, onMove, onRemove, onMarkEarned, ...props }: BoardCardItemProps) {
  const { active, attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: props.item.id,
      attributes: { roleDescription: "draggable card" },
    });
  const title = props.material?.title ?? "Unknown material";
  const previewTrigger = useSkillPreviewTrigger(
    { id: props.item.id, label: title, source: props.item },
    { paused: active !== null },
  );
  const openOnEnter = opensOn(["Enter"], onOpen);

  return (
    <li
      ref={setNodeRef}
      data-item-id={props.item.id}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("group/card relative", isDragging && "opacity-40")}
      {...previewTrigger}
    >
      <BoardCard
        {...props}
        {...attributes}
        {...listeners}
        footerInset={onMarkEarned !== undefined}
        ref={setActivatorNodeRef}
        onKeyDown={(event) => {
          listeners?.onKeyDown?.(event);
          // A keyboard drag also ends with Enter: don't open the card on that key press.
          if (active === null) openOnEnter(event);
        }}
        onClick={onOpen}
        className={cn("cursor-grab", HANDLE_CLASSES)}
      />
      {!dragging && (
        <CardMenu title={title} moves={moves} onOpen={onOpen} onMove={onMove} onRemove={onRemove} className={MENU_CLASSES} />
      )}
      {onMarkEarned && <MarkEarnedButton title={title} onClick={onMarkEarned} />}
    </li>
  );
}

/**
 * A card in a read-only month (B-5): not draggable, so Enter and Space both
 * open it, like any button; its ⋯ menu only opens it.
 * The drawer keeps summary, notes and review later editable.
 */
export function StaticBoardCard({ item, material, onOpen }: Pick<BoardCardItemProps, "item" | "material" | "onOpen">) {
  const title = material?.title ?? "Unknown material";
  const previewTrigger = useSkillPreviewTrigger({ id: item.id, label: title, source: item });

  return (
    <li data-item-id={item.id} className="group/card relative" {...previewTrigger}>
      <BoardCard
        item={item}
        material={material}
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={opensOn(["Enter", " "], onOpen)}
        className={cn("cursor-pointer", HANDLE_CLASSES)}
      />
      <CardMenu title={title} moves={null} onOpen={onOpen} onMove={() => {}} onRemove={() => {}} className={MENU_CLASSES} />
    </li>
  );
}

function MarkEarnedButton({ title, onClick }: { title: string; onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="xs"
      className="absolute right-2.5 bottom-2.5 text-primary"
      aria-label={`Mark ${title} as earned`}
      onClick={onClick}
    >
      <AwardIcon aria-hidden />
      Mark as earned
    </Button>
  );
}
