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

const mountainFixture = [
  {
    nombre: "Sistema Central - Sierra de Madrid",
    id: "5",
    elaborado: "2026-05-17T08:00:00",
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
          estadoCielo: [{ value: "12", descripcion: "Poco nuboso", periodo: "00-24" }],
          precipitacion: [{ value: "0", periodo: "00-24" }],
          cotaNieve: [{ value: "2400", periodo: "00-24" }],
          temperatura: [
            { altitud: "1000", value: "14" },
            { altitud: "1500", value: "9" },
            { altitud: "2000", value: "4" },
            { altitud: "2500", value: "-1" },
            { altitud: "3000", value: "-6" },
          ],
        },
      ],
    },
  },
];

describe("MountainResource", () => {
  it("fetches the current forecast for an area", async () => {
    const { fetch, calls } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: mountainFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.mountain.forecast("5", 0);
    expect(result).toEqual(mountainFixture);
    expect(decodeURI(calls[0] ?? "")).toContain("/prediccion/especifica/montaña/5/periodo/0");
  });

  it("fetches the past forecast", async () => {
    const { fetch, calls } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: mountainFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.mountain.past("5", 1);
    expect(result).toEqual(mountainFixture);
    expect(decodeURI(calls[0] ?? "")).toContain(
      "/prediccion/especifica/montaña/pasada/area/5/dia/1",
    );
  });

  it("rejects invalid areas and periods", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.mountain.forecast("0", 0)).rejects.toBeInstanceOf(AemetError);
    await expect(c.mountain.forecast("9", 0)).rejects.toBeInstanceOf(AemetError);
    await expect(c.mountain.forecast("5", 2 as 1)).rejects.toBeInstanceOf(AemetError);
    await expect(c.mountain.past("a" as string, 0)).rejects.toBeInstanceOf(AemetError);
  });
});
