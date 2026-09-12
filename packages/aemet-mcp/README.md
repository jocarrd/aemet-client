# aemet-mcp

[![npm version](https://img.shields.io/npm/v/aemet-mcp.svg)](https://www.npmjs.com/package/aemet-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A [Model Context Protocol](https://modelcontextprotocol.io/) server that lets
LLM clients — Claude Desktop, Cursor, Windsurf, Zed, custom agents — answer
questions about Spain's weather using real data from
[AEMET](https://www.aemet.es), the State Meteorological Agency.

> [Versión en español](README.es.md) · Servidor MCP con ocho herramientas
> sobre los datos abiertos de AEMET. Requiere Node.js 20.19 o superior.

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

Restart Claude Desktop and ask: _"What's the weather forecast for Madrid this
week?"_, _"Are there any active weather warnings in Catalonia right now?"_,
_"How much did it rain in Logroño last August?"_ or _"What's the water
temperature at La Concha?"_.

## Use it from Cursor / Windsurf / Zed

Same config object — every MCP-capable client accepts the
`{ command, args, env }` shape. See their docs for where the config file lives.

## Tools

### `get_forecast`

AEMET's official forecast for any of Spain's 8000+ municipalities.

| Argument      | Type                    | Notes                                                            |
| ------------- | ----------------------- | ---------------------------------------------------------------- |
| `location`    | string                  | Name (`"Madrid"`, `"Logroño"`, `"A Coruña"`) or 5-digit INE code |
| `days`        | integer 1-7 (optional)  | Defaults to 3. Ignored when `granularity="hourly"`               |
| `granularity` | `"daily"` \| `"hourly"` | Daily summary or next ~40h hour-by-hour                          |

### `get_warnings`

Active CAP (Common Alerting Protocol) warnings for an autonomous community
or the whole country.

| Argument      | Type                                             | Notes                                                  |
| ------------- | ------------------------------------------------ | ------------------------------------------------------ |
| `area`        | string                                           | `"Cataluña"`, `"Madrid"`, `"73"` (La Rioja), `"esp"` … |
| `language`    | `"es" \| "en" \| "ca" \| "gl" \| "eu" \| "any"`  | Preferred warning language. Defaults to `"es"`         |
| `minSeverity` | `"Minor" \| "Moderate" \| "Severe" \| "Extreme"` | Drop warnings below this threshold                     |

### `get_nearest_observation`

Latest real-time observation (temperature, humidity, wind, precipitation,
pressure, visibility) from the AEMET station closest to a location.

| Argument   | Type   | Notes                                                                         |
| ---------- | ------ | ----------------------------------------------------------------------------- |
| `location` | string | Municipality name, INE code, or decimal coordinate pair (`"40.4168,-3.7038"`) |

### `get_climate_history`

Historical climate data from the AEMET station closest to a location: either
daily records over a date range or the station's long-term monthly normals.

| Argument   | Type                     | Notes                                                                       |
| ---------- | ------------------------ | --------------------------------------------------------------------------- |
| `location` | string                   | Municipality name, INE code, or decimal coordinate pair                     |
| `mode`     | `"range"` \| `"normals"` | `"range"` (default) reads daily records. `"normals"` reads monthly averages |
| `from`     | string                   | `YYYY-MM-DD`. Required for `"range"`                                        |
| `to`       | string (optional)        | `YYYY-MM-DD`, defaults to today                                             |

AEMET caps daily climate queries at **186 days** per request, so longer ranges
are rejected with a message explaining it. Ranges over a month come back
aggregated by month (mean max/min, extremes, total precipitation, rain days)
instead of one line per day.

### `get_beach_forecast`

Three-day forecast for any of the 591 beaches AEMET covers during the bathing
season: sky, wind and waves split into morning and afternoon, plus maximum
temperature, water temperature, thermal sensation and UV index.

| Argument       | Type              | Notes                                                                                                                 |
| -------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `location`     | string            | Beach name (`"La Concha"`, `"Es Trenc"`), a coastal municipality to list its beaches, or the 7-digit AEMET beach code |
| `municipality` | string (optional) | Municipality or province, to disambiguate beaches that share a name                                                   |
| `days`         | integer 1-3       | Defaults to 3                                                                                                         |

Names resolve without accents and tolerate how people actually write them
(`"la kontxa"`, `"playa de la concha, suances"`). When a name matches more than
one beach, the server answers with the candidates and their codes. Outside the
bathing season AEMET stops publishing and the tool says so.

### `get_mountain_forecast`

AEMET's mountain bulletin for the nine areas it covers: the forecast by
section, freezing-level altitudes, free-atmosphere winds, and temperatures at
named refuges and passes with their altitude. Also serves the last 24 hours.

| Argument | Type                     | Notes                                                                                                                                                                                                                                                                            |
| -------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `area`   | string                   | Area name or code: Picos de Europa (`peu1`), Pirineo Navarro (`nav1`), Pirineo Aragonés (`arn1`), Pirineo Catalán (`cat1`), Ibérica Riojana (`rio1`), Ibérica Aragonesa (`arn2`), Sierras de Guadarrama y Somosierra (`mad2`), Sierra de Gredos (`gre1`), Sierra Nevada (`nev1`) |
| `mode`   | `"forecast"` \| `"past"` | Forecast (default) or the last 24 hours                                                                                                                                                                                                                                          |
| `day`    | integer 0-3              | Days ahead for the forecast, 0 (today) by default                                                                                                                                                                                                                                |

Common aliases work: `"Guadarrama"`, `"Moncayo"`, `"Urbión"`, `"Peñibética"`,
`"Val d'Aran"`, `"Gredos"`.

### `get_maritime_forecast`

AEMET's marine bulletins: coastal waters (8 areas) and high seas (3 areas),
with warnings, the synoptic situation, the forecast per zone and the trend for
the following day.

| Argument  | Type                         | Notes                                                                                                                                          |
| --------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `area`    | string                       | Zone, coastal province or region (`"Gipuzkoa"`, `"Girona"`, `"Mar Menor"`, `"Gran Sol"`, `"Alborán"`), or a code: 40-47 coastal, 0-2 high seas |
| `product` | `"coastal"` \| `"high_seas"` | Force one of the two products when a name exists in both                                                                                       |

AEMET writes wind, sea state and visibility as a single text per zone, so the
tool passes that text through rather than splitting it with guesswork.

### `get_air_quality`

Background pollution from AEMET's rural EMEP/VAG/CAMP reference network:
regional background air, **not** urban air quality.

| Argument   | Type              | Notes                                                                                        |
| ---------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `station`  | string (optional) | Station name or 2-digit code (`"Campisábalos"`, `"Doñana"`, `"09"`)                          |
| `location` | string (optional) | Municipality, INE code or coordinates; resolves the nearest station and reports the distance |

Measurements carry AEMET's validation codes, and values flagged as invalid are
labelled so a model does not quote them as real readings.

## Caching

AEMET rate-limits its API and some responses are heavy: the station inventory
alone is 926 entries, and the server reads it on every climate query. Responses
are therefore cached in memory for **10 minutes** by default, per endpoint.

Set `AEMET_CACHE_TTL` in the same `env` block as the API key to change it, in
seconds, or to `0` to turn caching off:

```json
"env": {
  "AEMET_API_KEY": "paste-your-key-here",
  "AEMET_CACHE_TTL": "1800"
}
```

The cache lives in the server process, so it disappears when your MCP client
closes it. Pass your own `cache` adapter through `clientConfig` if you need
something shared or persistent.

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
