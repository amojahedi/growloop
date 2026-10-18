/** Focuses an element by id once React has rendered the change that creates or moves it. */
export function focusSoon(id: string): void {
  const schedule = typeof requestAnimationFrame === "function" ? requestAnimationFrame : (callback: () => void) => setTimeout(callback, 0);
  schedule(() => document.getElementById(id)?.focus());
}
