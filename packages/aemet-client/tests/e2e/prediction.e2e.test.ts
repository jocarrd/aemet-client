import { describe, expect, it } from "vitest";
import { E2E_ENABLED, liveClient } from "./_setup.js";

describe.skipIf(!E2E_ENABLED)("e2e: prediction", () => {
  it("returns a daily municipal forecast for Madrid", async () => {
    const client = liveClient();
    const data = await client.prediction.municipalDaily("28079");
    expect(data.length).toBeGreaterThan(0);
    const first = data[0]!;
    expect(first.id).toBe("28079");
    expect(first.nombre.length).toBeGreaterThan(0);
    expect(first.prediccion.dia.length).toBeGreaterThan(0);
    const day = first.prediccion.dia[0]!;
    expect(typeof day.fecha).toBe("string");
    expect(typeof day.temperatura.maxima).toBe("number");
    expect(typeof day.temperatura.minima).toBe("number");
  });

  it("returns an hourly municipal forecast", async () => {
    const client = liveClient();
    const data = await client.prediction.municipalHourly("28079");
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]!.id).toBe("28079");
    expect(data[0]!.prediccion.dia.length).toBeGreaterThan(0);
  });
});
