import { describe, expect, it } from "vitest";
import { AemetClient } from "../src/client.js";
import { AemetError } from "../src/errors.js";
import type { FetchLike } from "../src/transport.js";

function envelope(datos: string, metadatos?: string): string {
  return JSON.stringify({
    descripcion: "exito",
    estado: 200,
    datos,
    ...(metadatos !== undefined ? { metadatos } : {}),
  });
}

describe("SatelliteResource", () => {
  it("returns the satellite product image URL", async () => {
    const fetch: FetchLike = async () =>
      new Response(envelope("https://opendata.aemet.es/sh/sat.jpg"), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.satellite.productUrl("sat");
    expect(result.url).toBe("https://opendata.aemet.es/sh/sat.jpg");
  });

  it("downloads the satellite image bytes", async () => {
    const imageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    let call = 0;
    const fetch: FetchLike = async () => {
      call += 1;
      if (call === 1) {
        return new Response(envelope("https://opendata.aemet.es/sh/sat.jpg"), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(imageBytes as BlobPart, {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    };
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.satellite.productImage("sat");
    expect(result.contentType).toBe("image/jpeg");
    expect(result.bytes).toEqual(imageBytes);
  });

  it("rejects invalid product codes", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.satellite.productUrl("!")).rejects.toBeInstanceOf(AemetError);
    await expect(c.satellite.productImage("x".repeat(20))).rejects.toBeInstanceOf(AemetError);
  });
});
