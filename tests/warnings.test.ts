import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { AemetClient } from "../src/client.js";
import { AemetError } from "../src/errors.js";
import { parseCapXml } from "../src/resources/warnings/cap.js";
import { isGzip } from "../src/resources/warnings/gzip.js";
import { parseTar } from "../src/resources/warnings/tar.js";
import type { FetchLike } from "../src/transport.js";
import { CAP_SAMPLE_XML } from "./fixtures/cap-sample.js";
import { buildTar } from "./helpers/tar.js";

describe("parseTar", () => {
  it("parses a tar with a single text file", () => {
    const tar = buildTar([{ name: "hello.txt", content: "hello world" }]);
    const entries = parseTar(tar);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.name).toBe("hello.txt");
    expect(new TextDecoder().decode(entries[0]?.content)).toBe("hello world");
  });

  it("parses a tar with multiple files of varied sizes", () => {
    const small = "a".repeat(13);
    const large = "x".repeat(2000);
    const tar = buildTar([
      { name: "small.txt", content: small },
      { name: "deep/large.xml", content: large },
    ]);
    const entries = parseTar(tar);
    expect(entries.map((e) => e.name)).toEqual(["small.txt", "deep/large.xml"]);
    expect(new TextDecoder().decode(entries[0]?.content)).toBe(small);
    expect(new TextDecoder().decode(entries[1]?.content)).toBe(large);
  });
});

describe("isGzip", () => {
  it("detects the gzip magic bytes", () => {
    const gz = new Uint8Array(gzipSync(Buffer.from("hello")));
    expect(isGzip(gz)).toBe(true);
    expect(isGzip(new Uint8Array([0, 1, 2, 3]))).toBe(false);
  });
});

describe("parseCapXml", () => {
  it("parses an AEMET CAP alert with multiple info blocks", () => {
    const alert = parseCapXml(CAP_SAMPLE_XML);
    expect(alert.identifier).toBe("2.49.0.0.724.0.20260517081500");
    expect(alert.status).toBe("Actual");
    expect(alert.msgType).toBe("Alert");
    expect(alert.scope).toBe("Public");
    expect(alert.code).toEqual(["AEMET-Meteoalerta"]);
    expect(alert.info).toHaveLength(2);
    const es = alert.info[0];
    expect(es?.language).toBe("es-ES");
    expect(es?.event).toBe("Tormentas");
    expect(es?.severity).toBe("Moderate");
    expect(es?.parameters).toEqual([
      { valueName: "AEMET-Meteoalerta nivel", value: "amarillo" },
      { valueName: "AEMET-Meteoalerta fenomeno", value: "TO" },
    ]);
    expect(es?.area[0]?.areaDesc).toBe("Madrid - Henares");
    expect(es?.area[0]?.polygon).toEqual(["40.5,-3.5 40.6,-3.4 40.7,-3.3 40.5,-3.5"]);
    expect(es?.area[0]?.geocode).toEqual([
      { valueName: "AEMET-Meteoalerta zona", value: "761201" },
    ]);
  });

  it("throws on missing <alert> root", () => {
    expect(() => parseCapXml("<other/>")).toThrow();
  });
});

describe("WarningsResource", () => {
  function setupTarFetch(tarBytes: Uint8Array, contentType = "application/x-tar"): {
    fetch: FetchLike;
    calls: string[];
  } {
    const calls: string[] = [];
    let i = 0;
    const fetch: FetchLike = async (url) => {
      calls.push(String(url));
      if (i === 0) {
        i += 1;
        return new Response(
          JSON.stringify({
            descripcion: "exito",
            estado: 200,
            datos: "https://opendata.aemet.es/opendata/sh/cap-archive",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      i += 1;
      return new Response(tarBytes as BlobPart, {
        status: 200,
        headers: { "content-type": contentType },
      });
    };
    return { fetch, calls };
  }

  it("downloads, untars and parses CAP documents", async () => {
    const tar = buildTar([
      { name: "Z_CAP_C_LEMM_20260517_AFAM01_es.xml", content: CAP_SAMPLE_XML },
      { name: "Z_CAP_C_LEMM_20260517_AFAM01_en.xml", content: CAP_SAMPLE_XML },
    ]);
    const { fetch, calls } = setupTarFetch(tar);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const docs = await c.warnings.latest("73");
    expect(docs).toHaveLength(2);
    expect(docs[0]?.alert.identifier).toBe("2.49.0.0.724.0.20260517081500");
    expect(calls[0]).toContain("/avisos_cap/ultimoelaborado/area/73");
  });

  it("handles gzip-compressed archives", async () => {
    const tar = buildTar([{ name: "alert.xml", content: CAP_SAMPLE_XML }]);
    const gz = new Uint8Array(gzipSync(Buffer.from(tar)));
    const { fetch } = setupTarFetch(gz, "application/gzip");
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const docs = await c.warnings.latest("esp");
    expect(docs).toHaveLength(1);
    expect(docs[0]?.filename).toBe("alert.xml");
  });

  it("rejects invalid area codes", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.warnings.latest("invalid")).rejects.toBeInstanceOf(AemetError);
    await expect(c.warnings.latest("1")).rejects.toBeInstanceOf(AemetError);
  });
});
