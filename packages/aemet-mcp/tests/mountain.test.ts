import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AemetNotFoundError, MOUNTAIN_AREAS, type AemetClient } from "aemet-client";
import type { MountainBulletin } from "aemet-client";
import { registerMountainTool } from "../src/tools/mountain.js";
import {
  MOUNTAIN_AREA_NAMES,
  resolveMountainArea,
  type MountainAreaKey,
} from "../src/data/mountain-areas.js";

const origen = {
  productor: "Agencia Estatal de Meteorología - AEMET - Gobierno de España",
  web: "http://www.aemet.es",
  tipo: "Predicción de montaña",
  language: "es",
  copyright: "© AEMET",
  notaLegal: "http://www.aemet.es/es/nota_legal",
};

const forecastPayload: MountainBulletin[] = [
  {
    origen,
    id: "peu1",
    nombre: "Predicción",
    seccion: [
      {
        nombre: "prediccion",
        apartado: [
          {
            cabecera: "Estado del cielo",
            texto: "Poco nuboso o despejado, con bancos de nubes bajas a primeras horas.",
            nombre: "nubosidad",
          },
          { cabecera: "Precipitaciones", texto: "No se esperan.", nombre: "pcp" },
          { cabecera: "Tormentas", texto: "", nombre: "tormentas" },
          {
            cabecera: "Viento",
            texto: "Flojo de dirección variable, moderado del norte en cotas altas.",
            nombre: "viento",
          },
        ],
        parrafo: [],
        lugar: [],
      },
      {
        nombre: "atmosferalibre",
        apartado: [
          {
            cabecera: "Altitud de la isoterma de 0 ºC en la atmósfera libre",
            texto: "4900 m",
            nombre: "isocero",
          },
          {
            cabecera: "Viento en atmósfera libre a 3000 metros",
            texto: "NE 20 km/h",
            nombre: "v3000",
          },
        ],
        parrafo: [],
        lugar: [],
      },
      {
        nombre: "sensacion_termica",
        apartado: [],
        parrafo: [],
        lugar: [
          {
            minima: 12,
            stminima: 12,
            maxima: 16,
            stmaxima: 16,
            nombre: "Vega de Urriellu",
            altitud: "1970 m",
          },
          {
            minima: 3,
            stminima: -2,
            maxima: 9,
            stmaxima: 6,
            nombre: "Cabaña Verónica",
            altitud: "2239 m",
          },
        ],
      },
    ],
  },
];

const pastPayload: MountainBulletin[] = [
  {
    origen,
    id: "peu1",
    nombre: "Tiempo pasado",
    seccion: [
      {
        nombre: "tiempo_pasado",
        apartado: [],
        lugar: [],
        parrafo: [
          {
            texto:
              "(En las 24 horas previas a las 10:00 hora oficial del 11 de septiembre de 2026)",
            numero: "1",
          },
          { texto: "", numero: "2" },
          { texto: "", numero: "3" },
          { texto: "Intervalos nubosos, con nubosidad media y alta.", numero: "4" },
          { texto: "", numero: "5" },
          { texto: "TEMPERATURAS MÍNIMAS:", numero: "6" },
          { texto: "7 ºC en Cabaña Verónica (2239 m), 9 ºC en Fuente Dé (1090 m).", numero: "7" },
          { texto: "", numero: "8" },
        ],
      },
    ],
  },
];

interface Stub {
  client: AemetClient;
  forecastCalls: Array<[string, number]>;
  pastCalls: string[];
}

function stubClient(
  overrides: Partial<{ forecast: () => MountainBulletin[]; past: () => MountainBulletin[] }> = {},
): Stub {
  const forecastCalls: Array<[string, number]> = [];
  const pastCalls: string[] = [];
  const client = {
    mountain: {
      forecast: vi.fn(async (area: string, day: number) => {
        forecastCalls.push([area, day]);
        return overrides.forecast?.() ?? forecastPayload;
      }),
      past: vi.fn(async (area: string) => {
        pastCalls.push(area);
        return overrides.past?.() ?? pastPayload;
      }),
    },
  } as unknown as AemetClient;
  return { client, forecastCalls, pastCalls };
}

async function connect(client: AemetClient) {
  const server = new McpServer(
    { name: "test-server", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );
  registerMountainTool(server, client);
  const mcp = new Client({ name: "test-client", version: "0.0.0" }, { capabilities: {} });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return mcp;
}

async function callMountain(
  client: AemetClient,
  args: Record<string, unknown>,
): Promise<{ isError: boolean; text: string }> {
  const mcp = await connect(client);
  const res = await mcp.callTool({ name: "get_mountain_forecast", arguments: args });
  const content = res.content as Array<{ type: string; text: string }>;
  return { isError: res.isError === true, text: content[0]?.text ?? "" };
}

describe("mountain area catalogue", () => {
  it("names every area the SDK exposes", () => {
    const keys = Object.keys(MOUNTAIN_AREAS) as MountainAreaKey[];
    expect(keys).toHaveLength(9);
    for (const key of keys) {
      expect(MOUNTAIN_AREA_NAMES[key]).toBeTruthy();
    }
  });

  it("resolves every area by its AEMET code and by its official name", () => {
    for (const [key, code] of Object.entries(MOUNTAIN_AREAS) as Array<[MountainAreaKey, string]>) {
      expect(resolveMountainArea(code)).toEqual({ code, key, name: MOUNTAIN_AREA_NAMES[key] });
      expect(resolveMountainArea(MOUNTAIN_AREA_NAMES[key]).code).toBe(code);
    }
  });

  it("resolves the names people actually type", () => {
    const cases: Array<[string, string]> = [
      ["Picos de Europa", "peu1"],
      ["picos", "peu1"],
      ["Pirineo Navarro", "nav1"],
      ["pirineos navarros", "nav1"],
      ["Pirineo Aragones", "arn1"],
      ["pirineo aragonés", "arn1"],
      ["Pirineo Catalán", "cat1"],
      ["pirineu catala", "cat1"],
      ["Ibérica", "rio1"],
      ["Urbión", "rio1"],
      ["Moncayo", "arn2"],
      ["Ibérica Aragonesa", "arn2"],
      ["Sierra de Madrid", "mad2"],
      ["guadarrama", "mad2"],
      ["Somosierra", "mad2"],
      ["Gredos", "gre1"],
      ["Sierra de Béjar", "gre1"],
      ["Sierra Nevada", "nev1"],
      ["peñibética", "nev1"],
      ["NEV1", "nev1"],
    ];
    for (const [input, code] of cases) {
      expect(resolveMountainArea(input).code, input).toBe(code);
    }
  });
});

describe("get_mountain_forecast", () => {
  it("registers the tool with a description and an input schema", async () => {
    const mcp = await connect(stubClient().client);
    const list = await mcp.listTools();
    const tool = list.tools.find((t) => t.name === "get_mountain_forecast");
    expect(tool).toBeDefined();
    expect(tool?.description).toBeTruthy();
    expect(tool?.inputSchema).toBeDefined();
  });

  it("defaults to the forecast for today", async () => {
    const stub = stubClient();
    const res = await callMountain(stub.client, { area: "Picos de Europa" });
    expect(res.isError).toBe(false);
    expect(stub.forecastCalls).toEqual([["peu1", 0]]);
    expect(stub.pastCalls).toEqual([]);
    expect(res.text).toContain("Picos de Europa (peu1) — AEMET mountain bulletin, day 0 (today)");
  });

  it("presents each section under its own heading, not as JSON", async () => {
    const res = await callMountain(stubClient().client, { area: "peu1" });
    expect(res.text).toContain("  Forecast");
    expect(res.text).toContain(
      "    Estado del cielo: Poco nuboso o despejado, con bancos de nubes bajas a primeras horas.",
    );
    expect(res.text).toContain("    Precipitaciones: No se esperan.");
    expect(res.text).toContain("  Free atmosphere");
    expect(res.text).toContain("    Altitud de la isoterma de 0 ºC en la atmósfera libre: 4900 m");
    expect(res.text).not.toContain("{");
    expect(res.text).not.toContain("nubosidad");
  });

  it("drops headings AEMET left empty", async () => {
    const res = await callMountain(stubClient().client, { area: "peu1" });
    expect(res.text).not.toContain("Tormentas");
  });

  it("lists per-location temperatures, adding thermal sensation only when it differs", async () => {
    const res = await callMountain(stubClient().client, { area: "peu1" });
    expect(res.text).toContain("  Temperature and thermal sensation by location");
    expect(res.text).toContain("    Vega de Urriellu (1970 m): 12 to 16 °C");
    expect(res.text).not.toContain("Vega de Urriellu (1970 m): 12 to 16 °C, feels like");
    expect(res.text).toContain("    Cabaña Verónica (2239 m): 3 to 9 °C, feels like -2 to 6 °C");
  });

  it("passes the requested day through and labels it", async () => {
    const stub = stubClient();
    const res = await callMountain(stub.client, { area: "nev1", day: 3 });
    expect(stub.forecastCalls).toEqual([["nev1", 3]]);
    expect(res.text).toContain("Sierra Nevada (nev1) — AEMET mountain bulletin, day 3 (in 3 days)");
  });

  it("rejects a day AEMET does not serve", async () => {
    const stub = stubClient();
    const res = await callMountain(stub.client, { area: "nev1", day: 4 });
    expect(res.isError).toBe(true);
    expect(res.text).toContain("expected one of 0|1|2|3");
    expect(stub.forecastCalls).toEqual([]);
  });

  it("returns the past-weather bulletin as paragraphs", async () => {
    const stub = stubClient();
    const res = await callMountain(stub.client, { area: "peu1", mode: "past" });
    expect(res.isError).toBe(false);
    expect(stub.pastCalls).toEqual(["peu1"]);
    expect(stub.forecastCalls).toEqual([]);
    expect(res.text).toContain("Picos de Europa (peu1) — AEMET mountain bulletin, last 24 hours");
    expect(res.text).toContain("  Observed weather");
    expect(res.text).toContain("    (En las 24 horas previas a las 10:00");
    expect(res.text).toContain("    TEMPERATURAS MÍNIMAS:");
    expect(res.text).toContain("    7 ºC en Cabaña Verónica (2239 m), 9 ºC en Fuente Dé (1090 m).");
  });

  it("collapses AEMET's runs of empty paragraphs and trims the trailing one", async () => {
    const res = await callMountain(stubClient().client, { area: "peu1", mode: "past" });
    expect(res.text).not.toContain("\n\n\n");
    expect(res.text.endsWith("\n")).toBe(false);
    expect(res.text).toContain(
      "hora oficial del 11 de septiembre de 2026)\n\n    Intervalos nubosos",
    );
  });

  it("ignores the day when reading the past bulletin", async () => {
    const stub = stubClient();
    const res = await callMountain(stub.client, { area: "peu1", mode: "past", day: 2 });
    expect(stub.pastCalls).toEqual(["peu1"]);
    expect(res.text).toContain("last 24 hours");
  });

  it("lists the nine areas when the name is unknown", async () => {
    const res = await callMountain(stubClient().client, { area: "Alpes" });
    expect(res.isError).toBe(true);
    expect(res.text).toContain('Unknown mountain area "Alpes"');
    expect(res.text).toContain("nine mountain areas");
    expect(res.text).toContain("Sierra Nevada (nev1)");
  });

  it("rejects a code AEMET does not publish", async () => {
    const res = await callMountain(stubClient().client, { area: "xyz9" });
    expect(res.isError).toBe(true);
    expect(res.text).toContain('No mountain area with code "xyz9"');
  });

  it("reports an empty AEMET response", async () => {
    const res = await callMountain(stubClient({ forecast: () => [] }).client, { area: "peu1" });
    expect(res.isError).toBe(true);
    expect(res.text).toContain("no mountain bulletin for Picos de Europa (peu1)");
  });

  it("explains a 404 from AEMET instead of throwing", async () => {
    const stub = stubClient({
      forecast: () => {
        throw new AemetNotFoundError({
          endpoint: "/prediccion/especifica/montaña/pasada/area/peu1/dia/3",
          status: 404,
        });
      },
    });
    const res = await callMountain(stub.client, { area: "peu1", day: 3 });
    expect(res.isError).toBe(true);
    expect(res.text).toContain("not publishing that mountain bulletin for Picos de Europa");
  });
});
