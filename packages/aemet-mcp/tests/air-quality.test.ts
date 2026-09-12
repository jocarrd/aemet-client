import { describe, expect, it, vi } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { AemetClient } from "aemet-client";
import { registerAirQualityTool } from "../src/tools/air-quality.js";
import { POLLUTION_STATION_TABLE } from "../src/data/pollution-stations.js";

const payload = [
  {
    station: "09",
    timestamp: "2026-09-12T00:50:00",
    readings: [
      { parameter: "O3", code: "014", value: 54.78, unit: "ug/m3", validity: "V", factor: 1.99 },
      { parameter: "TEM", code: "083", value: 10.6, unit: "GC", validity: "V", factor: 1 },
    ],
  },
  {
    station: "09",
    timestamp: "2026-09-12T01:00:00",
    readings: [
      { parameter: "TEM", code: "083", value: 9.29, unit: "GC", validity: "V", factor: 1 },
      { parameter: "O3", code: "014", value: 47.1, unit: "ug/m3", validity: "V", factor: 1.99 },
      { parameter: "SO2", code: "001", value: 1.413, unit: "ug/m3", validity: "V", factor: 2.66 },
      { parameter: "PM10", code: "010", value: 0, unit: "ug/m3", validity: "N", factor: 1 },
      { parameter: "DIR", code: "082", value: 154, unit: "GRA", validity: "V", factor: 1 },
      { parameter: "RAD", code: "088", value: 0, unit: "W/m2", validity: "M", factor: 1 },
    ],
  },
];

function stubClient(measurements: () => unknown = () => payload): {
  client: AemetClient;
  calls: string[];
} {
  const calls: string[] = [];
  const client = {
    airQuality: {
      backgroundPollution: vi.fn(async (code: string) => {
        calls.push(code);
        return measurements();
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
  registerAirQualityTool(server, client);
  const mcp = new Client({ name: "test-client", version: "0.0.0" }, { capabilities: {} });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return mcp;
}

async function callAirQuality(
  client: AemetClient,
  args: Record<string, unknown>,
): Promise<{ isError: boolean; text: string }> {
  const mcp = await connect(client);
  const res = await mcp.callTool({ name: "get_air_quality", arguments: args });
  const content = res.content as Array<{ type: string; text: string }>;
  return { isError: res.isError === true, text: content[0]?.text ?? "" };
}

describe("background pollution station table", () => {
  it("holds the AEMET background network: 2-digit codes, no duplicates", () => {
    expect(POLLUTION_STATION_TABLE.length).toBe(13);
    expect(new Set(POLLUTION_STATION_TABLE.map((s) => s.code)).size).toBe(
      POLLUTION_STATION_TABLE.length,
    );
    for (const station of POLLUTION_STATION_TABLE) {
      expect(station.code).toMatch(/^\d{2}$/);
      expect(station.name).not.toBe("");
      expect(station.province).not.toBe("");
    }
  });

  it("places every station inside the Spanish bounding box", () => {
    for (const station of POLLUTION_STATION_TABLE) {
      expect(station.lat).toBeGreaterThan(27);
      expect(station.lat).toBeLessThan(44);
      expect(station.lon).toBeGreaterThan(-19);
      expect(station.lon).toBeLessThan(5);
    }
  });
});

describe("get_air_quality", () => {
  it("registers the tool and warns that this is background, not urban, pollution", async () => {
    const { client } = stubClient();
    const mcp = await connect(client);
    const list = await mcp.listTools();
    const tool = list.tools.find((t) => t.name === "get_air_quality");
    expect(tool).toBeDefined();
    expect(tool?.inputSchema).toBeDefined();
    expect(tool?.description).toContain("BACKGROUND");
    expect(tool?.description).toMatch(/not.*urban/i);
  });

  it("formats the latest measurement with labels and units", async () => {
    const { client, calls } = stubClient();
    const res = await callAirQuality(client, { station: "Campisábalos" });
    expect(res.isError).toBe(false);
    expect(calls).toEqual(["09"]);
    expect(res.text).toContain(
      "Campisábalos (Guadalajara) — AEMET background pollution station 09",
    );
    expect(res.text).toContain("Measured at 2026-09-12T01:00:00 UTC");
    expect(res.text).toContain("O3 (ozone): 47.1 µg/m³");
    expect(res.text).toContain("SO2 (sulphur dioxide): 1.41 µg/m³");
    expect(res.text).toContain("Temperature: 9.29 °C");
    expect(res.text).toContain("Wind direction: 154 °");
    expect(res.text).toContain("File carries 2 ten-minute samples");
  });

  it("puts the pollutants before the meteorology", async () => {
    const { client } = stubClient();
    const res = await callAirQuality(client, { station: "09" });
    expect(res.text.indexOf("O3 (ozone)")).toBeLessThan(res.text.indexOf("Temperature"));
  });

  it("flags readings AEMET did not validate", async () => {
    const { client } = stubClient();
    const res = await callAirQuality(client, { station: "09" });
    expect(res.text).toContain("PM10 (particles under 10 µm): 0 µg/m³ — flagged N");
    expect(res.text).toContain("flagged M (disturbed by maintenance)");
    expect(res.text).toContain("do not report this value");
    expect(res.text).not.toContain("O3 (ozone): 47.1 µg/m³ — flagged");
  });

  it("accepts the station code with and without its leading zero", async () => {
    const { client, calls } = stubClient();
    await callAirQuality(client, { station: "09" });
    await callAirQuality(client, { station: "9" });
    expect(calls).toEqual(["09", "09"]);
  });

  it("accepts station names without accents and by alias", async () => {
    const { client, calls } = stubClient();
    await callAirQuality(client, { station: "donana" });
    await callAirQuality(client, { station: "Llanes" });
    await callAirQuality(client, { station: "o savinao" });
    expect(calls).toEqual(["17", "08", "16"]);
  });

  it("resolves the nearest background station from a municipality", async () => {
    const { client, calls } = stubClient();
    const res = await callAirQuality(client, { location: "Madrid" });
    expect(calls).toEqual(["09"]);
    expect(res.text).toContain("Nearest background station to Madrid: 106 km away.");
  });

  it("resolves the nearest background station from coordinates", async () => {
    const { client, calls } = stubClient();
    const res = await callAirQuality(client, { location: "37.39,-5.99" });
    expect(calls).toEqual(["17"]);
    expect(res.text).toMatch(/Nearest background station to 37\.39,-5\.99: \d+ km away\./);
  });

  it("prefers the station over the location when both are given", async () => {
    const { client, calls } = stubClient();
    await callAirQuality(client, { station: "Zarra", location: "Madrid" });
    expect(calls).toEqual(["12"]);
  });

  it("asks for a station or a location when given neither", async () => {
    const { client, calls } = stubClient();
    const res = await callAirQuality(client, {});
    expect(res.isError).toBe(true);
    expect(calls).toEqual([]);
    expect(res.text).toContain("No station or location given");
    expect(res.text).toContain("Campisábalos (09)");
  });

  it("rejects a station that is not in the background network", async () => {
    const { client, calls } = stubClient();
    const res = await callAirQuality(client, { station: "Gran Vía" });
    expect(res.isError).toBe(true);
    expect(calls).toEqual([]);
    expect(res.text).toMatch(/No AEMET background station matches/i);
  });

  it("rejects an unknown 2-digit code", async () => {
    const { client } = stubClient();
    const res = await callAirQuality(client, { station: "99" });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/No AEMET background station with code/i);
  });

  it("reports an empty AEMET response", async () => {
    const { client } = stubClient(() => []);
    const res = await callAirQuality(client, { station: "09" });
    expect(res.isError).toBe(true);
    expect(res.text).toContain("no background pollution data");
  });
});
