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

const dailyFixture = [
  {
    origen: {
      productor: "AEMET",
      web: "https://www.aemet.es",
      enlace: "https://...",
      language: "es",
      copyright: "AEMET",
      notaLegal: "...",
    },
    elaborado: "2026-05-17T08:00:00",
    nombre: "Madrid",
    provincia: "Madrid",
    prediccion: {
      dia: [
        {
          fecha: "2026-05-17",
          probPrecipitacion: [{ value: "10", periodo: "00-24" }],
          cotaNieveProv: [{ value: "", periodo: "00-24" }],
          estadoCielo: [{ value: "11", descripcion: "Despejado", periodo: "00-24" }],
          viento: [{ direccion: "NE", velocidad: "10", periodo: "00-24" }],
          rachaMax: [{ value: "25", periodo: "00-24" }],
          temperatura: { maxima: 28, minima: 12, dato: [] },
          sensTermica: { maxima: 27, minima: 11, dato: [] },
          humedadRelativa: { maxima: 80, minima: 30, dato: [] },
          uvMax: 7,
        },
      ],
    },
    id: "28079",
    version: "1.0",
  },
];

describe("PredictionResource", () => {
  it("fetches municipal daily forecast", async () => {
    const { fetch, calls } = fixtureFetch([
      {
        status: 200,
        body: {
          descripcion: "exito",
          estado: 200,
          datos: "https://opendata.aemet.es/opendata/sh/abc",
        },
      },
      { status: 200, body: dailyFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.prediction.municipalDaily("28079");
    expect(result).toEqual(dailyFixture);
    expect(calls[0]).toContain("/prediccion/especifica/municipio/diaria/28079");
  });

  it("validates municipio format", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.prediction.municipalDaily("not-a-code")).rejects.toBeInstanceOf(AemetError);
    await expect(c.prediction.municipalDaily("123")).rejects.toBeInstanceOf(AemetError);
    await expect(c.prediction.municipalHourly("ABCDE")).rejects.toBeInstanceOf(AemetError);
  });

  it("fetches municipal hourly forecast", async () => {
    const { fetch } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: [{ id: "28079", prediccion: { dia: [] } }] },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.prediction.municipalHourly("28079");
    expect(result[0]?.id).toBe("28079");
  });
});
