import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AemetClient, type AemetClientConfig, MemoryCacheAdapter } from "aemet-client";
import { registerForecastTool } from "./tools/forecast.js";
import { registerWarningsTool } from "./tools/warnings.js";
import { registerObservationTool } from "./tools/observation.js";
import { registerClimatologyTool } from "./tools/climatology.js";
import { registerBeachTool } from "./tools/beach.js";
import { registerMountainTool } from "./tools/mountain.js";

export const SERVER_NAME = "aemet-mcp";
export const SERVER_VERSION = "0.2.0";

export interface CreateServerOptions {
  apiKey?: string;
  client?: AemetClient;
  clientConfig?: Omit<AemetClientConfig, "apiKey">;
  cacheTtlSeconds?: number;
}

export function createServer(options: CreateServerOptions = {}): {
  server: McpServer;
  client: AemetClient;
} {
  const client = options.client ?? buildClient(options);

  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );

  registerForecastTool(server, client);
  registerWarningsTool(server, client);
  registerObservationTool(server, client);
  registerClimatologyTool(server, client);
  registerBeachTool(server, client);
  registerMountainTool(server, client);

  return { server, client };
}

export const DEFAULT_CACHE_TTL_SECONDS = 600;
const MAX_CACHE_ENTRIES = 500;

function buildClient(options: CreateServerOptions): AemetClient {
  const apiKey = options.apiKey ?? process.env.AEMET_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AEMET_API_KEY is required. Set it in the MCP client's `env` block or pass apiKey to createServer().",
    );
  }
  const clientConfig = options.clientConfig ?? {};
  const ttl = options.cacheTtlSeconds ?? cacheTtlFromEnv();
  return new AemetClient({
    apiKey,
    userAgent: `${SERVER_NAME}/${SERVER_VERSION}`,
    ...(ttl > 0 && clientConfig.cache === undefined
      ? { cache: { adapter: new MemoryCacheAdapter({ maxEntries: MAX_CACHE_ENTRIES }), ttl } }
      : {}),
    ...clientConfig,
  });
}

function cacheTtlFromEnv(): number {
  const raw = process.env.AEMET_CACHE_TTL;
  if (raw === undefined || raw.trim() === "") return DEFAULT_CACHE_TTL_SECONDS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) return DEFAULT_CACHE_TTL_SECONDS;
  return parsed;
}
