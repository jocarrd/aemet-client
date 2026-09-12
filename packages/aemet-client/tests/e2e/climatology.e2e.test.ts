import { describe, expect, it } from "vitest";
import { E2E_ENABLED, live } from "./_setup.js";

describe.skipIf(!E2E_ENABLED)("e2e: climatology", () => {
  it("returns daily values for a recent month", async (ctx) => {
    const now = new Date();
    const from = new Date(now);
    from.setUTCMonth(from.getUTCMonth() - 2);
    from.setUTCDate(1);
    const to = new Date(from);
    to.setUTCDate(28);
    const data = await live(ctx, (client) => client.climatology.daily("3195", from, to));
    expect(Array.isArray(data)).toBe(true);
    if (data.length === 0) return;
    expect(typeof data[0]!.fecha).toBe("string");
    expect(data[0]!.indicativo).toBe("3195");
  });

  it("returns normals keyed by variable and statistic suffix", async (ctx) => {
    const data = await live(ctx, (client) => client.climatology.normals("3195"));
    expect(data.length).toBe(13);
    const january = data.find((row) => row.mes === "01");
    expect(january).toBeDefined();
    expect(january!.indicativo).toBe("3195");
    for (const field of ["tm_mes_md", "tm_max_md", "tm_min_md", "p_mes_md", "n_llu_md"] as const) {
      expect(typeof january![field]).toBe("string");
    }
    expect(Number(january!.tm_mes_n)).toBeGreaterThan(0);
  });

  it("returns the station inventory", async (ctx) => {
    const data = await live(ctx, (client) => client.climatology.stationInventory());
    expect(data.length).toBeGreaterThan(500);
    expect(data[0]!.indicativo.length).toBeGreaterThan(0);
  });
});
