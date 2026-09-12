import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { AemetClient } from "aemet-client";
import { registerMaritimeTool } from "../src/tools/maritime.js";
import { MARITIME_AREAS } from "../src/data/maritime-areas.js";

const origen = {
  productor: "Agencia Estatal de Meteorología - AEMET - Gobierno de España",
  web: "http://www.aemet.es",
  language: "es",
  copyright: "© AEMET",
  notaLegal: "http://www.aemet.es/es/nota_legal",
  elaborado: "2026-09-12T12:00:00",
  inicio: "2026-09-12T12:00:00",
  fin: "2026-09-13T12:00:00",
};

const coastalPayload = [
  {
    origen,
    aviso: {
      inicio: "2026-09-12T12:00:00",
      fin: "2026-09-13T12:00:00",
      texto: "Viento de Levante fuerza 7, al oeste de Tarifa",
      id: "A801",
      nombre: "Avisos para Asturias, Cantabria y País Vasco",
    },
    situacion: {
      inicio: "2026-09-12T12:00:00",
      fin: "2026-09-13T12:00:00",
      texto: "Anticiclón en el Cantábrico 1026",
      id: "S801",
      nombre: "Situación General",
    },
    prediccion: {
      inicio: "2026-09-12T12:00:00",
      fin: "2026-09-13T12:00:00",
      zona: [
        {
          subzona: [
            { texto: "E 4 o 5. Marejada.", id: 8033010, nombre: "Aguas costeras de Asturias" },
          ],
          id: 8033010,
          nombre: "Aguas costeras de Asturias",
        },
        {
          subzona: [
            { texto: "NE 4 o 5. Marejadilla.", id: 8063911, nombre: "Norte de Cantabria" },
            { texto: "E 3 o 4. Rizada.", id: 8063912, nombre: "Sur de Cantabria" },
          ],
          id: 8063910,
          nombre: "Aguas costeras de Cantabria",
        },
      ],
    },
    tendencia: {
      inicio: "2026-09-13T12:00:00",
      fin: "2026-09-14T12:00:00",
      texto: "No se esperan condiciones de aviso en ninguna zona",
    },
    id: "FQXX41",
    nombre: "Boletín meteorológico y marino para las zonas costeras",
  },
];

const highSeasPayload = [
  {
    origen: { ...origen, elaborado: "2026-09-12T08:00:00", inicio: "2026-09-12T08:00:00" },
    situacion: {
      inicio: "2026-09-12T08:00:00",
      fin: "2026-09-13T08:00:00",
      texto: "Baja al W de Irlanda 1001",
      id: "S901",
      nombre: "Situación General del Atlántico al Norte de 30º N",
    },
    prediccion: {
      inicio: "2026-09-12T08:00:00",
      fin: "2026-09-13T08:00:00",
      zona: [
        { texto: "SW 4 a 6. Marejada. Regular", id: 9101, nombre: "Gran Sol" },
        { texto: "Componente E 2 a 4. Marejadilla.", id: 9109, nombre: "Cantábrico" },
      ],
    },
    id: "FQNT42",
    nombre: "Zonas del Atlántico al norte de 30N",
  },
];

interface Calls {
  coastal: string[];
  highSeas: string[];
}

function stubClient(
  coastal: () => unknown = () => coastalPayload,
  highSeas: () => unknown = () => highSeasPayload,
): { client: AemetClient; calls: Calls } {
  const calls: Calls = { coastal: [], highSeas: [] };
  const client = {
    maritime: {
      coastal: vi.fn(async (code: string) => {
        calls.coastal.push(code);
        return coastal();
      }),
      highSeas: vi.fn(async (code: string) => {
        calls.highSeas.push(code);
        return highSeas();
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
  registerMaritimeTool(server, client);
  const mcp = new Client({ name: "test-client", version: "0.0.0" }, { capabilities: {} });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return mcp;
}

async function callMaritime(
  client: AemetClient,
  args: Record<string, unknown>,
): Promise<{ isError: boolean; text: string }> {
  const mcp = await connect(client);
  const res = await mcp.callTool({ name: "get_maritime_forecast", arguments: args });
  const content = res.content as Array<{ type: string; text: string }>;
  return { isError: res.isError === true, text: content[0]?.text ?? "" };
}

describe("maritime area table", () => {
  it("holds the three high seas areas and the eight coastal ones", () => {
    const highSeas = MARITIME_AREAS.filter((a) => a.product === "high_seas").map((a) => a.code);
    const coastal = MARITIME_AREAS.filter((a) => a.product === "coastal").map((a) => a.code);
    expect(highSeas.sort()).toEqual(["0", "1", "2"]);
    expect(coastal.sort()).toEqual(["40", "41", "42", "43", "44", "45", "46", "47"]);
  });

  it("has no duplicate codes and never leaves an area without zones", () => {
    expect(new Set(MARITIME_AREAS.map((a) => a.code)).size).toBe(MARITIME_AREAS.length);
    for (const area of MARITIME_AREAS) {
      expect(area.name).not.toBe("");
      expect(area.zones.length).toBeGreaterThan(0);
    }
  });
});

describe("get_maritime_forecast", () => {
  it("registers the tool with a description and an input schema", async () => {
    const { client } = stubClient();
    const mcp = await connect(client);
    const list = await mcp.listTools();
    const tool = list.tools.find((t) => t.name === "get_maritime_forecast");
    expect(tool).toBeDefined();
    expect(tool?.description).toBeTruthy();
    expect(tool?.inputSchema).toBeDefined();
  });

  it("resolves the coastal area people name and formats the whole bulletin", async () => {
    const { client, calls } = stubClient();
    const res = await callMaritime(client, { area: "Cantábrico" });
    expect(res.isError).toBe(false);
    expect(calls).toEqual({ coastal: ["41"], highSeas: [] });
    expect(res.text).toContain("Asturias, Cantabria and the Basque Country");
    expect(res.text).toContain("coastal waters bulletin (area 41, FQXX41)");
    expect(res.text).toContain("Issued: 2026-09-12T12:00:00");
    expect(res.text).toContain("Valid: 2026-09-12T12:00:00 to 2026-09-13T12:00:00");
    expect(res.text).toContain("Warnings: Viento de Levante fuerza 7, al oeste de Tarifa");
    expect(res.text).toContain("Situation: Anticiclón en el Cantábrico 1026");
    expect(res.text).toContain("Aguas costeras de Asturias");
    expect(res.text).toContain("E 4 o 5. Marejada.");
    expect(res.text).toContain(
      "Trend (2026-09-13T12:00:00 to 2026-09-14T12:00:00): No se esperan condiciones de aviso",
    );
  });

  it("names the subzones only when they differ from the zone", async () => {
    const { client } = stubClient();
    const res = await callMaritime(client, { area: "41" });
    expect(res.text).not.toContain("Aguas costeras de Asturias: E 4 o 5");
    expect(res.text).toContain("Norte de Cantabria: NE 4 o 5. Marejadilla.");
    expect(res.text).toContain("Sur de Cantabria: E 3 o 4. Rizada.");
  });

  it("deduces the coastal area from a coastal province", async () => {
    const { client, calls } = stubClient();
    await callMaritime(client, { area: "Gipuzkoa" });
    await callMaritime(client, { area: "Girona" });
    await callMaritime(client, { area: "Almería" });
    expect(calls.coastal).toEqual(["41", "45", "47"]);
  });

  it("accepts accentless and lowercase names", async () => {
    const { client, calls } = stubClient();
    await callMaritime(client, { area: "illes balears" });
    await callMaritime(client, { area: "canarias" });
    expect(calls.coastal).toEqual(["44", "43"]);
  });

  it("reads high seas areas by name and by code", async () => {
    const { client, calls } = stubClient();
    await callMaritime(client, { area: "Mediterráneo" });
    await callMaritime(client, { area: "0" });
    expect(calls.highSeas).toEqual(["2", "0"]);
    expect(calls.coastal).toEqual([]);
  });

  it("resolves a high seas zone name and brings that zone first", async () => {
    const { client, calls } = stubClient();
    const res = await callMaritime(client, { area: "Cantábrico", product: "high_seas" });
    expect(calls.highSeas).toEqual(["1"]);
    expect(res.text).toContain("Matched zone: Cantábrico");
    const cantabrico = res.text.indexOf("    Cantábrico");
    const granSol = res.text.indexOf("    Gran Sol");
    expect(cantabrico).toBeGreaterThan(-1);
    expect(cantabrico).toBeLessThan(granSol);
  });

  it("routes an open sea zone name to its high seas bulletin without a product hint", async () => {
    const { client, calls } = stubClient();
    const res = await callMaritime(client, { area: "Gran Sol" });
    expect(calls.highSeas).toEqual(["1"]);
    expect(res.text).toContain("Matched zone: Gran Sol");
  });

  it("says so when the bulletin carries no warnings section", async () => {
    const { client } = stubClient();
    const res = await callMaritime(client, { area: "Mediterráneo" });
    expect(res.text).toContain("Warnings: not issued with this bulletin");
  });

  it("lists both candidates when a region spans two bulletins", async () => {
    const { client, calls } = stubClient();
    const res = await callMaritime(client, { area: "Andalucía" });
    expect(res.isError).toBe(true);
    expect(calls.coastal).toEqual([]);
    expect(res.text).toContain("matches 2 AEMET maritime areas");
    expect(res.text).toContain("42");
    expect(res.text).toContain("47");
  });

  it("rejects a code the product does not have", async () => {
    const { client, calls } = stubClient();
    const res = await callMaritime(client, { area: "41", product: "high_seas" });
    expect(res.isError).toBe(true);
    expect(calls.highSeas).toEqual([]);
    expect(res.text).toMatch(/No AEMET maritime area with code/i);
  });

  it("rejects a sea that is not in the AEMET products", async () => {
    const { client } = stubClient();
    const res = await callMaritime(client, { area: "Mar Negro" });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/No AEMET maritime area matches/i);
    expect(res.text).toContain("Galicia (40)");
  });

  it("reports an empty AEMET response", async () => {
    const { client } = stubClient(() => []);
    const res = await callMaritime(client, { area: "Galicia" });
    expect(res.isError).toBe(true);
    expect(res.text).toContain("no maritime bulletin");
  });
});
