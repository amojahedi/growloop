/**
 * Marks a control whose Escape key is handled locally (cancel a rename, close a
 * date field). Drawers check it before closing on Escape, because Radix listens
 * for Escape on the document in the capture phase, before the control sees it.
 */
export const ESCAPE_LOCAL = { "data-escape-local": "" } as const;

export function isEscapeLocal(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("[data-escape-local]") !== null;
}
