import { describe, expect, it } from "vitest";
import { AemetClient } from "../src/client.js";
import { AemetError } from "../src/errors.js";
import type { FetchLike } from "../src/transport.js";

function fixtureFetch(responses: Array<{ status: number; body: unknown }>): {
  fetch: FetchLike;
  calls: string[];
} {
  const calls: string[] = [];
  let i = 0;
  const fetch: FetchLike = async (url) => {
    calls.push(String(url));
    const r = responses[i++];
    if (!r) throw new Error(`unexpected call to ${String(url)}`);
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  };
  return { fetch, calls };
}

const maritimeFixture = [
  {
    origen: {
      productor: "AEMET",
      web: "https://www.aemet.es",
      enlace: "https://...",
      language: "es",
      copyright: "AEMET",
      notaLegal: "...",
    },
    nombre: "Cantábrico",
    id: "2",
    tipo: "altamar",
    iniciovalidez: "2026-05-17T00:00:00Z",
    finvalidez: "2026-05-18T00:00:00Z",
    situacion: "Borrasca al noroeste con vientos del oeste.",
  },
];

describe("MaritimeResource", () => {
  it("fetches high seas forecast", async () => {
    const { fetch, calls } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: maritimeFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.maritime.highSeas("2");
    expect(result).toEqual(maritimeFixture);
    expect(calls[0]).toContain("/prediccion/maritima/altamar/area/2");
  });

  it("fetches coastal forecast", async () => {
    const { fetch, calls } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: maritimeFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.maritime.coastal("31");
    expect(result).toEqual(maritimeFixture);
    expect(calls[0]).toContain("/prediccion/maritima/costera/costa/31");
  });

  it("rejects malformed area codes", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.maritime.highSeas("abc")).rejects.toBeInstanceOf(AemetError);
    await expect(c.maritime.coastal("123")).rejects.toBeInstanceOf(AemetError);
    await expect(c.maritime.highSeas("")).rejects.toBeInstanceOf(AemetError);
  });
});
