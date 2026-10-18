/**
 * Focuses the first of these elements that exists once React has rendered the
 * change that creates, moves or removes things (list fallbacks last). Each
 * target is an element id, or a CSS selector when it starts with "[".
 */
export function focusSoon(...targets: string[]): void {
  const schedule = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (callback: () => void) => setTimeout(callback, 0);
  schedule(() => {
    for (const target of targets) {
      const element = target.startsWith("[") ? document.querySelector<HTMLElement>(target) : document.getElementById(target);
      if (element) {
        element.focus();
        return;
      }
    }
  });
}
