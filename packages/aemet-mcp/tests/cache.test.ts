import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, DEFAULT_CACHE_TTL_SECONDS } from "../src/server.js";

const ENVELOPE = {
  descripcion: "exito",
  estado: 200,
  datos: "https://opendata.aemet.es/opendata/sh/deadbeef",
  metadatos: "https://opendata.aemet.es/opendata/sh/metadata",
};

function countingFetch(): { fetch: typeof globalThis.fetch; calls: string[] } {
  const calls: string[] = [];
  const fetch = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push(url);
    const body = url.includes("/sh/") ? JSON.stringify([{ indicativo: "3195" }]) : JSON.stringify(ENVELOPE);
    return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

describe("client cache", () => {
  const previous = process.env.AEMET_CACHE_TTL;

  beforeEach(() => {
    delete process.env.AEMET_CACHE_TTL;
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.AEMET_CACHE_TTL;
    else process.env.AEMET_CACHE_TTL = previous;
  });

  it("serves a repeated request from memory instead of calling AEMET twice", async () => {
    const { fetch, calls } = countingFetch();
    const { client } = createServer({ apiKey: "test-key", clientConfig: { fetch } });

    await client.prediction.municipalDaily("28079");
    await client.prediction.municipalDaily("28079");

    expect(calls.filter((url) => url.includes("/prediccion/"))).toHaveLength(1);
  });

  it("still calls AEMET for a different endpoint", async () => {
    const { fetch, calls } = countingFetch();
    const { client } = createServer({ apiKey: "test-key", clientConfig: { fetch } });

    await client.prediction.municipalDaily("28079");
    await client.prediction.municipalDaily("26089");

    expect(calls.filter((url) => url.includes("/prediccion/"))).toHaveLength(2);
  });

  it("AEMET_CACHE_TTL=0 turns the cache off", async () => {
    process.env.AEMET_CACHE_TTL = "0";
    const { fetch, calls } = countingFetch();
    const { client } = createServer({ apiKey: "test-key", clientConfig: { fetch } });

    await client.prediction.municipalDaily("28079");
    await client.prediction.municipalDaily("28079");

    expect(calls.filter((url) => url.includes("/prediccion/"))).toHaveLength(2);
  });

  it("an explicit cache config wins over the default", async () => {
    const store = new Map<string, unknown>();
    const adapter = {
      get: (key: string) => store.get(key),
      set: (key: string, value: unknown) => void store.set(key, value),
    };
    const { fetch } = countingFetch();
    const { client } = createServer({
      apiKey: "test-key",
      clientConfig: { fetch, cache: { adapter, keyPrefix: "custom" } },
    });

    await client.prediction.municipalDaily("28079");

    expect([...store.keys()].every((key) => key.startsWith("custom:"))).toBe(true);
  });

  it("defaults to ten minutes", () => {
    expect(DEFAULT_CACHE_TTL_SECONDS).toBe(600);
  });
});
