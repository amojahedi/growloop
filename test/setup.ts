import "@testing-library/jest-dom/vitest";

/**
 * Node 25+ defines its own `localStorage` global, which is non-functional
 * without `--localstorage-file` and shadows jsdom's implementation. Swap in a
 * spec-compatible in-memory Storage when that happens.
 */
class MemoryStorage implements Storage {
  #items = new Map<string, string>();

  get length() {
    return this.#items.size;
  }
  clear() {
    this.#items.clear();
  }
  getItem(key: string) {
    return this.#items.get(key) ?? null;
  }
  key(index: number) {
    return [...this.#items.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.#items.delete(key);
  }
  setItem(key: string, value: string) {
    this.#items.set(key, String(value));
  }
}

if (typeof document !== "undefined" && typeof globalThis.localStorage?.clear !== "function") {
  Object.defineProperty(globalThis, "localStorage", { value: new MemoryStorage(), configurable: true });
}
