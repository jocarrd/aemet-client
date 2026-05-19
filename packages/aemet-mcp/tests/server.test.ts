import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { AemetClient, CapDocument, MunicipalDailyForecast, StationObservation } from "aemet-client";
import { createServer } from "../src/server.js";

function stubClient(overrides: Partial<{
  daily: () => MunicipalDailyForecast[];
  hourly: () => unknown[];
  allStations: () => StationObservation[];
  warnings: () => CapDocument[];
}>): AemetClient {
  return {
    prediction: {
      municipalDaily: vi.fn(async () => overrides.daily?.() ?? []),
      municipalHourly: vi.fn(async () => overrides.hourly?.() ?? []),
    },
    observation: {
      allStations: vi.fn(async () => overrides.allStations?.() ?? []),
      station: vi.fn(async () => []),
    },
    warnings: {
      latest: vi.fn(async () => overrides.warnings?.() ?? []),
    },
  } as unknown as AemetClient;
}

async function connect(client: AemetClient) {
  const { server } = createServer({ client });
  const mcp = new Client(
    { name: "test-client", version: "0.0.0" },
    { capabilities: {} },
  );
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return mcp;
}

describe("createServer", () => {
  it("registers the three documented tools", async () => {
    const mcp = await connect(stubClient({}));
    const list = await mcp.listTools();
    const names = list.tools.map((t) => t.name).sort();
    expect(names).toEqual(["get_forecast", "get_nearest_observation", "get_warnings"]);
    for (const tool of list.tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it("get_forecast returns a formatted daily summary", async () => {
    const fakeDay: MunicipalDailyForecast["prediccion"]["dia"][number] = {
      fecha: "2026-05-19T00:00:00",
      probPrecipitacion: [{ value: "30", periodo: "00-24" }],
      cotaNieveProv: [],
      estadoCielo: [
        { value: "11", periodo: "00-24", descripcion: "Despejado" },
      ],
      viento: [{ periodo: "00-24", direccion: "N", velocidad: "10" }],
      rachaMax: [],
      temperatura: { maxima: 22, minima: 11, dato: [] },
      sensTermica: { maxima: 22, minima: 11, dato: [] },
      humedadRelativa: { maxima: 80, minima: 30, dato: [] },
      uvMax: 6,
    };
    const doc: MunicipalDailyForecast = {
      origen: {
        productor: "AEMET",
        web: "https://www.aemet.es",
        enlace: "x",
        language: "es",
        copyright: "x",
        notaLegal: "x",
      },
      elaborado: "2026-05-19T08:00:00",
      nombre: "Madrid",
      provincia: "Madrid",
      prediccion: { dia: [fakeDay] },
      id: "28079",
      version: "1.0",
    };

    const mcp = await connect(stubClient({ daily: () => [doc] }));
    const res = await mcp.callTool({
      name: "get_forecast",
      arguments: { location: "28079", days: 1 },
    });
    expect(res.isError).toBeFalsy();
    const content = res.content as Array<{ type: string; text: string }>;
    expect(content[0]?.text).toContain("Madrid");
    expect(content[0]?.text).toContain("11° / max 22°");
    expect(content[0]?.text).toContain("Despejado");
  });

  it("get_forecast surfaces resolution errors as tool errors", async () => {
    const mcp = await connect(stubClient({}));
    const res = await mcp.callTool({
      name: "get_forecast",
      arguments: { location: "Atlantis" },
    });
    expect(res.isError).toBe(true);
    const content = res.content as Array<{ type: string; text: string }>;
    expect(content[0]?.text).toMatch(/No municipality matches/i);
  });

  it("get_warnings reports 'no active warnings' when AEMET returns none", async () => {
    const mcp = await connect(stubClient({ warnings: () => [] }));
    const res = await mcp.callTool({
      name: "get_warnings",
      arguments: { area: "La Rioja" },
    });
    expect(res.isError).toBeFalsy();
    const content = res.content as Array<{ type: string; text: string }>;
    expect(content[0]?.text).toContain("No active warnings");
  });

  it("get_nearest_observation reports the closest station with its reading", async () => {
    const stations: StationObservation[] = [
      {
        idema: "3195",
        lon: -3.7038,
        lat: 40.4168,
        alt: 667,
        ubi: "Madrid Retiro",
        fint: "2026-05-19T07:00:00",
        ta: 12.5,
        hr: 70,
        vv: 1.2,
      },
      {
        idema: "9170",
        lon: -2.4459,
        lat: 42.4627,
        alt: 364,
        ubi: "Logroño Agoncillo",
        fint: "2026-05-19T07:00:00",
        ta: 9,
        hr: 80,
        vv: 2,
      },
    ];
    const mcp = await connect(stubClient({ allStations: () => stations }));
    const res = await mcp.callTool({
      name: "get_nearest_observation",
      arguments: { location: "Logroño" },
    });
    expect(res.isError).toBeFalsy();
    const content = res.content as Array<{ type: string; text: string }>;
    expect(content[0]?.text).toContain("Logroño Agoncillo");
    expect(content[0]?.text).toContain("9°C");
  });
});
