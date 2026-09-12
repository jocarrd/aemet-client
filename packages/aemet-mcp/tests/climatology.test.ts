import { describe, expect, it, vi } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type {
  AemetClient,
  ClimatologyDaily,
  ClimatologyNormal,
  StationInventoryEntry,
} from "aemet-client";
import { registerClimatologyTool } from "../src/tools/climatology.js";

const STATIONS: StationInventoryEntry[] = [
  {
    latitud: "402441N",
    provincia: "MADRID",
    altitud: "667",
    indicativo: "3195",
    nombre: "MADRID, RETIRO",
    indsinop: "08222",
    longitud: "034040W",
  },
  {
    latitud: "422708N",
    provincia: "LA RIOJA",
    altitud: "353",
    indicativo: "9170",
    nombre: "LOGROÑO, AEROPUERTO",
    indsinop: "08023",
    longitud: "021952W",
  },
];

function dailyRecord(fecha: string, overrides: Partial<ClimatologyDaily> = {}): ClimatologyDaily {
  return {
    fecha,
    indicativo: "9170",
    nombre: "LOGROÑO, AEROPUERTO",
    provincia: "LA RIOJA",
    altitud: "353",
    tmed: "26,4",
    tmin: "17,8",
    tmax: "34,9",
    prec: "0,0",
    velmedia: "2,2",
    racha: "5,8",
    hrMedia: "52",
    sol: "13,0",
    ...overrides,
  };
}

function stubClient(
  overrides: Partial<{
    inventory: () => StationInventoryEntry[];
    daily: () => ClimatologyDaily[];
    normals: () => ClimatologyNormal[];
  }> = {},
): AemetClient {
  return {
    climatology: {
      stationInventory: vi.fn(async () => overrides.inventory?.() ?? STATIONS),
      daily: vi.fn(async () => overrides.daily?.() ?? []),
      normals: vi.fn(async () => overrides.normals?.() ?? []),
    },
  } as unknown as AemetClient;
}

async function connect(client: AemetClient) {
  const server = new McpServer(
    { name: "test-server", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );
  registerClimatologyTool(server, client);
  const mcp = new Client({ name: "test-client", version: "0.0.0" }, { capabilities: {} });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), mcp.connect(b)]);
  return mcp;
}

async function callTool(client: AemetClient, args: Record<string, unknown>) {
  const mcp = await connect(client);
  const res = await mcp.callTool({ name: "get_climate_history", arguments: args });
  const content = res.content as Array<{ type: string; text: string }>;
  return { isError: res.isError, text: content[0]?.text ?? "" };
}

describe("registerClimatologyTool", () => {
  it("registers get_climate_history with a description and schema", async () => {
    const mcp = await connect(stubClient());
    const list = await mcp.listTools();
    expect(list.tools.map((t) => t.name)).toEqual(["get_climate_history"]);
    expect(list.tools[0]?.description).toBeTruthy();
    expect(list.tools[0]?.inputSchema).toBeDefined();
  });

  it("resolves the nearest station from sexagesimal inventory coordinates", async () => {
    const client = stubClient({ daily: () => [dailyRecord("2026-08-01")] });
    const res = await callTool(client, {
      location: "Logroño",
      from: "2026-08-01",
      to: "2026-08-01",
    });
    expect(res.isError).toBeFalsy();
    expect(res.text).toContain("LOGROÑO, AEROPUERTO (9170)");
    expect(res.text).toContain("LA RIOJA");
    expect(client.climatology.daily).toHaveBeenCalledWith("9170", "2026-08-01", "2026-08-01");
  });

  it("accepts a decimal coordinate pair", async () => {
    const client = stubClient({ daily: () => [dailyRecord("2026-08-01")] });
    const res = await callTool(client, {
      location: "40.4168,-3.7038",
      from: "2026-08-01",
      to: "2026-08-01",
    });
    expect(res.isError).toBeFalsy();
    expect(res.text).toContain("MADRID, RETIRO (3195)");
    expect(client.climatology.daily).toHaveBeenCalledWith("3195", "2026-08-01", "2026-08-01");
  });

  it("lists one line per day for short ranges, with units", async () => {
    const client = stubClient({
      daily: () => [dailyRecord("2026-08-01"), dailyRecord("2026-08-02", { prec: "3,2" })],
    });
    const res = await callTool(client, {
      location: "Logroño",
      from: "2026-08-01",
      to: "2026-08-02",
    });
    expect(res.isError).toBeFalsy();
    expect(res.text).toContain("Daily records 2026-08-01 → 2026-08-02 (2 days)");
    expect(res.text).toContain("max 34.9°C / min 17.8°C / mean 26.4°C");
    expect(res.text).toContain("precip 3.2 mm");
    expect(res.text).toContain("wind 2.2 m/s (gust 5.8 m/s)");
    expect(res.text).toContain("sun 13.0 h");
  });

  it("condenses long ranges into monthly aggregates", async () => {
    const records: ClimatologyDaily[] = [];
    for (let day = 1; day <= 30; day += 1) {
      const d = String(day).padStart(2, "0");
      records.push(dailyRecord(`2025-06-${d}`, { tmax: "30,0", tmin: "10,0", prec: "2,0" }));
    }
    for (let day = 1; day <= 31; day += 1) {
      const d = String(day).padStart(2, "0");
      records.push(dailyRecord(`2025-07-${d}`, { tmax: "40,0", tmin: "20,0", prec: "0,0" }));
    }
    const client = stubClient({ daily: () => records });
    const res = await callTool(client, {
      location: "Logroño",
      from: "2025-06-01",
      to: "2025-07-31",
    });
    expect(res.isError).toBeFalsy();
    expect(res.text).toContain(
      "61 daily records 2025-06-01 → 2025-07-31, condensed to 2 monthly summaries",
    );
    expect(res.text).toContain("2025-06 (30 days)");
    expect(res.text).toContain("mean max 30.0°C");
    expect(res.text).toContain("precip 60.0 mm over 30 rainy days");
    expect(res.text).toContain("2025-07 (31 days)");
    expect(res.text).toContain("Period totals: precip 60.0 mm over 30 rainy days");
    expect(res.text).toContain("highest max 40.0°C");
    expect(res.text).toContain("lowest min 10.0°C");
    expect(res.text.split("\n").length).toBeLessThan(10);
  });

  it("returns monthly normals, labelling month 13 as the annual row", async () => {
    const normals = [
      {
        indicativo: "9170",
        mes: "01",
        tm_mes_md: "6.3",
        tm_max_md: "10.4",
        tm_min_md: "2.2",
        p_mes_md: "35.7",
        n_llu_md: "12.0",
        inso_md: "3.5",
      },
      { indicativo: "9170", mes: "13", tm_mes_md: "14.1", p_mes_md: "405.3" },
    ] as unknown as ClimatologyNormal[];
    const res = await callTool(stubClient({ normals: () => normals }), {
      location: "Logroño",
      mode: "normals",
    });
    expect(res.isError).toBeFalsy();
    expect(res.text).toContain("Climate normals");
    expect(res.text).toContain("Jan   mean 6.3°C   mean max 10.4°C / mean min 2.2°C");
    expect(res.text).toContain("precip 35.7 mm");
    expect(res.text).toContain("rain days 12.0");
    expect(res.text).toContain("sun 3.5 h/day");
    expect(res.text).toContain("Year   mean 14.1°C");
  });

  it("surfaces resolution errors as tool errors", async () => {
    const res = await callTool(stubClient(), { location: "Atlantis", from: "2026-08-01" });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/No municipality matches/i);
  });

  it("asks for a start date when mode='range' has none", async () => {
    const res = await callTool(stubClient(), { location: "Logroño" });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/needs a start date/i);
  });

  it("rejects ranges longer than AEMET's 6-month limit", async () => {
    const res = await callTool(stubClient(), {
      location: "Logroño",
      from: "2024-01-01",
      to: "2024-07-06",
    });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/6 months \(186 days\)/i);
  });

  it("accepts a range exactly at the 186-day limit", async () => {
    const client = stubClient({ daily: () => [dailyRecord("2024-01-01")] });
    const res = await callTool(client, {
      location: "Logroño",
      from: "2024-01-01",
      to: "2024-07-05",
    });
    expect(res.isError).toBeFalsy();
    expect(client.climatology.daily).toHaveBeenCalledWith("9170", "2024-01-01", "2024-07-05");
  });

  it("rejects an end date before the start date", async () => {
    const res = await callTool(stubClient(), {
      location: "Logroño",
      from: "2026-08-10",
      to: "2026-08-01",
    });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/before start date/i);
  });

  it("reports when AEMET has no records for the range", async () => {
    const res = await callTool(stubClient({ daily: () => [] }), {
      location: "Logroño",
      from: "2026-08-01",
      to: "2026-08-02",
    });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/no daily records/i);
  });

  it("reports an empty station inventory", async () => {
    const res = await callTool(stubClient({ inventory: () => [] }), {
      location: "Logroño",
      mode: "normals",
    });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/no climatological station inventory/i);
  });
});
