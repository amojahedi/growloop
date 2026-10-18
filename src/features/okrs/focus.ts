/** Focuses an element by id once React has rendered the change that creates or moves it. */
export function focusSoon(id: string): void {
  requestAnimationFrame(() => {
    const element = document.getElementById(id);
    if (element) element.focus();
  });
}
