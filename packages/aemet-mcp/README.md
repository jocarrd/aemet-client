# aemet-mcp

[![npm version](https://img.shields.io/npm/v/aemet-mcp.svg)](https://www.npmjs.com/package/aemet-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io/) server that lets
LLM clients — Claude Desktop, Cursor, Windsurf, Zed, custom agents — answer
questions about Spain's weather using real data from
[AEMET](https://www.aemet.es), the State Meteorological Agency.

Built on top of [`aemet-client`](https://www.npmjs.com/package/aemet-client),
the same TypeScript SDK that powers [snowy.es](https://snowy.es).

Runs **locally over stdio** — no hosted infrastructure, no shared API key.
Every user supplies their own free AEMET key.

## Get an AEMET API key

Free, takes about a minute:

1. Open [opendata.aemet.es/centrodedescargas/altaUsuario](https://opendata.aemet.es/centrodedescargas/altaUsuario)
2. Enter your email
3. They send you the key as a JWT — copy it

## Use it from Claude Desktop

Edit `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS
or `%APPDATA%\Claude\claude_desktop_config.json` on Windows and add:

```json
{
  "mcpServers": {
    "aemet": {
      "command": "npx",
      "args": ["-y", "aemet-mcp"],
      "env": {
        "AEMET_API_KEY": "paste-your-key-here"
      }
    }
  }
}
```

Restart Claude Desktop and ask: *"What's the weather forecast for Madrid this
week?"* or *"Are there any active weather warnings in Catalonia right now?"*.

## Use it from Cursor / Windsurf / Zed

Same config object — every MCP-capable client accepts the
`{ command, args, env }` shape. See their docs for where the config file lives.

## Tools

### `get_forecast`

AEMET's official forecast for any of Spain's 8000+ municipalities.

| Argument      | Type                     | Notes                                                                 |
|---------------|--------------------------|-----------------------------------------------------------------------|
| `location`    | string                   | Name (`"Madrid"`, `"Logroño"`, `"A Coruña"`) or 5-digit INE code      |
| `days`        | integer 1-7 (optional)   | Defaults to 3. Ignored when `granularity="hourly"`                    |
| `granularity` | `"daily"` \| `"hourly"`  | Daily summary or next ~40h hour-by-hour                               |

### `get_warnings`

Active CAP (Common Alerting Protocol) warnings for an autonomous community
or the whole country.

| Argument      | Type                                            | Notes                                                    |
|---------------|-------------------------------------------------|----------------------------------------------------------|
| `area`        | string                                          | `"Cataluña"`, `"Madrid"`, `"73"` (La Rioja), `"esp"` …  |
| `language`    | `"es" \| "en" \| "ca" \| "gl" \| "eu" \| "any"` | Preferred warning language. Defaults to `"es"`           |
| `minSeverity` | `"Minor" \| "Moderate" \| "Severe" \| "Extreme"`| Drop warnings below this threshold                       |

### `get_nearest_observation`

Latest real-time observation (temperature, humidity, wind, precipitation,
pressure, visibility) from the AEMET station closest to a location.

| Argument   | Type   | Notes                                                                                          |
|------------|--------|------------------------------------------------------------------------------------------------|
| `location` | string | Municipality name, INE code, or decimal coordinate pair (`"40.4168,-3.7038"`) |

## Programmatic use

If you're building your own MCP integration, the server is also exposed as a
library:

```ts
import { createServer } from "aemet-mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const { server } = createServer({ apiKey: process.env.AEMET_API_KEY });
await server.connect(new StdioServerTransport());
```

You can pass an existing `AemetClient` (for example one wired to a Redis cache)
instead of an API key:

```ts
import { AemetClient } from "aemet-client";
import { createServer } from "aemet-mcp";

const client = new AemetClient({ apiKey, cache: { adapter: redisAdapter } });
const { server } = createServer({ client });
```

## How it resolves municipalities

`location` accepts free-form names because the package embeds the full INE
municipality dataset (8000+ entries) shipped by `aemet-client`. Searching for
`"logrono"`, `"Logroño"` or `"26089"` all resolve to the same place. Decimal
coordinates resolve to the nearest municipality.

For autonomous communities, common aliases work: `"Cataluña"`, `"catalunya"`,
`"Catalonia"`, `"Euskadi"`, `"País Vasco"`, `"Comunitat Valenciana"`, etc.

## License

MIT © [Jorge Carrera](https://github.com/jocarrd)
