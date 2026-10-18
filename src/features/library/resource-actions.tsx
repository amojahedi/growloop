"use client";

import { BookmarkCheckIcon, BookmarkIcon, CheckIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatMonth } from "@/lib/domain/dates";
import type { ID, Material } from "@/lib/domain/types";
import { useActions, useLibraryIds, useMonthNavigation, usePlanItems } from "@/lib/store/hooks";
import { KeyResultLink } from "./key-result-link";

/**
 * The two actions on every resource (RS-4, ML-3):
 *  - **Add** (primary) puts it in To Do on the current month's board and saves it to the library.
 *  - **Save to library** (secondary) keeps it for later.
 * After Add, an optional key-result link and Undo are offered in place.
 * Once it is on the board, "On board" opens its card there (`/board?item=<id>`).
 */
export function ResourceActions({ material }: { material: Material }) {
  const { currentMonth } = useMonthNavigation();
  const { addPlanItem, removePlanItem, saveMaterial, unsaveMaterial } = useActions();
  const libraryIds = useLibraryIds();
  const planned = usePlanItems().find((item) => item.materialId === material.id && item.month === currentMonth);
  // The item this component just added (enables Undo), and whether Add also saved it.
  const [added, setAdded] = useState<{ itemId: ID; savedByAdd: boolean }>();

  const inLibrary = libraryIds.has(material.id);
  const month = formatMonth(currentMonth);
  const justAdded = planned && added?.itemId === planned.id;

  const add = () => {
    const itemId = addPlanItem(material.id, currentMonth);
    if (!itemId) return;
    const savedByAdd = material.curated && !inLibrary;
    if (savedByAdd) saveMaterial(material.id);
    setAdded({ itemId, savedByAdd });
  };

  const undo = () => {
    if (!added) return;
    removePlanItem(added.itemId);
    if (added.savedByAdd) unsaveMaterial(material.id);
    setAdded(undefined);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {planned ? (
          <Button asChild variant="outline" size="sm">
            <Link
              href={`/board?item=${encodeURIComponent(planned.id)}`}
              aria-label={`"${material.title}" is on your ${month} board. Open the card`}
            >
              <CheckIcon aria-hidden />
              On board
            </Link>
          </Button>
        ) : (
          <Button size="sm" onClick={add} aria-label={`Add "${material.title}" to ${month}`}>
            <PlusIcon aria-hidden />
            Add
          </Button>
        )}

        {material.curated && (
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={inLibrary}
            aria-label={`${inLibrary ? "Saved" : "Save"} "${material.title}" to library`}
            onClick={() => (inLibrary ? unsaveMaterial(material.id) : saveMaterial(material.id))}
          >
            {inLibrary ? <BookmarkCheckIcon aria-hidden /> : <BookmarkIcon aria-hidden />}
            {inLibrary ? "Saved" : "Save to library"}
          </Button>
        )}
      </div>

      {justAdded && (
        <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground" role="status">
          <span>Added to {month}</span>
          <KeyResultLink item={planned} materialTitle={material.title} />
          <Button variant="link" size="xs" onClick={undo} aria-label={`Undo adding "${material.title}"`}>
            Undo
          </Button>
        </div>
      )}
    </div>
  );
}
