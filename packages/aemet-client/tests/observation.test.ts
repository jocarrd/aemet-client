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

const stationFixture = [
  {
    idema: "1387",
    lon: -3.61,
    lat: 40.45,
    alt: 678,
    ubi: "TORREJON DE ARDOZ",
    fint: "2026-05-17T08:00:00",
    ta: 18.2,
    hr: 65,
    pres: 1015.2,
    prec: 0,
    vv: 3.5,
    dv: 280,
  },
];

describe("ObservationResource", () => {
  it("fetches all stations", async () => {
    const { fetch, calls } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: stationFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const all = await c.observation.allStations();
    expect(all).toEqual(stationFixture);
    expect(calls[0]).toContain("/observacion/convencional/todas");
  });

  it("fetches a single station 24h history", async () => {
    const { fetch, calls } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: stationFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const data = await c.observation.station("1387");
    expect(data[0]?.idema).toBe("1387");
    expect(calls[0]).toContain("/observacion/convencional/datos/estacion/1387");
  });

  it("validates idema format", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.observation.station("!!")).rejects.toBeInstanceOf(AemetError);
    await expect(c.observation.station("AB")).rejects.toBeInstanceOf(AemetError);
    await expect(c.observation.station("TOOLONGIDEMA")).rejects.toBeInstanceOf(AemetError);
  });
});
