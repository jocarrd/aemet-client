import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { AemetClient, MountainForecast } from "aemet-client";
import { ResolutionError } from "../src/resolve.js";
import { MOUNTAIN_AREA_NAMES, resolveMountainArea } from "../src/data/mountain-areas.js";
import { registerMountainTool } from "../src/tools/mountain.js";

const doc: MountainForecast = {
  nombre: "Sistema Central - Sierra de Madrid",
  id: "5",
  elaborado: "2026-05-17T08:00:00",
  origen: {
    productor: "AEMET",
    web: "https://www.aemet.es",
    enlace: "https://x",
    language: "es",
    copyright: "AEMET",
    notaLegal: "x",
  },
  prediccion: {
    dia: [
      {
        fecha: "2026-05-17",
        estadoCielo: [{ value: "12", descripcion: "Poco nuboso", periodo: "00-24" }],
        precipitacion: [{ value: "0", periodo: "00-24" }],
        cotaNieve: [{ value: "2400", periodo: "00-24" }],
        isoCero: [{ value: "3100", periodo: "00-24" }],
        vientoSuperficie: [{ periodo: "00-24", direccion: "NW", velocidad: "20" }],
        viento3000m: [{ periodo: "00-24", direccion: "W", velocidad: "45" }],
        temperatura: [
          { altitud: "1000", value: "14" },
          { altitud: "2500", value: "-1" },
        ],
      },
      {
        fecha: "2026-05-18",
        estadoCielo: [{ value: "14", descripcion: "Nuboso", periodo: "00-24" }],
        precipitacion: [{ value: "5", periodo: "00-24" }],
      },
    ],
  },
};

function stubClient(
  overrides: Partial<{
    forecast: () => MountainForecast[];
    past: () => MountainForecast[];
  }> = {},
): AemetClient {
  return {
    mountain: {
      forecast: vi.fn(async () => overrides.forecast?.() ?? [doc]),
      past: vi.fn(async () => overrides.past?.() ?? [doc]),
    },
  } as unknown as AemetClient;
}

async function connect(client: AemetClient) {
  const server = new McpServer({ name: "test", version: "0.0.0" }, { capabilities: { tools: {} } });
  registerMountainTool(server, client);
  const mcp = new Client({ name: "test-client", version: "0.0.0" }, { capabilities: {} });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return mcp;
}

function textOf(res: Awaited<ReturnType<Client["callTool"]>>): string {
  const content = res.content as Array<{ type: string; text: string }>;
  return content[0]?.text ?? "";
}

describe("resolveMountainArea", () => {
  it("resolves every documented area by its display name", () => {
    for (const [key, name] of Object.entries(MOUNTAIN_AREA_NAMES)) {
      expect(resolveMountainArea(name).key).toBe(key);
    }
  });

  it("resolves by code 1-8", () => {
    expect(resolveMountainArea("1").key).toBe("picosDeEuropa");
    expect(resolveMountainArea("7")).toEqual({
      code: "7",
      key: "sierraNevada",
      name: "Sierra Nevada",
    });
  });

  it("ignores accents, case and punctuation", () => {
    expect(resolveMountainArea("pirineo aragones").key).toBe("pirineoAragones");
    expect(resolveMountainArea("PIRINEO CATALÁN").key).toBe("pirineoCatalan");
    expect(resolveMountainArea("  Picos de Europa  ").key).toBe("picosDeEuropa");
  });

  it("accepts common colloquial names", () => {
    expect(resolveMountainArea("Gredos").key).toBe("bejarGredos");
    expect(resolveMountainArea("Guadarrama").key).toBe("sierraMadrid");
    expect(resolveMountainArea("Moncayo").key).toBe("iberica");
    expect(resolveMountainArea("Pirineu Català").key).toBe("pirineoCatalan");
  });

  it("rejects out-of-range codes, unknown names and empty input", () => {
    expect(() => resolveMountainArea("0")).toThrow(ResolutionError);
    expect(() => resolveMountainArea("9")).toThrow(ResolutionError);
    expect(() => resolveMountainArea("Himalaya")).toThrow(ResolutionError);
    expect(() => resolveMountainArea("   ")).toThrow(ResolutionError);
  });
});

describe("get_mountain_forecast", () => {
  it("registers with a description and an input schema", async () => {
    const mcp = await connect(stubClient());
    const list = await mcp.listTools();
    const tool = list.tools.find((t) => t.name === "get_mountain_forecast");
    expect(tool?.description).toBeTruthy();
    expect(tool?.inputSchema).toBeDefined();
  });

  it("formats snow level, freezing level, winds and temperature by altitude", async () => {
    const mcp = await connect(stubClient());
    const res = await mcp.callTool({
      name: "get_mountain_forecast",
      arguments: { area: "Sierra de Madrid" },
    });
    expect(res.isError).toBeFalsy();
    const text = textOf(res);
    expect(text).toContain("Sistema Central - Sierra de Madrid");
    expect(text).toContain("Sky: Poco nuboso");
    expect(text).toContain("Snow level: 2400 m");
    expect(text).toContain("Freezing level (0°C): 3100 m");
    expect(text).toContain("1000 m 14° / 2500 m -1°");
    expect(text).toContain("surface NW 20 km/h; 3000 m W 45 km/h");
  });

  it("passes the resolved code and period to the SDK", async () => {
    const client = stubClient();
    const mcp = await connect(client);
    await mcp.callTool({
      name: "get_mountain_forecast",
      arguments: { area: "Sierra Nevada", period: 1 },
    });
    expect(client.mountain.forecast).toHaveBeenCalledWith("7", 1);
  });

  it("uses the past endpoint when mode='past'", async () => {
    const client = stubClient();
    const mcp = await connect(client);
    await mcp.callTool({
      name: "get_mountain_forecast",
      arguments: { area: "2", mode: "past", period: 1 },
    });
    expect(client.mountain.past).toHaveBeenCalledWith("2", 1);
    expect(client.mountain.forecast).not.toHaveBeenCalled();
  });

  it("honours the days limit", async () => {
    const mcp = await connect(stubClient());
    const res = await mcp.callTool({
      name: "get_mountain_forecast",
      arguments: { area: "Picos de Europa", days: 1 },
    });
    const text = textOf(res);
    expect(text).toContain("2026-05-17");
    expect(text).not.toContain("2026-05-18");
  });

  it("omits fields AEMET did not publish", async () => {
    const mcp = await connect(stubClient());
    const res = await mcp.callTool({
      name: "get_mountain_forecast",
      arguments: { area: "1", days: 7 },
    });
    const text = textOf(res);
    const secondDay = text.slice(text.indexOf("2026-05-18"));
    expect(secondDay).toContain("Sky: Nuboso");
    expect(secondDay).not.toContain("Snow level");
    expect(secondDay).not.toContain("Wind:");
  });

  it("surfaces unknown areas as tool errors", async () => {
    const mcp = await connect(stubClient());
    const res = await mcp.callTool({
      name: "get_mountain_forecast",
      arguments: { area: "Himalaya" },
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toMatch(/Unknown mountain area/i);
  });

  it("reports when AEMET returns no document", async () => {
    const mcp = await connect(stubClient({ forecast: () => [] }));
    const res = await mcp.callTool({
      name: "get_mountain_forecast",
      arguments: { area: "Sierra Nevada" },
    });
    expect(res.isError).toBe(true);
    expect(textOf(res)).toContain("no mountain data");
  });
});
