import { AemetError } from "./errors.js";
import { ObservationResource } from "./resources/observation/index.js";
import { PredictionResource } from "./resources/prediction/index.js";
import { WarningsResource } from "./resources/warnings/index.js";
import { Transport, type FetchLike } from "./transport.js";

export interface AemetClientConfig {
  apiKey?: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  fetch?: FetchLike;
  userAgent?: string;
}

export class AemetClient {
  readonly transport: Transport;
  readonly prediction: PredictionResource;
  readonly observation: ObservationResource;
  readonly warnings: WarningsResource;

  constructor(config: AemetClientConfig = {}) {
    const apiKey = config.apiKey ?? readEnvApiKey();
    if (!apiKey) {
      throw new AemetError(
        "Missing AEMET API key. Pass `apiKey` to the constructor or set AEMET_API_KEY.",
      );
    }
    this.transport = new Transport({
      apiKey,
      ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}),
      ...(config.timeoutMs !== undefined ? { timeoutMs: config.timeoutMs } : {}),
      ...(config.maxRetries !== undefined ? { maxRetries: config.maxRetries } : {}),
      ...(config.retryBaseDelayMs !== undefined
        ? { retryBaseDelayMs: config.retryBaseDelayMs }
        : {}),
      ...(config.fetch !== undefined ? { fetch: config.fetch } : {}),
      ...(config.userAgent !== undefined ? { userAgent: config.userAgent } : {}),
    });
    this.prediction = new PredictionResource(this.transport);
    this.observation = new ObservationResource(this.transport);
    this.warnings = new WarningsResource(this.transport);
  }
}

function readEnvApiKey(): string | undefined {
  if (typeof process === "undefined" || !process.env) return undefined;
  return process.env.AEMET_API_KEY;
}
