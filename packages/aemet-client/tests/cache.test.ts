import { describe, expect, it, vi } from "vitest";
import { MemoryCacheAdapter } from "../src/cache/memory.js";
import { AemetClient } from "../src/client.js";
import type { FetchLike } from "../src/transport.js";

function envelopeAndData(): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  const fetch: FetchLike = async (url) => {
    calls.push(String(url));
    if (calls.length % 2 === 1) {
      return new Response(
        JSON.stringify({ descripcion: "exito", estado: 200, datos: "https://x/d" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify([{ id: "28079" }]), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetch, calls };
}

describe("MemoryCacheAdapter", () => {
  it("stores and retrieves entries", () => {
    const cache = new MemoryCacheAdapter();
    cache.set("a", { hello: "world" }, 60);
    expect(cache.get("a")).toEqual({ hello: "world" });
  });

  it("expires entries after the TTL", () => {
    vi.useFakeTimers();
    const cache = new MemoryCacheAdapter();
    cache.set("a", "value", 1);
    expect(cache.get("a")).toBe("value");
    vi.advanceTimersByTime(2000);
    expect(cache.get("a")).toBeUndefined();
    vi.useRealTimers();
  });

  it("supports manual deletion and clearing", () => {
    const cache = new MemoryCacheAdapter();
    cache.set("a", 1, 60);
    cache.set("b", 2, 60);
    cache.delete("a");
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    cache.clear();
    expect(cache.get("b")).toBeUndefined();
  });

  it("evicts the oldest entry when maxEntries is reached", () => {
    const cache = new MemoryCacheAdapter({ maxEntries: 2 });
    cache.set("a", 1, 60);
    cache.set("b", 2, 60);
    cache.set("c", 3, 60);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });
});

describe("Cache integration with Transport", () => {
  it("hits the cache on the second identical request", async () => {
    const { fetch, calls } = envelopeAndData();
    const cache = new MemoryCacheAdapter();
    const c = new AemetClient({
      apiKey: "k",
      fetch,
      retryBaseDelayMs: 1,
      cache: { adapter: cache, ttl: 60 },
    });
    const a = await c.prediction.municipalDaily("28079");
    const b = await c.prediction.municipalDaily("28079");
    expect(a).toEqual(b);
    expect(calls).toHaveLength(2);
  });

  it("skips cache when skipCache is true", async () => {
    const { fetch, calls } = envelopeAndData();
    const cache = new MemoryCacheAdapter();
    const c = new AemetClient({
      apiKey: "k",
      fetch,
      retryBaseDelayMs: 1,
      cache: { adapter: cache, ttl: 60 },
    });
    await c.prediction.municipalDaily("28079");
    await c.prediction.municipalDaily("28079", { skipCache: true });
    expect(calls).toHaveLength(4);
  });

  it("respects per-call cacheTtl override", async () => {
    vi.useFakeTimers();
    const { fetch, calls } = envelopeAndData();
    const cache = new MemoryCacheAdapter();
    const c = new AemetClient({
      apiKey: "k",
      fetch,
      retryBaseDelayMs: 1,
      cache: { adapter: cache, ttl: 60 },
    });
    await c.prediction.municipalDaily("28079", { cacheTtl: 1 });
    vi.advanceTimersByTime(2000);
    await c.prediction.municipalDaily("28079");
    expect(calls.length).toBeGreaterThanOrEqual(3);
    vi.useRealTimers();
  });

  it("does not cache when no adapter is configured", async () => {
    const { fetch, calls } = envelopeAndData();
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    await c.prediction.municipalDaily("28079");
    await c.prediction.municipalDaily("28079");
    expect(calls).toHaveLength(4);
  });

  it("uses keyPrefix to namespace entries", async () => {
    const calls: string[] = [];
    const adapter = new MemoryCacheAdapter();
    const setSpy = vi.spyOn(adapter, "set");
    const fetch: FetchLike = async (url) => {
      calls.push(String(url));
      if (calls.length % 2 === 1) {
        return new Response(
          JSON.stringify({ descripcion: "exito", estado: 200, datos: "https://x/d" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    };
    const c = new AemetClient({
      apiKey: "k",
      fetch,
      retryBaseDelayMs: 1,
      cache: { adapter, ttl: 60, keyPrefix: "myapp" },
    });
    await c.prediction.municipalDaily("28079");
    expect(setSpy).toHaveBeenCalled();
    const key = setSpy.mock.calls[0]?.[0];
    expect(key).toMatch(/^myapp:/);
  });
});
