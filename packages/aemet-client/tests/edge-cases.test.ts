import { describe, expect, it } from "vitest";
import { AemetClient } from "../src/client.js";
import { AemetError, AemetNetworkError } from "../src/errors.js";
import { parseCapXml } from "../src/resources/warnings/cap.js";
import { parseTar } from "../src/resources/warnings/tar.js";
import { Transport, type FetchLike } from "../src/transport.js";
import { parseSpanishNumber, toAemetDate } from "../src/utils/date.js";
import { buildTar } from "./helpers/tar.js";

describe("Transport edge cases", () => {
  it("propagates external AbortSignal as the rejection", async () => {
    const fetch: FetchLike = (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    const t = new Transport({ apiKey: "k", fetch, maxRetries: 0, retryBaseDelayMs: 1 });
    const controller = new AbortController();
    setTimeout(() => controller.abort(new Error("user cancel")), 10);
    await expect(t.requestEnvelope("/foo", { signal: controller.signal })).rejects.toHaveProperty(
      "name",
      "AbortError",
    );
  });

  it("aborts on internal timeout when fetch never resolves", async () => {
    const fetch: FetchLike = (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const err = new Error("aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    const t = new Transport({ apiKey: "k", fetch, maxRetries: 0, timeoutMs: 20, retryBaseDelayMs: 1 });
    await expect(t.requestEnvelope("/foo")).rejects.toBeInstanceOf(AemetNetworkError);
  });

  it("URL-encodes non-ASCII characters in the path", async () => {
    const calls: string[] = [];
    const fetch: FetchLike = async (url) => {
      calls.push(String(url));
      return new Response(
        JSON.stringify({ descripcion: "exito", estado: 200, datos: "https://x/d" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const t = new Transport({ apiKey: "k", fetch, maxRetries: 0, retryBaseDelayMs: 1 });
    await t.requestEnvelope("/prediccion/especifica/montaña/5/periodo/0");
    expect(calls[0]).toBe(
      "https://opendata.aemet.es/opendata/api/prediccion/especifica/montaña/5/periodo/0",
    );
    expect(new URL(calls[0] ?? "").pathname).toContain("/monta%C3%B1a/");
  });

  it("decodes ISO-8859-1 JSON responses when charset is declared", async () => {
    const latin1 = new Uint8Array([
      0x7b, 0x22, 0x6e, 0x6f, 0x6d, 0x62, 0x72, 0x65, 0x22, 0x3a, 0x22, 0xc1, 0x76, 0x69, 0x6c, 0x61,
      0x22, 0x2c, 0x22, 0x6e, 0x22, 0x3a, 0x31, 0x7d,
    ]);
    const fetch: FetchLike = async () =>
      new Response(latin1 as BlobPart, {
        status: 200,
        headers: { "content-type": "application/json; charset=ISO-8859-1" },
      });
    const t = new Transport({ apiKey: "k", fetch, maxRetries: 0, retryBaseDelayMs: 1 });
    await expect(t.fetchExternal<{ nombre: string }>("https://x/d")).resolves.toEqual({
      nombre: "Ávila",
      n: 1,
    });
  });

  it("forwards the api_key header on the envelope fetch only", async () => {
    const seen: Array<{ url: string; key: string | null }> = [];
    const fetch: FetchLike = async (url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      seen.push({ url: String(url), key: headers["api_key"] ?? null });
      if (seen.length === 1) {
        return new Response(
          JSON.stringify({ descripcion: "exito", estado: 200, datos: "https://opendata.aemet.es/sh/d" }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(JSON.stringify([{ ok: true }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const t = new Transport({ apiKey: "K", fetch, maxRetries: 0, retryBaseDelayMs: 1 });
    await t.request("/foo");
    expect(seen[0]?.key).toBe("K");
    expect(seen[1]?.key).toBe("K");
  });
});

describe("parseSpanishNumber edge cases", () => {
  it("returns undefined for AEMET sentinel strings", () => {
    expect(parseSpanishNumber("Ip")).toBeUndefined();
    expect(parseSpanishNumber("Acum")).toBeUndefined();
    expect(parseSpanishNumber("-")).toBeUndefined();
    expect(parseSpanishNumber("Varias")).toBeUndefined();
  });

  it("parses zero correctly", () => {
    expect(parseSpanishNumber("0")).toBe(0);
    expect(parseSpanishNumber("0,0")).toBe(0);
    expect(parseSpanishNumber("0,00")).toBe(0);
  });

  it("parses signed values", () => {
    expect(parseSpanishNumber("-0,3")).toBe(-0.3);
    expect(parseSpanishNumber("+12,5")).toBe(12.5);
  });

  it("handles values with whitespace", () => {
    expect(parseSpanishNumber("  4,7  ")).toBe(4.7);
  });

  it("strips multiple thousand separators", () => {
    expect(parseSpanishNumber("1.234.567,89")).toBe(1234567.89);
  });
});

describe("toAemetDate edge cases", () => {
  it("formats dates near year boundaries in UTC", () => {
    expect(toAemetDate(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)))).toBe("2026-01-01T00:00:00UTC");
    expect(toAemetDate(new Date(Date.UTC(2025, 11, 31, 23, 59, 59)))).toBe("2025-12-31T23:59:59UTC");
  });

  it("zero-pads single digits", () => {
    expect(toAemetDate(new Date(Date.UTC(2026, 0, 5, 3, 4, 5)))).toBe("2026-01-05T03:04:05UTC");
  });
});

describe("Tar parser edge cases", () => {
  it("recombines name + ustar prefix for long paths", () => {
    const longPrefix =
      "very-long-prefix-directory-segment/another-segment/and-another/and-yet-more/deeper/even/deeper/structure";
    const fullName = `${longPrefix}/alert.xml`;
    expect(fullName.length).toBeGreaterThan(100);
    const tar = buildTar([{ name: fullName, content: "<alert/>" }]);
    const entries = parseTar(tar);
    expect(entries[0]?.name).toBe(fullName);
    expect(new TextDecoder().decode(entries[0]?.content)).toBe("<alert/>");
  });

  it("handles entries with zero-byte content", () => {
    const tar = buildTar([
      { name: "first.txt", content: "" },
      { name: "second.txt", content: "second" },
    ]);
    const entries = parseTar(tar);
    expect(entries).toHaveLength(2);
    expect(entries[0]?.size).toBe(0);
    expect(entries[0]?.content.length).toBe(0);
    expect(new TextDecoder().decode(entries[1]?.content)).toBe("second");
  });

  it("stops at the first zero block", () => {
    const tar = buildTar([{ name: "only.txt", content: "abc" }]);
    const trailing = new Uint8Array(tar.length + 1024);
    trailing.set(tar);
    const entries = parseTar(trailing);
    expect(entries).toHaveLength(1);
  });

  it("returns empty array for a buffer of only zero blocks", () => {
    expect(parseTar(new Uint8Array(1024))).toEqual([]);
  });

  it("returns empty array for an empty buffer", () => {
    expect(parseTar(new Uint8Array(0))).toEqual([]);
  });

  it("throws on a truncated entry", () => {
    const truncated = new Uint8Array(700);
    truncated.set(new TextEncoder().encode("test.txt"), 0);
    const sizeStr = (500).toString(8).padStart(11, "0");
    truncated.set(new TextEncoder().encode(sizeStr), 124);
    truncated[156] = "0".charCodeAt(0);
    truncated.set(new TextEncoder().encode("ustar"), 257);
    expect(() => parseTar(truncated)).toThrow(/truncated/i);
  });
});

describe("CAP parser edge cases", () => {
  it("accepts a single <info> element (no array)", () => {
    const xml = `<?xml version="1.0"?>
<alert>
  <identifier>X</identifier>
  <sender>aemet@aemet.es</sender>
  <sent>2026-05-17T08:00:00+02:00</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <language>es-ES</language>
    <category>Met</category>
    <event>Lluvias</event>
    <urgency>Future</urgency>
    <severity>Moderate</severity>
    <certainty>Likely</certainty>
    <senderName>AEMET</senderName>
    <headline>head</headline>
    <description>desc</description>
    <area>
      <areaDesc>A</areaDesc>
    </area>
  </info>
</alert>`;
    const alert = parseCapXml(xml);
    expect(alert.info).toHaveLength(1);
    expect(alert.info[0]?.event).toBe("Lluvias");
    expect(alert.info[0]?.area[0]?.areaDesc).toBe("A");
  });

  it("preserves multi-line descriptions", () => {
    const xml = `<?xml version="1.0"?>
<alert>
  <identifier>X</identifier>
  <sender>aemet@aemet.es</sender>
  <sent>2026-05-17T08:00:00+02:00</sent>
  <status>Actual</status>
  <msgType>Alert</msgType>
  <scope>Public</scope>
  <info>
    <language>es-ES</language>
    <category>Met</category>
    <event>Viento</event>
    <urgency>Future</urgency>
    <severity>Severe</severity>
    <certainty>Likely</certainty>
    <senderName>AEMET</senderName>
    <headline>h</headline>
    <description>Linea 1
Linea 2
Linea 3</description>
  </info>
</alert>`;
    const alert = parseCapXml(xml);
    expect(alert.info[0]?.description).toContain("Linea 1");
    expect(alert.info[0]?.description).toContain("Linea 3");
  });

  it("rejects an entirely empty XML", () => {
    expect(() => parseCapXml("")).toThrow();
  });

  it("parses CAP documents that use a namespace prefix", () => {
    const xml = `<?xml version="1.0"?>
<cap:alert xmlns:cap="urn:oasis:names:tc:emergency:cap:1.2">
  <cap:identifier>ns-1</cap:identifier>
  <cap:sender>aemet@aemet.es</cap:sender>
  <cap:sent>2026-05-17T08:00:00+02:00</cap:sent>
  <cap:status>Actual</cap:status>
  <cap:msgType>Alert</cap:msgType>
  <cap:scope>Public</cap:scope>
  <cap:info>
    <cap:language>es-ES</cap:language>
    <cap:event>Lluvias</cap:event>
    <cap:urgency>Future</cap:urgency>
    <cap:severity>Moderate</cap:severity>
    <cap:certainty>Likely</cap:certainty>
    <cap:senderName>AEMET</cap:senderName>
    <cap:headline>h</cap:headline>
    <cap:description>d</cap:description>
  </cap:info>
</cap:alert>`;
    const alert = parseCapXml(xml);
    expect(alert.identifier).toBe("ns-1");
    expect(alert.info[0]?.event).toBe("Lluvias");
  });
});

describe("AemetClient config edge cases", () => {
  it("does not require an env-derived key when one is passed explicitly", () => {
    const previous = process.env.AEMET_API_KEY;
    delete process.env.AEMET_API_KEY;
    try {
      const c = new AemetClient({ apiKey: "explicit" });
      expect(c.transport).toBeDefined();
    } finally {
      if (previous !== undefined) process.env.AEMET_API_KEY = previous;
    }
  });

  it("messages the missing-key error helpfully", () => {
    const previous = process.env.AEMET_API_KEY;
    delete process.env.AEMET_API_KEY;
    try {
      expect(() => new AemetClient()).toThrow(/AEMET_API_KEY/);
    } finally {
      if (previous !== undefined) process.env.AEMET_API_KEY = previous;
    }
  });

  it("forwards a custom userAgent", async () => {
    const seen: string[] = [];
    const fetch: FetchLike = async (_url, init) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      seen.push(headers["user-agent"] ?? "");
      return new Response(
        JSON.stringify({ descripcion: "exito", estado: 200, datos: "https://x/d" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
    const c = new AemetClient({ apiKey: "k", fetch, userAgent: "snowy/2.0", retryBaseDelayMs: 1 });
    await c.transport.requestEnvelope("/foo");
    expect(seen[0]).toBe("snowy/2.0");
  });
});

describe("Climatology boundary cases", () => {
  it("accepts a range of exactly 5 years", async () => {
    const fetch: FetchLike = async (url) =>
      String(url).includes("/diarios/")
        ? new Response(JSON.stringify({ descripcion: "exito", estado: 200, datos: "https://x/d" }), {
            status: 200,
            headers: { "content-type": "application/json" },
          })
        : new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    await expect(c.climatology.daily("3195", "2021-01-01", "2025-12-30")).resolves.toBeDefined();
  });

  it("rejects a range just over 5 years", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.climatology.daily("3195", "2021-01-01", "2026-12-31")).rejects.toBeInstanceOf(
      AemetError,
    );
  });
});
