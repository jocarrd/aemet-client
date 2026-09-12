import { describe, expect, it } from "vitest";
import { E2E_ENABLED, live } from "./_setup.js";

describe.skipIf(!E2E_ENABLED)("e2e: radar", () => {
  it("returns a URL for the national radar GIF", async (ctx) => {
    const result = await live(ctx, (client) => client.radar.nationalUrl());
    expect(result.url).toMatch(/^https?:\/\//);
  });
});
