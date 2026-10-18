"use client";

import { cn } from "cn";
import { ArrowDownIcon, ArrowUpIcon, EllipsisIcon, PanelRightOpenIcon, Trash2Icon } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { MoveTarget } from "@/lib/domain/board";
import type { BoardStatus } from "@/lib/domain/types";
import { STATUS_LABELS } from "./board-labels";
import type { MenuMoves } from "./board-model";

export interface CardMenuProps {
  title: string;
  /** What the card can do; `null` in read-only months, where the menu only opens the card. */
  moves: MenuMoves | null;
  onOpen: () => void;
  onMove: (target: MoveTarget, kind: "column" | "up" | "down") => void;
  onRemove: () => void;
  className?: string;
}

/**
 * The ⋯ menu on every card (board.md §Move to…): the non-drag way to move a
 * card (WCAG 2.5.7), plus Open and Remove from board. Every action moves focus
 * itself (to the card, the moved card, or a neighbour after Remove), so the
 * menu doesn't return focus to its trigger, which may no longer exist.
 */
export function CardMenu({ title, moves, onOpen, onMove, onRemove, className }: CardMenuProps) {
  // Set by an action that takes care of focus itself.
  const focusHandled = useRef(false);
  const handled = (action: () => void) => () => {
    focusHandled.current = true;
    action();
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${title}`} className={cn("text-muted-foreground", className)}>
          <EllipsisIcon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-52"
        onCloseAutoFocus={(event) => {
          if (focusHandled.current) event.preventDefault();
          focusHandled.current = false;
        }}
      >
        <DropdownMenuItem onSelect={handled(onOpen)}>
          <PanelRightOpenIcon aria-hidden />
          Open
        </DropdownMenuItem>
        {moves && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Move to</DropdownMenuLabel>
              {moves.moveTo.map((status: BoardStatus) => (
                <DropdownMenuItem
                  key={status}
                  inset
                  aria-label={`Move to ${STATUS_LABELS[status]}`}
                  onSelect={handled(() => onMove({ status }, "column"))}
                >
                  {STATUS_LABELS[status]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            {(moves.up || moves.down) && <DropdownMenuSeparator />}
            {moves.up && (
              <DropdownMenuItem onSelect={handled(() => onMove(moves.up!, "up"))}>
                <ArrowUpIcon aria-hidden />
                Move up
              </DropdownMenuItem>
            )}
            {moves.down && (
              <DropdownMenuItem onSelect={handled(() => onMove(moves.down!, "down"))}>
                <ArrowDownIcon aria-hidden />
                Move down
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={handled(onRemove)}>
              <Trash2Icon aria-hidden />
              Remove from board
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
