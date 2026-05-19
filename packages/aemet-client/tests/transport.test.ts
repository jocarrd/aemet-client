import { describe, expect, it } from "vitest";
import {
  AemetAuthError,
  AemetInvalidResponseError,
  AemetNetworkError,
  AemetNotFoundError,
  AemetRateLimitError,
  AemetServerError,
} from "../src/errors.js";
import { Transport, type FetchLike } from "../src/transport.js";

type MockResponse = {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
};

function jsonResponse({ status, body, headers = {} }: MockResponse): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function mockFetch(responses: MockResponse[]): { fetch: FetchLike; calls: string[] } {
  const calls: string[] = [];
  let i = 0;
  const fetchFn: FetchLike = async (input) => {
    calls.push(String(input));
    const r = responses[i++];
    if (!r) throw new Error(`unexpected fetch call to ${String(input)}`);
    return jsonResponse(r);
  };
  return { fetch: fetchFn, calls };
}

function buildTransport(fetch: FetchLike, overrides: Partial<ConstructorParameters<typeof Transport>[0]> = {}) {
  return new Transport({
    apiKey: "test-key",
    fetch,
    retryBaseDelayMs: 1,
    maxRetries: 2,
    ...overrides,
  });
}

describe("Transport", () => {
  it("resolves the envelope two-step into typed data", async () => {
    const { fetch, calls } = mockFetch([
      {
        status: 200,
        body: {
          descripcion: "exito",
          estado: 200,
          datos: "https://opendata.aemet.es/opendata/sh/datos-1",
        },
      },
      { status: 200, body: [{ idema: "1234X", ta: 12.3 }] },
    ]);
    const t = buildTransport(fetch);
    const result = await t.request<Array<{ idema: string }>>("/observacion/convencional/todas");
    expect(result.data).toEqual([{ idema: "1234X", ta: 12.3 }]);
    expect(calls[0]).toContain("/observacion/convencional/todas");
    expect(calls[1]).toBe("https://opendata.aemet.es/opendata/sh/datos-1");
  });

  it("appends query parameters when provided", async () => {
    const { fetch, calls } = mockFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: {} },
    ]);
    const t = buildTransport(fetch);
    await t.request("/foo", { query: { idema: "1234X", limit: 5, skip: undefined } });
    expect(calls[0]).toBe("https://opendata.aemet.es/opendata/api/foo?idema=1234X&limit=5");
  });

  it("sends the api_key header", async () => {
    const calls: RequestInit[] = [];
    const fetchFn: FetchLike = async (_, init) => {
      calls.push(init ?? {});
      return jsonResponse({
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      });
    };
    const t = buildTransport(fetchFn);
    try {
      await t.requestEnvelope("/foo");
    } catch {
      // ignore — we only assert on the first fetch
    }
    const headers = calls[0]?.headers as Record<string, string>;
    expect(headers["api_key"]).toBe("test-key");
    expect(headers["accept"]).toBe("application/json");
  });

  it("maps 401 to AemetAuthError", async () => {
    const { fetch } = mockFetch([{ status: 401, body: { mensaje: "invalid" } }]);
    const t = buildTransport(fetch);
    await expect(t.requestEnvelope("/foo")).rejects.toBeInstanceOf(AemetAuthError);
  });

  it("maps 404 to AemetNotFoundError", async () => {
    const { fetch } = mockFetch([{ status: 404, body: { mensaje: "missing" } }]);
    const t = buildTransport(fetch);
    await expect(t.requestEnvelope("/foo")).rejects.toBeInstanceOf(AemetNotFoundError);
  });

  it("maps envelope with estado 404 to AemetNotFoundError", async () => {
    const { fetch } = mockFetch([
      { status: 200, body: { descripcion: "no encontrado", estado: 404 } },
    ]);
    const t = buildTransport(fetch);
    await expect(t.requestEnvelope("/foo")).rejects.toBeInstanceOf(AemetNotFoundError);
  });

  it("rejects when envelope is malformed", async () => {
    const { fetch } = mockFetch([{ status: 200, body: { foo: "bar" } }]);
    const t = buildTransport(fetch);
    await expect(t.requestEnvelope("/foo")).rejects.toBeInstanceOf(AemetInvalidResponseError);
  });

  it("rejects when response is not JSON", async () => {
    const { fetch } = mockFetch([{ status: 200, body: "<html>oops</html>" }]);
    const t = buildTransport(fetch);
    await expect(t.requestEnvelope("/foo")).rejects.toBeInstanceOf(AemetInvalidResponseError);
  });

  it("rejects when envelope estado is 200 but datos is missing", async () => {
    const { fetch } = mockFetch([
      { status: 200, body: { descripcion: "exito", estado: 200 } },
    ]);
    const t = buildTransport(fetch);
    await expect(t.request("/foo")).rejects.toBeInstanceOf(AemetInvalidResponseError);
  });

  it("retries on 503 and succeeds", async () => {
    const { fetch, calls } = mockFetch([
      { status: 503, body: "" },
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: { ok: true } },
    ]);
    const t = buildTransport(fetch);
    const result = await t.request<{ ok: boolean }>("/foo");
    expect(result.data).toEqual({ ok: true });
    expect(calls).toHaveLength(3);
  });

  it("retries on 429 honoring retry-after header", async () => {
    const { fetch } = mockFetch([
      { status: 429, body: "", headers: { "retry-after": "0" } },
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: { ok: true } },
    ]);
    const t = buildTransport(fetch);
    const result = await t.request<{ ok: boolean }>("/foo");
    expect(result.data).toEqual({ ok: true });
  });

  it("exhausts retries and surfaces the final status", async () => {
    const { fetch } = mockFetch([
      { status: 503, body: "" },
      { status: 503, body: "" },
      { status: 503, body: "" },
    ]);
    const t = buildTransport(fetch);
    await expect(t.requestEnvelope("/foo")).rejects.toBeInstanceOf(AemetServerError);
  });

  it("wraps low-level network errors", async () => {
    const fetchFn: FetchLike = async () => {
      throw new TypeError("fetch failed");
    };
    const t = buildTransport(fetchFn);
    await expect(t.requestEnvelope("/foo")).rejects.toBeInstanceOf(AemetNetworkError);
  });

  it("surfaces 429 from datos URL", async () => {
    const { fetch } = mockFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 429, body: "" },
      { status: 429, body: "" },
      { status: 429, body: "" },
    ]);
    const t = buildTransport(fetch, { maxRetries: 2 });
    await expect(t.request("/foo")).rejects.toBeInstanceOf(AemetRateLimitError);
  });
});
