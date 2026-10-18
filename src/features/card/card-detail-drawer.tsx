"use client";

import { AwardIcon, ExternalLinkIcon } from "lucide-react";
import { use, useId, useRef } from "react";
import { MATERIAL_TYPE_ICONS } from "@/components/icons";
import { isEscapeLocal } from "@/components/notes/escape-local";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "@/components/ui/toast";
import { monthOf } from "@/lib/domain/dates";
import { BOARD_COLUMNS, type BoardStatus, type ID, type Material, type PlanItem } from "@/lib/domain/types";
import { formatShortDate } from "@/lib/format";
import { TodayContext, useActions, useArchivedYears, useClockDay, useMaterialMap, usePlanItems } from "@/lib/store/hooks";
import { STATUS_LABELS } from "../board/board-labels";
import { TYPE_LABELS } from "../library/labels";
import { CardAbout } from "./card-about";
import { CardKeyResult } from "./card-key-result";
import { carriedOverLabel, cardQuarter, isReadOnlyCard, monthName, removedMessage } from "./card-mode";
import { CardReminder } from "./card-reminder";
import { CardSkills } from "./card-skills";
import { CardTasks } from "./card-tasks";
import { CardTime } from "./card-time";
import { CardNotes, CardSummary } from "./card-writing";
import { EarnedDialog, useDoneFollowUps } from "./use-done-follow-ups";

export interface CardDetailDrawerProps {
  /** The card to show; `null` keeps the drawer closed. Unknown ids keep it closed too. */
  itemId: ID | null;
  /** Called when the user closes the drawer (Esc, ×, scrim) or removes the card. */
  onClose: () => void;
  /**
   * Forces read-only mode on or off. By default past-month and archived cards
   * are read-only (except summary, notes and review later) and the rest editable.
   */
  readOnly?: boolean;
  /** Opens with that field focused, e.g. "summary" for the board's "Write summary" nudge. */
  focus?: "summary" | "notes";
}

/**
 * The card drawer (card-detail.md, C-1 to C-8): one place per card, ordered by
 * what you do while learning: tasks, summary, notes, reminder; the material's
 * brief and the hours collapsed at the bottom. Everything autosaves.
 *
 * Standalone: the board renders it for `?item=<id>` and owns the URL and the
 * focus return to the card; the drawer reads and writes the store itself.
 */
export function CardDetailDrawer({ itemId, onClose, readOnly, focus }: CardDetailDrawerProps) {
  const item = usePlanItems().find((candidate) => candidate.id === itemId);
  // Inside <DataGate> today comes from context; rendered elsewhere it falls back to the clock.
  const clockDay = useClockDay();
  const today = use(TodayContext) ?? clockDay;
  const open = Boolean(item && today);

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      {item && today && (
        <TodayContext value={today}>
          <CardDrawerContent item={item} today={today} forcedReadOnly={readOnly} focus={focus} onClose={onClose} />
        </TodayContext>
      )}
    </Sheet>
  );
}

function CardDrawerContent({
  item,
  today,
  forcedReadOnly,
  focus,
  onClose,
}: {
  item: PlanItem;
  today: string;
  forcedReadOnly?: boolean;
  focus?: "summary" | "notes";
  onClose: () => void;
}) {
  const material = useMaterialMap().get(item.materialId);
  const archivedYears = useArchivedYears();
  const currentMonth = monthOf(today);
  const readOnly = forcedReadOnly ?? isReadOnlyCard(item, currentMonth, archivedYears);
  const quarter = cardQuarter(item, currentMonth);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  // Moving to Done here follows up like the board: "Did you earn…?" and the summary toast.
  const followUps = useDoneFollowUps({ onWriteSummary: () => summaryRef.current?.focus() });
  const title = material?.title ?? "Removed material";
  const TypeIcon = material ? MATERIAL_TYPE_ICONS[material.type] : undefined;
  const carried = carriedOverLabel(item);

  return (
    <SheetContent
      size="card"
      onEscapeKeyDown={(event) => {
        // A rename or date field handles its own Escape.
        if (isEscapeLocal(event.target)) event.preventDefault();
      }}
      onOpenAutoFocus={
        focus
          ? (event) => {
              event.preventDefault();
              (focus === "summary" ? summaryRef : notesRef).current?.focus();
            }
          : undefined
      }
    >
      <SheetHeader className="gap-2">
        <div className="flex min-h-8 items-center gap-2 text-xs text-muted-foreground">
          {TypeIcon && <TypeIcon aria-hidden className="size-4 shrink-0" />}
          <span className="min-w-0 truncate">{[material && TYPE_LABELS[material.type], material?.author].filter(Boolean).join(" · ")}</span>
          <StatusControl item={item} currentMonth={currentMonth} readOnly={readOnly} onMoved={followUps.afterMove} />
        </div>
        <SheetTitle className="font-display text-2xl leading-tight font-semibold tracking-tight">{title}</SheetTitle>
        <SheetDescription className={readOnly ? undefined : "sr-only"}>
          {readOnly
            ? `From ${monthName(item.month, currentMonth)}. The card is read-only, but your summary, notes and review dates stay editable.`
            : "Changes save as you go."}
        </SheetDescription>
      </SheetHeader>

      <SheetBody className="gap-6">
        <div className="flex flex-col gap-3">
          {material?.url && (
            <a
              href={material.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 self-start text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Open link
              <ExternalLinkIcon aria-hidden className="size-3.5" />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
          <CardSkills item={item} readOnly={readOnly} />
          <CardKeyResult item={item} quarter={quarter} readOnly={readOnly} />
          {material?.type === "certification" && item.status === "done" && <EarnedRow item={item} material={material} readOnly={readOnly} />}
        </div>

        <CardTasks item={item} readOnly={readOnly} />
        <CardSummary item={item} material={material} materialTitle={title} textareaRef={summaryRef} />
        <CardNotes item={item} textareaRef={notesRef} />
        <CardReminder item={item} readOnly={readOnly} />

        <div className="flex flex-col gap-4">
          {material && <CardAbout material={material} />}
          <CardTime item={item} material={material} readOnly={readOnly} />
        </div>
      </SheetBody>

      {(carried || !readOnly) && (
        <SheetFooter>
          <p className="text-xs text-muted-foreground">{carried}</p>
          {!readOnly && <RemoveFromBoard item={item} currentMonth={currentMonth} onClose={onClose} />}
        </SheetFooter>
      )}
      <EarnedDialog title={followUps.asking ? title : null} onAnswer={followUps.answer} />
    </SheetContent>
  );
}

/** Mirrors the board columns; changing it moves the card like ⋯ → Move to (appends to the column). */
function StatusControl({
  item,
  currentMonth,
  readOnly,
  onMoved,
}: {
  item: PlanItem;
  currentMonth: string;
  readOnly: boolean;
  onMoved: (before: PlanItem, status: BoardStatus) => void;
}) {
  const { movePlanItem } = useActions();
  const id = useId();

  if (readOnly) {
    return <span className="ml-auto shrink-0 rounded-full bg-muted px-2.5 py-0.5 font-medium text-foreground">{STATUS_LABELS[item.status]}</span>;
  }

  return (
    <span className="ml-auto shrink-0">
      <label htmlFor={id} className="sr-only">
        Status
      </label>
      <NativeSelect
        id={id}
        className="h-7 w-auto rounded-full text-xs font-medium"
        value={item.status}
        onChange={(event) => {
          const status = event.target.value as BoardStatus;
          // Leaving Backlog schedules the card into this month (board.md §Move to).
          movePlanItem(item.id, { status, ...(item.status === "backlog" ? { month: currentMonth } : {}) });
          onMoved(item, status);
        }}
      >
        {BOARD_COLUMNS.map((status) => (
          <option key={status} value={status}>
            {STATUS_LABELS[status]}
          </option>
        ))}
      </NativeSelect>
    </span>
  );
}

/** Certifications (C-7): once Done, the earned date, or "Mark as earned" after a "Not yet". */
function EarnedRow({ item, material, readOnly }: { item: PlanItem; material: Material; readOnly: boolean }) {
  const { setItemEarned } = useActions();
  if (item.earnedAt) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <AwardIcon aria-hidden className="size-4 text-brand" />
        Earned {formatShortDate(item.earnedAt)}
      </p>
    );
  }
  if (readOnly) return null;
  return (
    <Button variant="outline" size="sm" className="self-start" onClick={() => setItemEarned(item.id, true)}>
      <AwardIcon aria-hidden />
      Mark as earned
      <span className="sr-only"> {material.title}</span>
    </Button>
  );
}

/** Remove from board: same undo toast as the board; the card's notes stay in the Notebook. */
function RemoveFromBoard({ item, currentMonth, onClose }: { item: PlanItem; currentMonth: string; onClose: () => void }) {
  const { removePlanItem, restorePlanItem } = useActions();
  return (
    <Button
      variant="link"
      size="xs"
      className="ml-auto px-0 text-destructive"
      onClick={() => {
        const message = removedMessage(item, currentMonth);
        onClose();
        const removed = removePlanItem(item.id);
        if (removed) toast({ message, action: { label: "Undo", onClick: () => restorePlanItem(removed) } });
      }}
    >
      Remove from board
    </Button>
  );
}
