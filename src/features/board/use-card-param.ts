"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "@/components/ui/toast";
import type { ID } from "@/lib/domain/types";
import { useAppStore } from "@/lib/store/app-store";
import { useMonthNavigation } from "@/lib/store/hooks";
import { monthToOpen } from "./board-model";

export const ITEM_PARAM = "item";
/**
 * Asks the card drawer to focus a field when it opens ("Write summary" →
 * `focus=summary`). Proposed contract for WP4's drawer; ignored until it reads it.
 */
export const FOCUS_PARAM = "focus";
export type CardFocus = "summary";

export const UNKNOWN_CARD_MESSAGE = "That card no longer exists.";

/**
 * The open card lives in the URL as `?item=<id>` (board.md §Opening a card
 * from elsewhere), so Back closes the drawer and links can open any card.
 * Updates go through the native History API, which Next's router picks up.
 *
 * On arrival the board switches to the item's month (Backlog items, and any
 * item after this month, open on the current month); an unknown id toasts
 * once and is dropped from the URL.
 */
export function useCardParam() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const itemId = searchParams.get(ITEM_PARAM) || null;
  const exists = useAppStore((state) => (itemId ? state.data.planItems.some((item) => item.id === itemId) : false));
  const { currentMonth, setMonth } = useMonthNavigation();
  // True while the open card is a history entry this page pushed, so closing can step back instead.
  const pushed = useRef(false);
  // The id that was found on arrival: if it disappears later (removed from the drawer), close quietly.
  const found = useRef<ID | null>(null);

  const urlWithout = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    params.delete(ITEM_PARAM);
    params.delete(FOCUS_PARAM);
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname]);

  const openCard = useCallback(
    (id: ID, options: { focus?: CardFocus } = {}) => {
      const params = new URLSearchParams(window.location.search);
      params.set(ITEM_PARAM, id);
      if (options.focus) params.set(FOCUS_PARAM, options.focus);
      else params.delete(FOCUS_PARAM);
      found.current = id;
      window.history.pushState(null, "", `${pathname}?${params.toString()}`);
      pushed.current = true;
    },
    [pathname],
  );

  const closeCard = useCallback(() => {
    if (pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", urlWithout());
    }
  }, [urlWithout]);

  // Arrival: show the item's month, or report an unknown id.
  useEffect(() => {
    if (!itemId) {
      pushed.current = false;
      return;
    }
    const item = useAppStore.getState().data.planItems.find((candidate) => candidate.id === itemId);
    if (!item) return;
    found.current = itemId;
    setMonth(monthToOpen(item, currentMonth));
    // Only when the id changes: moving the open card mustn't move the board.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  useEffect(() => {
    if (!itemId || exists) return;
    const removedWhileOpen = found.current === itemId;
    found.current = null;
    if (!removedWhileOpen) toast({ message: UNKNOWN_CARD_MESSAGE });
    if (removedWhileOpen && pushed.current) {
      pushed.current = false;
      window.history.back();
    } else {
      window.history.replaceState(null, "", urlWithout());
    }
  }, [itemId, exists, urlWithout]);

  return { itemId: exists ? itemId : null, openCard, closeCard };
}
