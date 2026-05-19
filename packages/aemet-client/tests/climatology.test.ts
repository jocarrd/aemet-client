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
    fecha: "2026-05-15",
    indicativo: "3195",
    nombre: "MADRID, RETIRO",
    provincia: "MADRID",
    altitud: "667",
    tmed: "18,5",
    prec: "0,0",
    tmin: "12,1",
    horatmin: "06:30",
    tmax: "25,3",
    horatmax: "16:50",
  },
];

const monthlyFixture = [
  {
    fecha: "2025-1",
    indicativo: "3195",
    tm_mes: "6,4",
    p_mes: "31,2",
  },
];

const normalsFixture = [
  {
    indicativo: "3195",
    mes: "1",
    t_med: "6,4",
    p_med: "33",
  },
];

const inventoryFixture = [
  {
    latitud: "402411N",
    provincia: "MADRID",
    altitud: "667",
    indicativo: "3195",
    nombre: "MADRID, RETIRO",
    indsinop: "08220",
    longitud: "034041W",
  },
];

describe("ClimatologyResource", () => {
  it("fetches daily values for a date range", async () => {
    const { fetch, calls } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: dailyFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.climatology.daily("3195", "2026-05-15", "2026-05-16");
    expect(result).toEqual(dailyFixture);
    expect(calls[0]).toContain(
      "/valores/climatologicos/diarios/datos/fechaini/2026-05-15T00:00:00UTC/fechafin/2026-05-16T00:00:00UTC/estacion/3195",
    );
  });

  it("accepts Date objects for daily range", async () => {
    const { fetch, calls } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: dailyFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const from = new Date(Date.UTC(2026, 4, 15));
    const to = new Date(Date.UTC(2026, 4, 16));
    await c.climatology.daily("3195", from, to);
    expect(calls[0]).toContain("fechaini/2026-05-15T00:00:00UTC/fechafin/2026-05-16T00:00:00UTC");
  });

  it("rejects an inverted date range", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.climatology.daily("3195", "2026-05-16", "2026-05-15")).rejects.toBeInstanceOf(
      AemetError,
    );
  });

  it("rejects a daily range over 5 years", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.climatology.daily("3195", "2018-01-01", "2026-01-01")).rejects.toBeInstanceOf(
      AemetError,
    );
  });

  it("fetches monthly values", async () => {
    const { fetch, calls } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: monthlyFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.climatology.monthly("3195", 2024, 2025);
    expect(result).toEqual(monthlyFixture);
    expect(calls[0]).toContain(
      "/valores/climatologicos/mensualesanuales/datos/anioini/2024/aniofin/2025/estacion/3195",
    );
  });

  it("rejects invalid years", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.climatology.monthly("3195", 99, 2025)).rejects.toBeInstanceOf(AemetError);
    await expect(c.climatology.monthly("3195", 2024, "abcd")).rejects.toBeInstanceOf(AemetError);
    await expect(c.climatology.monthly("3195", 2025, 2024)).rejects.toBeInstanceOf(AemetError);
  });

  it("fetches climatological normals", async () => {
    const { fetch, calls } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: normalsFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.climatology.normals("3195");
    expect(result).toEqual(normalsFixture);
    expect(calls[0]).toContain("/valores/climatologicos/normales/estacion/3195");
  });

  it("fetches the station inventory", async () => {
    const { fetch, calls } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: inventoryFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.climatology.stationInventory();
    expect(result).toEqual(inventoryFixture);
    expect(calls[0]).toContain("/valores/climatologicos/inventarioestaciones/todasestaciones");
  });

  it("validates idema across all climatology methods", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.climatology.daily("!!", "2026-05-15", "2026-05-16")).rejects.toBeInstanceOf(
      AemetError,
    );
    await expect(c.climatology.monthly("X", 2024, 2025)).rejects.toBeInstanceOf(AemetError);
    await expect(c.climatology.normals("TOOLONG999")).rejects.toBeInstanceOf(AemetError);
  });
});
