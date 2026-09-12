import type { TestContext } from "vitest";
import { AemetClient } from "../../src/client.js";
import {
  AemetNetworkError,
  AemetNotFoundError,
  AemetRateLimitError,
  AemetServerError,
} from "../../src/errors.js";

const apiKey = process.env.AEMET_API_KEY;

export const E2E_ENABLED = !!apiKey;

export function liveClient(): AemetClient {
  if (!apiKey) {
    throw new Error("AEMET_API_KEY is required for E2E tests.");
  }
  return new AemetClient({ apiKey, timeoutMs: 20_000 });
}

const NO_DATA = /error al obtener los datos|no hay datos que satisfagan/i;

export function isUpstreamOutage(err: unknown): boolean {
  if (
    err instanceof AemetServerError ||
    err instanceof AemetNetworkError ||
    err instanceof AemetRateLimitError
  ) {
    return true;
  }
  return err instanceof AemetNotFoundError && NO_DATA.test(err.description ?? "");
}

export async function live<T>(
  ctx: TestContext,
  run: (client: AemetClient) => Promise<T>,
): Promise<T> {
  try {
    return await run(liveClient());
  } catch (err) {
    if (isUpstreamOutage(err)) {
      const { endpoint, description } = err as { endpoint?: string; description?: string };
      ctx.skip(`AEMET is not serving ${endpoint ?? "this endpoint"} right now: ${description}`);
    }
    throw err;
  }
}
