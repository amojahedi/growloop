"use client";

import { ExternalLinkIcon } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { taskProgress } from "@/lib/domain/plan-items";
import type { ID } from "@/lib/domain/types";
import { useMaterialMap, usePlanItems } from "@/lib/store/hooks";
import { STATUS_LABELS } from "../board/board-labels";
import { TYPE_LABELS } from "../library/labels";

export interface CardDetailDrawerProps {
  /** The card to show; `null` keeps the drawer closed. Unknown ids keep it closed too. */
  itemId: ID | null;
  /** Called when the user closes the drawer (Esc, ×, scrim). */
  onClose: () => void;
}

/**
 * The card drawer (card-detail.md), rendered by the board for `?item=<id>`.
 * WP0 stub: header, status and task count; WP4 replaces the body.
 */
export function CardDetailDrawer({ itemId, onClose }: CardDetailDrawerProps) {
  const item = usePlanItems().find((candidate) => candidate.id === itemId);
  const material = useMaterialMap().get(item?.materialId ?? "");

  const tasks = item ? taskProgress(item) : undefined;
  const title = material?.title ?? "Removed material";

  return (
    <Sheet open={Boolean(item)} onOpenChange={(open) => !open && onClose()}>
      {item && (
        <SheetContent size="card">
          <SheetHeader>
            <p className="text-xs text-muted-foreground">
              {[material && TYPE_LABELS[material.type], material?.author].filter(Boolean).join(" · ")}
            </p>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{STATUS_LABELS[item.status]}</SheetDescription>
          </SheetHeader>
          <SheetBody>
            {material?.url && (
              <a
                href={material.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 self-start underline underline-offset-4"
              >
                Open link
                <ExternalLinkIcon className="size-3.5" aria-hidden />
              </a>
            )}
            {tasks && tasks.total > 0 && (
              <p className="text-muted-foreground">
                Tasks: {tasks.done} of {tasks.total}
              </p>
            )}
          </SheetBody>
        </SheetContent>
      )}
    </Sheet>
  );
}
