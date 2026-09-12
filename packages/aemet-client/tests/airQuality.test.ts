import { describe, expect, it } from "vitest";
import { AemetClient } from "../src/client.js";
import { AemetError } from "../src/errors.js";
import type { FetchLike } from "../src/transport.js";

const FINN_LINE =
  "12-09-2026 00:10 SO2(001): +00001.72 ug/m3 CV: V FC: 2.66 O3(014): +00054.78 ug/m3 CV: V FC: 1.99 TEM(083): +00010.60 GC CV: V FC: 1";

function fixtureFetch(bodies: string[]) {
  const calls: string[] = [];
  let i = 0;
  const fetch: FetchLike = async (url) => {
    calls.push(String(url));
    const body = bodies[i++];
    if (body === undefined) throw new Error(`unexpected call to ${String(url)}`);
    const isEnvelope = body.startsWith("{");
    return new Response(body, {
      status: 200,
      headers: {
        "content-type": isEnvelope ? "application/json" : "text/plain;charset=ISO-8859-15",
      },
    });
  };
  return { fetch, calls };
}

const envelope = JSON.stringify({ descripcion: "exito", estado: 200, datos: "https://x/d" });

describe("AirQualityResource", () => {
  it("parses the FINN text payload into measurements", async () => {
    const { fetch, calls } = fixtureFetch([envelope, `${FINN_LINE}\n`]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const data = await c.airQuality.backgroundPollution("09");
    expect(calls[0]).toBe(
      "https://opendata.aemet.es/opendata/api/red/especial/contaminacionfondo/estacion/09",
    );
    expect(data).toEqual([
      {
        station: "09",
        timestamp: "2026-09-12T00:10:00",
        readings: [
          {
            parameter: "SO2",
            code: "001",
            value: 1.72,
            unit: "ug/m3",
            validity: "V",
            factor: 2.66,
          },
          {
            parameter: "O3",
            code: "014",
            value: 54.78,
            unit: "ug/m3",
            validity: "V",
            factor: 1.99,
          },
          { parameter: "TEM", code: "083", value: 10.6, unit: "GC", validity: "V", factor: 1 },
        ],
      },
    ]);
  });

  it("skips lines that are not FINN records", async () => {
    const { fetch } = fixtureFetch([envelope, `\n${FINN_LINE}\nnot a record\n`]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const data = await c.airQuality.backgroundPollution("09");
    expect(data).toHaveLength(1);
  });

  it("exposes the raw payload", async () => {
    const { fetch } = fixtureFetch([envelope, FINN_LINE]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    expect(await c.airQuality.backgroundPollutionRaw("09")).toBe(FINN_LINE);
  });

  it("validates station codes against the EMEP list", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.airQuality.backgroundPollution("!!")).rejects.toBeInstanceOf(AemetError);
    await expect(c.airQuality.backgroundPollution("ES1778A")).rejects.toBeInstanceOf(AemetError);
    await expect(c.airQuality.backgroundPollution("99")).rejects.toBeInstanceOf(AemetError);
  });
});
