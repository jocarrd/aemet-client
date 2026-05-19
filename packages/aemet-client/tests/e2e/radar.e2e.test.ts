import { describe, expect, it } from "vitest";
import { E2E_ENABLED, liveClient } from "./_setup.js";

describe.skipIf(!E2E_ENABLED)("e2e: radar", () => {
  it("returns a URL for the national radar GIF", async () => {
    const client = liveClient();
    const result = await client.radar.nationalUrl();
    expect(result.url).toMatch(/^https?:\/\//);
  });
});
