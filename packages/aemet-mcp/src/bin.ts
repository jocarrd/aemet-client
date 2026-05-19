import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer, SERVER_NAME, SERVER_VERSION } from "./server.js";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    process.stdout.write(usage());
    return;
  }
  if (args.includes("--version") || args.includes("-v")) {
    process.stdout.write(`${SERVER_NAME} ${SERVER_VERSION}\n`);
    return;
  }

  const { server } = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function usage(): string {
  return `${SERVER_NAME} ${SERVER_VERSION}

Model Context Protocol server for AEMET — Spain's national weather agency.

Usage:
  aemet-mcp                  Run the MCP server over stdio.
  aemet-mcp --help           Show this help.
  aemet-mcp --version        Print version.

Environment:
  AEMET_API_KEY              Required. Free key at
                             https://opendata.aemet.es/centrodedescargas/altaUsuario

Add to a Claude Desktop / Cursor / Windsurf MCP config:

  {
    "mcpServers": {
      "aemet": {
        "command": "npx",
        "args": ["-y", "aemet-mcp"],
        "env": { "AEMET_API_KEY": "your-key-here" }
      }
    }
  }
`;
}

main().catch((err) => {
  process.stderr.write(`aemet-mcp fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
