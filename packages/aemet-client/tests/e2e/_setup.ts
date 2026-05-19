import { AemetClient } from "../../src/client.js";

const apiKey = process.env.AEMET_API_KEY;

export const E2E_ENABLED = !!apiKey;

export function liveClient(): AemetClient {
  if (!apiKey) {
    throw new Error("AEMET_API_KEY is required for E2E tests.");
  }
  return new AemetClient({ apiKey, timeoutMs: 20_000 });
}
