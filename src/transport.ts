import {
  AemetAuthError,
  AemetError,
  AemetInvalidResponseError,
  AemetNetworkError,
  AemetNotFoundError,
  AemetRateLimitError,
  AemetServerError,
} from "./errors.js";
import { isAemetEnvelope, type AemetEnvelope } from "./types/envelope.js";

export const DEFAULT_BASE_URL = "https://opendata.aemet.es/opendata/api";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_USER_AGENT = "aemet-client";

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface TransportConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  fetch?: FetchLike;
  userAgent?: string;
}

export interface RequestOptions {
  signal?: AbortSignal;
  query?: Record<string, string | number | undefined>;
}

export interface EnvelopeResult<T> {
  data: T;
  metadata?: unknown;
  envelope: AemetEnvelope;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export class Transport {
  readonly #apiKey: string;
  readonly #baseUrl: string;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #retryBaseDelayMs: number;
  readonly #fetch: FetchLike;
  readonly #userAgent: string;

  constructor(config: TransportConfig) {
    if (!config.apiKey) {
      throw new AemetError("apiKey is required to construct the transport.");
    }
    this.#apiKey = config.apiKey;
    this.#baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.#maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.#retryBaseDelayMs = config.retryBaseDelayMs ?? DEFAULT_RETRY_BASE_DELAY_MS;
    this.#fetch = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.#userAgent = config.userAgent ?? DEFAULT_USER_AGENT;
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<EnvelopeResult<T>> {
    const envelope = await this.requestEnvelope(endpoint, options);
    const data = await this.resolveDatos<T>(envelope, options.signal);
    const metadata =
      envelope.metadatos !== undefined
        ? await this.fetchExternal<unknown>(envelope.metadatos, options.signal)
        : undefined;
    return metadata !== undefined ? { data, metadata, envelope } : { data, envelope };
  }

  async requestEnvelope(endpoint: string, options: RequestOptions = {}): Promise<AemetEnvelope> {
    const url = this.#buildUrl(endpoint, options.query);
    const response = await this.#fetchWithRetry(url, options.signal, endpoint);
    const body = await this.#readJson(response, endpoint);
    if (!isAemetEnvelope(body)) {
      throw new AemetInvalidResponseError("Response is not a valid AEMET envelope.", {
        endpoint,
        status: response.status,
      });
    }
    if (body.estado >= 400) {
      throw mapEnvelopeError(body, endpoint);
    }
    return body;
  }

  async resolveDatos<T>(envelope: AemetEnvelope, signal?: AbortSignal): Promise<T> {
    if (!envelope.datos) {
      throw new AemetInvalidResponseError("Envelope does not contain a `datos` URL.", {
        description: envelope.descripcion,
        status: envelope.estado,
      });
    }
    return this.fetchExternal<T>(envelope.datos, signal);
  }

  async fetchExternal<T>(url: string, signal?: AbortSignal): Promise<T> {
    const response = await this.#fetchWithRetry(url, signal, url);
    return this.#readJson(response, url) as Promise<T>;
  }

  async fetchExternalRaw(url: string, signal?: AbortSignal): Promise<Response> {
    return this.#fetchWithRetry(url, signal, url);
  }

  #buildUrl(endpoint: string, query?: Record<string, string | number | undefined>): string {
    const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
    const base = `${this.#baseUrl}${path}`;
    if (!query) return base;
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) params.append(key, String(value));
    }
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  async #fetchWithRetry(url: string, signal: AbortSignal | undefined, endpoint: string): Promise<Response> {
    let attempt = 0;
    let lastError: unknown;
    while (attempt <= this.#maxRetries) {
      try {
        const response = await this.#fetchOnce(url, signal);
        if (RETRYABLE_STATUS.has(response.status) && attempt < this.#maxRetries) {
          const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
          await sleep(retryAfterMs ?? this.#backoff(attempt), signal);
          attempt += 1;
          continue;
        }
        return response;
      } catch (error) {
        if (isAbortError(error)) throw error;
        lastError = error;
        if (attempt >= this.#maxRetries) break;
        await sleep(this.#backoff(attempt), signal);
        attempt += 1;
      }
    }
    throw new AemetNetworkError(`Request to ${endpoint} failed after retries.`, {
      endpoint,
      cause: lastError,
    });
  }

  async #fetchOnce(url: string, externalSignal?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.#timeoutMs);
    const onExternalAbort = () => controller.abort(externalSignal?.reason);
    externalSignal?.addEventListener("abort", onExternalAbort);
    try {
      return await this.#fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          "api_key": this.#apiKey,
          "user-agent": this.#userAgent,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", onExternalAbort);
    }
  }

  async #readJson(response: Response, endpoint: string): Promise<unknown> {
    if (response.status === 401 || response.status === 403) {
      throw new AemetAuthError({ endpoint, status: response.status });
    }
    if (response.status === 404) {
      throw new AemetNotFoundError({ endpoint, status: response.status });
    }
    if (response.status === 429) {
      const retryAfterMs = parseRetryAfter(response.headers.get("retry-after"));
      throw new AemetRateLimitError({
        endpoint,
        status: response.status,
        ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
      });
    }
    if (response.status >= 500) {
      throw new AemetServerError({ endpoint, status: response.status });
    }
    const text = await response.text();
    if (!text) {
      throw new AemetInvalidResponseError("Empty response body.", {
        endpoint,
        status: response.status,
      });
    }
    try {
      return JSON.parse(text) as unknown;
    } catch (cause) {
      throw new AemetInvalidResponseError("Response is not valid JSON.", {
        endpoint,
        status: response.status,
        cause,
      });
    }
  }

  #backoff(attempt: number): number {
    const base = this.#retryBaseDelayMs * 2 ** attempt;
    const jitter = Math.random() * this.#retryBaseDelayMs;
    return base + jitter;
  }
}

function mapEnvelopeError(envelope: AemetEnvelope, endpoint: string): AemetError {
  const ctx = { endpoint, status: envelope.estado, description: envelope.descripcion };
  if (envelope.estado === 401 || envelope.estado === 403) return new AemetAuthError(ctx);
  if (envelope.estado === 404) return new AemetNotFoundError(ctx);
  if (envelope.estado === 429) return new AemetRateLimitError(ctx);
  if (envelope.estado >= 500) return new AemetServerError(ctx);
  return new AemetError(envelope.descripcion || `AEMET error ${envelope.estado}`, ctx);
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const date = Date.parse(value);
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return undefined;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
