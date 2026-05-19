import { describe, expect, it } from "vitest";
import { E2E_ENABLED, liveClient } from "./_setup.js";

describe.skipIf(!E2E_ENABLED)("e2e: climatology", () => {
  it("returns daily values for a recent month", async () => {
    const client = liveClient();
    const now = new Date();
    const from = new Date(now);
    from.setUTCMonth(from.getUTCMonth() - 2);
    from.setUTCDate(1);
    const to = new Date(from);
    to.setUTCDate(28);
    const data = await client.climatology.daily("3195", from, to);
    expect(Array.isArray(data)).toBe(true);
    if (data.length === 0) return;
    expect(typeof data[0]!.fecha).toBe("string");
    expect(data[0]!.indicativo).toBe("3195");
  });

  it("returns the station inventory", async () => {
    const client = liveClient();
    const data = await client.climatology.stationInventory();
    expect(data.length).toBeGreaterThan(500);
    expect(data[0]!.indicativo.length).toBeGreaterThan(0);
  });
});
