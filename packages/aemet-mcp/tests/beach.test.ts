import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AemetNotFoundError, type AemetClient } from "aemet-client";
import { registerBeachTool } from "../src/tools/beach.js";
import { BEACHES } from "../src/data/beaches.js";

const payload = [
  {
    origen: {
      productor: "AEMET",
      web: "https://www.aemet.es",
      language: "es",
      copyright: "AEMET",
      notaLegal: "x",
    },
    elaborado: "2026-09-12T09:00:26",
    nombre: "La Concha",
    localidad: 39085,
    id: 3908503,
    prediccion: {
      dia: [
        {
          estadoCielo: {
            value: "",
            f1: 100,
            descripcion1: "despejado",
            f2: 110,
            descripcion2: "nuboso",
          },
          viento: { value: "", f1: 210, descripcion1: "flojo", f2: 210, descripcion2: "flojo" },
          oleaje: {
            value: "",
            f1: 320,
            descripcion1: "moderado",
            f2: 320,
            descripcion2: "moderado",
          },
          tMaxima: { value: "", valor1: 24 },
          sTermica: { value: "", valor1: 460, descripcion1: "calor agradable" },
          tAgua: { value: "", valor1: 19 },
          uvMax: { value: "", valor1: 6 },
          fecha: 20260912,
        },
        {
          estadoCielo: {
            value: "",
            f1: 110,
            descripcion1: "nuboso",
            f2: 110,
            descripcion2: "nuboso",
          },
          viento: {
            value: "",
            f1: 220,
            descripcion1: "moderado",
            f2: 220,
            descripcion2: "moderado",
          },
          oleaje: { value: "", f1: 330, descripcion1: "fuerte", f2: 330, descripcion2: "fuerte" },
          tMaxima: { value: "", valor1: 21 },
          sTermica: { value: "", valor1: 450, descripcion1: "suave" },
          tAgua: { value: "", valor1: 19 },
          uvMax: { value: "", valor1: 4 },
          fecha: 20260913,
        },
      ],
    },
  },
];

function stubClient(forecast: () => unknown): { client: AemetClient; calls: string[] } {
  const calls: string[] = [];
  const client = {
    beach: {
      forecast: vi.fn(async (code: string) => {
        calls.push(code);
        return forecast();
      }),
    },
  } as unknown as AemetClient;
  return { client, calls };
}

async function connect(client: AemetClient) {
  const server = new McpServer(
    { name: "test-server", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );
  registerBeachTool(server, client);
  const mcp = new Client({ name: "test-client", version: "0.0.0" }, { capabilities: {} });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return mcp;
}

async function callBeach(
  client: AemetClient,
  args: Record<string, unknown>,
): Promise<{ isError: boolean; text: string }> {
  const mcp = await connect(client);
  const res = await mcp.callTool({ name: "get_beach_forecast", arguments: args });
  const content = res.content as Array<{ type: string; text: string }>;
  return { isError: res.isError === true, text: content[0]?.text ?? "" };
}

describe("beach catalogue", () => {
  it("holds AEMET beach codes: 5-digit INE municipality plus a 2-digit beach number", () => {
    expect(BEACHES.length).toBeGreaterThan(500);
    for (const beach of BEACHES) {
      expect(beach.id).toMatch(/^\d{7}$/);
      expect(beach.name).not.toBe("");
      expect(beach.municipality).not.toBe("");
    }
  });

  it("has no duplicate codes", () => {
    expect(new Set(BEACHES.map((b) => b.id)).size).toBe(BEACHES.length);
  });
});

describe("get_beach_forecast", () => {
  it("registers the tool with a description and an input schema", async () => {
    const { client } = stubClient(() => payload);
    const mcp = await connect(client);
    const list = await mcp.listTools();
    const tool = list.tools.find((t) => t.name === "get_beach_forecast");
    expect(tool).toBeDefined();
    expect(tool?.description).toBeTruthy();
    expect(tool?.inputSchema).toBeDefined();
  });

  it("formats every documented field for each day", async () => {
    const { client, calls } = stubClient(() => payload);
    const res = await callBeach(client, { location: "La Concha", municipality: "Suances" });
    expect(res.isError).toBe(false);
    expect(calls).toEqual(["3908503"]);
    expect(res.text).toContain("La Concha (Suances, Cantabria)");
    expect(res.text).toContain("issued 2026-09-12T09:00:26");
    expect(res.text).toContain("2026-09-12");
    expect(res.text).toContain("Sky: despejado (morning) / nuboso (afternoon)");
    expect(res.text).toContain("Wind: flojo");
    expect(res.text).toContain("Waves: moderado");
    expect(res.text).toContain("Max temperature: 24°");
    expect(res.text).toContain("Water temperature: 19°");
    expect(res.text).toContain("Thermal sensation: calor agradable");
    expect(res.text).toContain("UV max: 6");
  });

  it("collapses morning and afternoon when they match", async () => {
    const { client } = stubClient(() => payload);
    const res = await callBeach(client, { location: "3908503" });
    expect(res.text).not.toContain("Wind: flojo (morning)");
    expect(res.text).toContain("Wind: flojo");
  });

  it("honours the days limit", async () => {
    const { client } = stubClient(() => payload);
    const res = await callBeach(client, { location: "3908503", days: 1 });
    expect(res.text).toContain("2026-09-12");
    expect(res.text).not.toContain("2026-09-13");
  });

  it("resolves names without accents and with loose punctuation", async () => {
    const { client, calls } = stubClient(() => payload);
    const res = await callBeach(client, { location: "la kontxa" });
    expect(res.isError).toBe(false);
    expect(calls).toEqual(["2006904"]);
  });

  it("drops the generic 'playa de' prefix people write", async () => {
    const { client, calls } = stubClient(() => payload);
    const res = await callBeach(client, { location: "playa de la concha, suances" });
    expect(res.isError).toBe(false);
    expect(calls).toEqual(["3908503"]);
  });

  it("falls back to dropping the leading article", async () => {
    const { client, calls } = stubClient(() => payload);
    const res = await callBeach(client, { location: "el sardinero" });
    expect(res.isError).toBe(false);
    expect(calls).toEqual(["3907506"]);
  });

  it("matches a beach listed under a compound name", async () => {
    const { client, calls } = stubClient(() => payload);
    const res = await callBeach(client, { location: "la malvarrosa", municipality: "Valencia" });
    expect(res.isError).toBe(false);
    expect(calls).toEqual(["4625001"]);
  });

  it("accepts the municipality inline after a comma", async () => {
    const { client, calls } = stubClient(() => payload);
    const res = await callBeach(client, { location: "La Concha, Oropesa" });
    expect(res.isError).toBe(false);
    expect(calls).toEqual(["1208503"]);
  });

  it("narrows by province when no municipality matches", async () => {
    const { client, calls } = stubClient(() => payload);
    const res = await callBeach(client, { location: "La Concha", municipality: "Cantabria" });
    expect(res.isError).toBe(false);
    expect(calls).toEqual(["3908503"]);
  });

  it("prefers the municipality over the province of the same name", async () => {
    const { client, calls } = stubClient(() => payload);
    const res = await callBeach(client, { location: "La Devesa", municipality: "Valencia" });
    expect(res.isError).toBe(false);
    expect(calls).toEqual(["4625004"]);
  });

  it("lists the candidates when a beach name repeats along the coast", async () => {
    const { client, calls } = stubClient(() => payload);
    const res = await callBeach(client, { location: "La Concha" });
    expect(res.isError).toBe(true);
    expect(calls).toEqual([]);
    expect(res.text).toContain("matches 2 AEMET beaches");
    expect(res.text).toContain("3908503");
    expect(res.text).toContain("1208503");
    expect(res.text).toContain("add the municipality");
  });

  it("lists the beaches of a coastal municipality when given only its name", async () => {
    const { client } = stubClient(() => payload);
    const res = await callBeach(client, { location: "Donostia" });
    expect(res.isError).toBe(true);
    expect(res.text).toContain("La Zurriola");
    expect(res.text).toContain("Ondarreta");
  });

  it("resolves a municipality that has a single beach", async () => {
    const { client, calls } = stubClient(() => payload);
    const res = await callBeach(client, { location: "Benissa" });
    expect(res.isError).toBe(false);
    expect(calls).toEqual(["0304105"]);
  });

  it("rejects an unknown beach name", async () => {
    const { client } = stubClient(() => payload);
    const res = await callBeach(client, { location: "Playa de Atlantis" });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/No AEMET beach matches/i);
  });

  it("rejects an unknown 7-digit code", async () => {
    const { client } = stubClient(() => payload);
    const res = await callBeach(client, { location: "9999999" });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/No beach with AEMET code/i);
  });

  it("explains the seasonal gap when AEMET answers 404", async () => {
    const { client } = stubClient(() => {
      throw new AemetNotFoundError({
        endpoint: "/prediccion/especifica/playa/3908503",
        status: 404,
      });
    });
    const res = await callBeach(client, { location: "3908503" });
    expect(res.isError).toBe(true);
    expect(res.text).toContain("seasonal");
  });

  it("reports an empty AEMET response", async () => {
    const { client } = stubClient(() => []);
    const res = await callBeach(client, { location: "3908503" });
    expect(res.isError).toBe(true);
    expect(res.text).toContain("no beach forecast");
  });
});
