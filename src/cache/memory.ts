import type { CacheAdapter } from "./types.js";

interface Entry {
  value: unknown;
  expiresAt: number;
}

export class MemoryCacheAdapter implements CacheAdapter {
  readonly #store = new Map<string, Entry>();
  readonly #maxEntries: number;

  constructor(options: { maxEntries?: number } = {}) {
    this.#maxEntries = options.maxEntries ?? 1000;
  }

  get(key: string): unknown | undefined {
    const entry = this.#store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.#store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: unknown, ttlSeconds = 300): void {
    if (this.#store.size >= this.#maxEntries) {
      const oldest = this.#store.keys().next().value;
      if (oldest !== undefined) this.#store.delete(oldest);
    }
    this.#store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  delete(key: string): void {
    this.#store.delete(key);
  }

  clear(): void {
    this.#store.clear();
  }

  get size(): number {
    return this.#store.size;
  }
}
