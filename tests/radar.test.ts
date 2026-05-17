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

function jsonResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("RadarResource", () => {
  it("returns the national radar URL and metadata URL", async () => {
    const calls: string[] = [];
    const fetch: FetchLike = async (url) => {
      calls.push(String(url));
      return jsonResponse(envelope("https://opendata.aemet.es/sh/img-nacional.gif", "https://opendata.aemet.es/sh/metadata"));
    };
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.radar.nationalUrl();
    expect(result.url).toBe("https://opendata.aemet.es/sh/img-nacional.gif");
    expect(result.metadataUrl).toBe("https://opendata.aemet.es/sh/metadata");
    expect(calls[0]).toContain("/red/radar/nacional");
  });

  it("returns the regional radar URL", async () => {
    const fetch: FetchLike = async () =>
      jsonResponse(envelope("https://opendata.aemet.es/sh/img-vc.gif"));
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.radar.regionalUrl("vc");
    expect(result.url).toBe("https://opendata.aemet.es/sh/img-vc.gif");
    expect(result.metadataUrl).toBeUndefined();
  });

  it("downloads the radar image bytes", async () => {
    const imageBytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x00, 0x01]);
    let call = 0;
    const fetch: FetchLike = async () => {
      call += 1;
      if (call === 1) return jsonResponse(envelope("https://opendata.aemet.es/sh/img.gif"));
      return new Response(imageBytes as BlobPart, {
        status: 200,
        headers: { "content-type": "image/gif" },
      });
    };
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.radar.nationalImage();
    expect(result.contentType).toBe("image/gif");
    expect(result.bytes).toEqual(imageBytes);
    expect(result.url).toBe("https://opendata.aemet.es/sh/img.gif");
  });

  it("rejects malformed regional codes", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.radar.regionalUrl("abc")).rejects.toBeInstanceOf(AemetError);
    await expect(c.radar.regionalUrl("1")).rejects.toBeInstanceOf(AemetError);
    await expect(c.radar.regionalImage("zzzz")).rejects.toBeInstanceOf(AemetError);
  });
});
