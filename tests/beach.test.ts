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

const beachFixture = [
  {
    elaborado: "2026-05-17T08:00:00",
    nombre: "PLAYA DE LA CONCHA",
    localidad: "Donostia/San Sebastian",
    municipio: { id: "20069", nombre: "Donostia/San Sebastian" },
    subZona: { id: "00", nombre: "ATL_E_CANT" },
    id: "20069001",
    origen: {
      productor: "AEMET",
      web: "https://www.aemet.es",
      enlace: "https://...",
      language: "es",
      copyright: "AEMET",
      notaLegal: "...",
    },
    prediccion: {
      dia: [
        {
          fecha: "2026-05-17",
          estadoCielo: { value: "11", descripcion: "Despejado" },
          viento: { value: "Flojo del NE" },
          oleaje: { value: "Marejadilla" },
          tMaxima: { valor1: 22, valor2: 24 },
          tAgua: { valor1: 17, valor2: 17 },
          uvMax: 7,
        },
      ],
    },
  },
];

describe("BeachResource", () => {
  it("fetches a beach forecast", async () => {
    const { fetch, calls } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: beachFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.beach.forecast("20069001");
    expect(result).toEqual(beachFixture);
    expect(calls[0]).toContain("/prediccion/especifica/playa/20069001");
  });

  it("accepts variable-length numeric beach codes", async () => {
    const { fetch } = fixtureFetch([
      { status: 200, body: { descripcion: "exito", estado: 200, datos: "https://x/d" } },
      { status: 200, body: beachFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    await expect(c.beach.forecast("12345")).resolves.toBeDefined();
  });

  it("rejects invalid beach codes", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.beach.forecast("abc")).rejects.toBeInstanceOf(AemetError);
    await expect(c.beach.forecast("12")).rejects.toBeInstanceOf(AemetError);
    await expect(c.beach.forecast("123456789012345")).rejects.toBeInstanceOf(AemetError);
  });
});
