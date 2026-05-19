import { afterEach, describe, expect, it } from "vitest";
import { AemetClient } from "../src/client.js";
import { AemetError } from "../src/errors.js";

describe("AemetClient", () => {
  const originalEnv = process.env.AEMET_API_KEY;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.AEMET_API_KEY;
    } else {
      process.env.AEMET_API_KEY = originalEnv;
    }
  });

  it("uses an explicit apiKey", () => {
    const c = new AemetClient({ apiKey: "explicit" });
    expect(c.transport).toBeDefined();
  });

  it("falls back to AEMET_API_KEY env", () => {
    process.env.AEMET_API_KEY = "from-env";
    const c = new AemetClient();
    expect(c.transport).toBeDefined();
  });

  it("throws when no key is provided", () => {
    delete process.env.AEMET_API_KEY;
    expect(() => new AemetClient()).toThrow(AemetError);
  });
});
