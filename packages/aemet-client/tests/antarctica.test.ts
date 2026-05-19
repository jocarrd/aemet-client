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
    identificacion: "JCI",
    nombre: "Juan Carlos I",
    fhora: "2026-01-15T12:00:00+0000",
    temp: -2.3,
    pres: 985,
    vel_viento: 8.5,
    dir_viento: 180,
    hum_rel: 75,
  },
];

describe("AntarcticaResource", () => {
  it("fetches observations for a station and date range", async () => {
    const { fetch, calls } = fixtureFetch([
      { status: 200, body: { descripcion: "exito", estado: 200, datos: "https://x/d" } },
      { status: 200, body: fixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const data = await c.antarctica.observations("89064", "2026-01-15", "2026-01-16");
    expect(data).toEqual(fixture);
    expect(calls[0]).toContain("/antartida/datos/fechaini/2026-01-15T00:00:00UTC/fechafin/2026-01-16T00:00:00UTC/estacion/89064");
  });

  it("rejects invalid station ids", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(
      c.antarctica.observations("!!", "2026-01-15", "2026-01-16"),
    ).rejects.toBeInstanceOf(AemetError);
  });

  it("rejects inverted ranges", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(
      c.antarctica.observations("89064", "2026-01-16", "2026-01-15"),
    ).rejects.toBeInstanceOf(AemetError);
  });
});
