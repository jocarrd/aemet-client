import { describe, expect, it } from "vitest";
import { AemetClient } from "../src/client.js";
import { AemetError } from "../src/errors.js";
import type { FetchLike } from "../src/transport.js";

function fixtureFetch(responses: Array<{ status: number; body: unknown }>) {
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

const fixture = [
  {
    estacion: "ES1778A",
    red: "esp",
    fecha: "2026-05-17T08:00:00Z",
    contaminante: "NO2",
    concentracion: 12.4,
    unidad: "ug/m3",
    validez: "1",
  },
];

describe("AirQualityResource", () => {
  it("fetches background pollution measurements", async () => {
    const { fetch, calls } = fixtureFetch([
      { status: 200, body: { descripcion: "exito", estado: 200, datos: "https://x/d" } },
      { status: 200, body: fixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const data = await c.airQuality.backgroundPollution("ES1778A", "esp");
    expect(data).toEqual(fixture);
    expect(calls[0]).toContain("/red/especial/contaminacionfondo/estacion/ES1778A/red/esp");
  });

  it("validates station and network codes", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.airQuality.backgroundPollution("!!", "esp")).rejects.toBeInstanceOf(AemetError);
    await expect(c.airQuality.backgroundPollution("ES1778A", "!")).rejects.toBeInstanceOf(AemetError);
  });
});
