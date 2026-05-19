import { describe, expect, it } from "vitest";
import { AemetClient } from "../src/client.js";
import { AemetError } from "../src/errors.js";
import type { FetchLike } from "../src/transport.js";

function envelope(datos: string): string {
  return JSON.stringify({ descripcion: "exito", estado: 200, datos });
}

describe("MapsResource", () => {
  it("returns the analysis map URL", async () => {
    const calls: string[] = [];
    const fetch: FetchLike = async (url) => {
      calls.push(String(url));
      return new Response(envelope("https://opendata.aemet.es/sh/analisis.png"), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.maps.analysisUrl();
    expect(result.url).toBe("https://opendata.aemet.es/sh/analisis.png");
    expect(calls[0]).toContain("/mapasygraficos/analisis");
  });

  it("returns a significant map URL with date/area/day", async () => {
    const calls: string[] = [];
    const fetch: FetchLike = async (url) => {
      calls.push(String(url));
      return new Response(envelope("https://opendata.aemet.es/sh/sig.png"), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    await c.maps.significantMapUrl("2026-05-17", "esp", 1);
    expect(calls[0]).toContain(
      "/mapasygraficos/mapasignificativo/fechaelaboracion/2026-05-17T00:00:00UTC/area/esp/dia/1",
    );
  });

  it("rejects invalid area and day", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(
      c.maps.significantMapUrl("2026-05-17", "!!", 1),
    ).rejects.toBeInstanceOf(AemetError);
    await expect(
      c.maps.significantMapUrl("2026-05-17", "esp", "abc"),
    ).rejects.toBeInstanceOf(AemetError);
  });
});
