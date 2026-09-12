import { describe, expect, it } from "vitest";
import { AemetClient } from "../src/client.js";
import { AemetError, AemetNotFoundError } from "../src/errors.js";
import { BeachForecastUnavailableError } from "../src/resources/beach/index.js";
import type { BeachForecast } from "../src/resources/beach/index.js";
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

const beachFixture: BeachForecast[] = [
  {
    origen: {
      productor: "Agencia Estatal de Meteorología - AEMET. Gobierno de España",
      web: "http://www.aemet.es",
      language: "es",
      copyright:
        "© AEMET. Autorizado el uso de la información y su reproducción citando a AEMET como autora de la misma.",
      notaLegal: "http://www.aemet.es/es/nota_legal",
    },
    elaborado: "2026-09-12T09:00:26",
    nombre: "La Concha",
    localidad: -26451,
    prediccion: {
      dia: [
        {
          estadoCielo: {
            value: "",
            f1: 100,
            descripcion1: "despejado",
            f2: 100,
            descripcion2: "despejado",
          },
          viento: { value: "", f1: 210, descripcion1: "flojo", f2: 220, descripcion2: "moderado" },
          oleaje: { value: "", f1: 310, descripcion1: "débil", f2: 320, descripcion2: "moderado" },
          tMaxima: { value: "", valor1: 23 },
          sTermica: { value: "", valor1: 450, descripcion1: "suave" },
          tAgua: { value: "", valor1: 22 },
          uvMax: { value: "", valor1: 6 },
          fecha: 20260912,
          tagua: { value: "", valor1: 22 },
          stermica: { value: "", valor1: 450, descripcion1: "suave" },
          tmaxima: { value: "", valor1: 23 },
        },
        {
          estadoCielo: {
            value: "",
            f1: 100,
            descripcion1: "despejado",
            f2: 100,
            descripcion2: "despejado",
          },
          viento: { value: "", f1: 210, descripcion1: "flojo", f2: 220, descripcion2: "moderado" },
          oleaje: {
            value: "",
            f1: 320,
            descripcion1: "moderado",
            f2: 320,
            descripcion2: "moderado",
          },
          tMaxima: { value: "", valor1: 25 },
          sTermica: { value: "", valor1: 460, descripcion1: "calor agradable" },
          tAgua: { value: "", valor1: 22 },
          uvMax: { value: "", valor1: 6 },
          fecha: 20260913,
          tagua: { value: "", valor1: 22 },
          stermica: { value: "", valor1: 460, descripcion1: "calor agradable" },
          tmaxima: { value: "", valor1: 25 },
        },
        {
          estadoCielo: {
            value: "",
            f1: 100,
            descripcion1: "despejado",
            f2: 100,
            descripcion2: "despejado",
          },
          viento: { value: "", f1: 210, descripcion1: "flojo", f2: 220, descripcion2: "moderado" },
          oleaje: { value: "", f1: 320, descripcion1: "moderado", f2: 310, descripcion2: "débil" },
          tMaxima: { value: "", valor1: 27 },
          sTermica: { value: "", valor1: 460, descripcion1: "calor agradable" },
          tAgua: { value: "", valor1: 22 },
          uvMax: { value: "", valor1: 6 },
          fecha: 20260914,
          tagua: { value: "", valor1: 22 },
          stermica: { value: "", valor1: 460, descripcion1: "calor agradable" },
          tmaxima: { value: "", valor1: 27 },
        },
      ],
    },
    id: 3908503,
  },
];

describe("BeachResource", () => {
  it("fetches a beach forecast", async () => {
    const { fetch, calls } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "exito", estado: 200, datos: "https://x/d" },
      },
      { status: 200, body: beachFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const result = await c.beach.forecast("3908503");
    expect(result).toEqual(beachFixture);
    expect(calls[0]).toContain("/prediccion/especifica/playa/3908503");
  });

  it("reports the three seasonal days with morning and afternoon codes", async () => {
    const { fetch } = fixtureFetch([
      { status: 200, body: { descripcion: "exito", estado: 200, datos: "https://x/d" } },
      { status: 200, body: beachFixture },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const [doc] = await c.beach.forecast("3908503");
    const days = doc?.prediccion.dia ?? [];
    expect(days).toHaveLength(3);
    const [first] = days;
    expect(first?.fecha).toBe(20260912);
    expect(first?.oleaje.descripcion1).toBe("débil");
    expect(first?.oleaje.descripcion2).toBe("moderado");
    expect(first?.sTermica.valor1).toBe(450);
    expect(first?.uvMax.valor1).toBe(6);
  });

  it("rejects beach codes that are not seven digits", async () => {
    const c = new AemetClient({ apiKey: "k", fetch: (async () => new Response()) as FetchLike });
    await expect(c.beach.forecast("abc")).rejects.toBeInstanceOf(AemetError);
    await expect(c.beach.forecast("12")).rejects.toBeInstanceOf(AemetError);
    await expect(c.beach.forecast("390850")).rejects.toBeInstanceOf(AemetError);
    await expect(c.beach.forecast("20069001")).rejects.toThrow(/Expected 7 digits/);
  });

  it("explains that the product is seasonal when AEMET answers 404", async () => {
    const { fetch } = fixtureFetch([
      {
        status: 200,
        body: { descripcion: "No hay datos que satisfagan esos criterios", estado: 404 },
      },
    ]);
    const c = new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
    const error = await c.beach.forecast("3908503").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(BeachForecastUnavailableError);
    expect(error).toBeInstanceOf(AemetNotFoundError);
    expect((error as BeachForecastUnavailableError).playa).toBe("3908503");
    expect((error as BeachForecastUnavailableError).message).toMatch(/seasonal/);
    expect((error as BeachForecastUnavailableError).description).toBe(
      "No hay datos que satisfagan esos criterios",
    );
  });
});
