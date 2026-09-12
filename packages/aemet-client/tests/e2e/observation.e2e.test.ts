import { describe, expect, it } from "vitest";
import { E2E_ENABLED, live } from "./_setup.js";

describe.skipIf(!E2E_ENABLED)("e2e: observation", () => {
  it("returns a non-empty list of stations", async (ctx) => {
    const data = await live(ctx, (client) => client.observation.allStations());
    expect(data.length).toBeGreaterThan(100);
    const sample = data[0]!;
    expect(typeof sample.idema).toBe("string");
    expect(typeof sample.lat).toBe("number");
    expect(typeof sample.lon).toBe("number");
    expect(typeof sample.fint).toBe("string");
  });

  it("returns 24h history for a specific station", async (ctx) => {
    const data = await live(ctx, (client) => client.observation.station("3195"));
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]!.idema).toBe("3195");
  });
});
