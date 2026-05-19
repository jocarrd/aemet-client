import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AemetClient, type AemetClientConfig } from "aemet-client";
import { registerForecastTool } from "./tools/forecast.js";
import { registerWarningsTool } from "./tools/warnings.js";
import { registerObservationTool } from "./tools/observation.js";

export const SERVER_NAME = "aemet-mcp";
export const SERVER_VERSION = "0.1.1";

export interface CreateServerOptions {
  apiKey?: string;
  client?: AemetClient;
  clientConfig?: Omit<AemetClientConfig, "apiKey">;
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

  return { server, client };
}

function buildClient(options: CreateServerOptions): AemetClient {
  const apiKey = options.apiKey ?? process.env.AEMET_API_KEY;
  if (!apiKey) {
    throw new Error(
      "AEMET_API_KEY is required. Set it in the MCP client's `env` block or pass apiKey to createServer().",
    );
  }
  return new AemetClient({
    apiKey,
    userAgent: `${SERVER_NAME}/${SERVER_VERSION}`,
    ...(options.clientConfig ?? {}),
  });
}
