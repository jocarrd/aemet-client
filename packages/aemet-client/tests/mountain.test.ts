import { describe, expect, it } from "vitest";
import { AemetClient } from "../src/client.js";
import { MOUNTAIN_AREAS } from "../src/index.js";
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

const origen = {
  productor: "Agencia Estatal de Meteorología - AEMET - Gobierno de España",
  web: "http://www.aemet.es",
  tipo: "Predicción de montaña",
  language: "es",
  copyright: "© AEMET",
  notaLegal: "http://www.aemet.es/es/nota_legal",
};

const forecastFixture = [
  {
    origen,
    seccion: [
      {
        nombre: "prediccion",
        apartado: [
          { cabecera: "Estado del cielo", texto: "Poco nuboso o despejado.", nombre: "nubosidad" },
          { cabecera: "Precipitaciones", texto: "No se esperan.", nombre: "pcp" },
        ],
        lugar: [],
        parrafo: [],
      },
    ],
    id: "peu1",
    nombre: "Predicción",
  },
];

const pastFixture = [
  {
    origen,
    seccion: [
      {
        nombre: "tiempo_pasado",
        apartado: [],
        lugar: [],
        parrafo: [{ texto: "Intervalos nubosos con nubosidad alta.", numero: "3" }],
      },
    ],
    id: "nav1",
    nombre: "Tiempo pasado",
  },
];

describe("MountainResource", () => {
  it("fetches the forecast for an area and day", async () => {
    const { fetch, calls } = fixtureFetch([
      { status: 200, body: { descripcion: "exito", estado: 200, datos: "https://x/d" } },
      { status: 200, body: forecastFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.mountain.forecast("peu1", 0);
    expect(result).toEqual(forecastFixture);
    expect(calls[0]).toBe(
      "https://opendata.aemet.es/opendata/api/prediccion/especifica/montaña/pasada/area/peu1/dia/0",
    );
  });

  it("fetches the past-weather bulletin without a day segment", async () => {
    const { fetch, calls } = fixtureFetch([
      { status: 200, body: { descripcion: "exito", estado: 200, datos: "https://x/d" } },
      { status: 200, body: pastFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.mountain.past("nav1");
    expect(result).toEqual(pastFixture);
    expect(calls[0]).toBe(
      "https://opendata.aemet.es/opendata/api/prediccion/especifica/montaña/pasada/area/nav1",
    );
  });

  it("builds the endpoint for every documented area code", async () => {
    for (const area of Object.values(MOUNTAIN_AREAS)) {
      const { fetch, calls } = fixtureFetch([
        { status: 200, body: { descripcion: "exito", estado: 200, datos: "https://x/d" } },
        { status: 200, body: forecastFixture },
      ]);
      const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
      await c.mountain.forecast(area, 3);
      expect(calls[0]).toBe(
        `https://opendata.aemet.es/opendata/api/prediccion/especifica/montaña/pasada/area/${area}/dia/3`,
      );
    }
  });

  it("rejects invalid areas and days", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.mountain.forecast("5", 0)).rejects.toBeInstanceOf(AemetError);
    await expect(c.mountain.forecast("zzz9", 0)).rejects.toBeInstanceOf(AemetError);
    await expect(c.mountain.forecast("peu1", 4 as 3)).rejects.toBeInstanceOf(AemetError);
    await expect(c.mountain.past("a")).rejects.toBeInstanceOf(AemetError);
  });
});
