import { describe, expect, it } from "vitest";
import { E2E_ENABLED, liveClient } from "./_setup.js";

describe.skipIf(!E2E_ENABLED)("e2e: warnings", () => {
  it("returns a parsed CAP archive for the national area", async () => {
    const client = liveClient();
    const docs = await client.warnings.latest("esp");
    expect(Array.isArray(docs)).toBe(true);
    if (docs.length === 0) return;
    const sample = docs[0]!;
    expect(sample.filename.toLowerCase()).toContain(".xml");
    expect(sample.alert.identifier.length).toBeGreaterThan(0);
    expect(["Actual", "Exercise", "System", "Test", "Draft"]).toContain(sample.alert.status);
    expect(sample.alert.info.length).toBeGreaterThan(0);
  });
});
