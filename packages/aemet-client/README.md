# aemet-client

[![npm version](https://img.shields.io/npm/v/aemet-client.svg)](https://www.npmjs.com/package/aemet-client)
[![CI](https://github.com/jocarrd/aemet-client/actions/workflows/ci.yml/badge.svg)](https://github.com/jocarrd/aemet-client/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A typed TypeScript client for [AEMET OpenData](https://opendata.aemet.es/), the
public API of Spain's State Meteorological Agency.

> [Versión en español](README.es.md) · Cliente TypeScript tipado para la API
> OpenData de AEMET. Funciona en Node.js 20+, Bun y Deno.

Originally built for and used in production at [snowy.es](https://snowy.es) — a
weather platform covering forecasts, warnings, real-time observations and
maritime data for Spain. Released as open source to give the meteorology dev
community a maintained, typed entry point to AEMET without having to reverse
the API's quirks themselves.

The AEMET API has a few rough edges — every response is a metadata envelope
pointing to a second URL, CAP warnings ship as tar archives of XML files, daily
climatological values use comma decimals, and codes use mixed identifier
formats. This library handles all of that and gives you typed, ergonomic
methods.

## Install

```bash
pnpm add aemet-client
# or
npm install aemet-client
# or
yarn add aemet-client
```

You need an API key. Request one (free) at
[opendata.aemet.es/centrodedescargas/altaUsuario](https://opendata.aemet.es/centrodedescargas/altaUsuario).

## Quick start

```ts
import { AemetClient } from "aemet-client";

const aemet = new AemetClient({ apiKey: process.env.AEMET_API_KEY! });

const forecast = await aemet.prediction.municipalDaily("28079");
console.log(forecast[0].prediccion.dia[0].temperatura);
// → { maxima: 28, minima: 14, dato: [...] }

const warnings = await aemet.warnings.latest("73");
for (const doc of warnings) {
  const es = doc.alert.info.find((i) => i.language === "es-ES");
  console.log(`${es?.severity}: ${es?.headline}`);
}
```

If you don't pass `apiKey`, the client reads `AEMET_API_KEY` from the
environment.

## CLI

`aemet-client` ships a CLI for ad-hoc queries:

```bash
npx aemet-client forecast 28079
npx aemet-client warnings 73 --json
npx aemet-client climate 3195 --from 2026-01-01 --to 2026-01-31
npx aemet-client radar vc            # prints the regional radar GIF URL
npx aemet-client radar --download > radar.gif
```

Run `npx aemet-client --help` for the full list of subcommands.

## Resources

| Resource | Methods | Endpoint family |
| --- | --- | --- |
| `prediction` | `municipalDaily`, `municipalHourly` | `/prediccion/especifica/municipio/*` |
| `observation` | `allStations`, `station` | `/observacion/convencional/*` |
| `warnings` | `latest` | `/avisos_cap/ultimoelaborado/*` |
| `climatology` | `daily`, `monthly`, `normals`, `stationInventory` | `/valores/climatologicos/*` |
| `beach` | `forecast` | `/prediccion/especifica/playa/{code}` |
| `mountain` | `forecast`, `past` | `/prediccion/especifica/montaña/*` |
| `maritime` | `highSeas`, `coastal` | `/prediccion/maritima/*` |
| `radar` | `nationalUrl`, `regionalUrl`, `nationalImage`, `regionalImage` | `/red/radar/*` |
| `satellite` | `productUrl`, `productImage` | `/satelites/producto/{producto}` |
| `maps` | `analysisUrl`, `analysisImage`, `significantMapUrl`, `significantMapImage` | `/mapasygraficos/*` |
| `antarctica` | `observations` | `/antartida/datos/...` |
| `airQuality` | `backgroundPollution` | `/red/especial/contaminacionfondo/...` |

Each method returns the parsed `datos` payload after the two-step envelope is
resolved transparently. See [docs/endpoints.md](docs/endpoints.md) for the full
parameter and response reference.

### Typed code maps

```ts
import { CAP_AREAS, MOUNTAIN_AREAS, REGIONAL_RADARS } from "aemet-client";

await aemet.warnings.latest(CAP_AREAS.cataluna);
await aemet.mountain.forecast(MOUNTAIN_AREAS.pirineoAragones, 0);
await aemet.radar.regionalUrl(REGIONAL_RADARS.valencia);
```

### Spanish-decimal helper

Climatological endpoints return values like `"5,2"` or `"1.020,4"`. Use
`parseSpanishNumber` to convert them:

```ts
import { parseSpanishNumber } from "aemet-client";

parseSpanishNumber("5,2");      // 5.2
parseSpanishNumber("1.020,4");  // 1020.4
parseSpanishNumber("");         // undefined
```

### Geo helpers

Find the nearest reporting station to a point, or convert AEMET's
coordinate format to decimal degrees:

```ts
import {
  AemetClient,
  findNearest,
  findNearestN,
  haversine,
  parseAemetCoordinate,
} from "aemet-client";

const aemet = new AemetClient({ apiKey: process.env.AEMET_API_KEY! });
const stations = await aemet.observation.allStations();

const nearest = findNearest(
  { lat: 40.4168, lon: -3.7038 },
  stations,
  (s) => ({ lat: s.lat, lon: s.lon }),
);
console.log(`${nearest?.item.ubi} — ${nearest?.distance.toFixed(1)} km`);

const top3 = findNearestN(
  { lat: 41.3851, lon: 2.1734 },
  stations,
  (s) => ({ lat: s.lat, lon: s.lon }),
  3,
);

// Convert "402411N" → 40.4030...
const lat = parseAemetCoordinate("402411N");
```

`haversine` is exported too for arbitrary point-to-point distances.

### Embedded municipality dataset

`aemet-client/data` ships every Spanish municipality (8182 entries — INE code, name
and coordinates) so you can resolve coords → municipality without an
extra service:

```ts
import {
  findMunicipalitiesByName,
  findMunicipalitiesByProvince,
  findMunicipalityByCode,
  findNearestMunicipality,
} from "aemet-client/data";

findMunicipalityByCode("28079");
// { ineCode: "28079", name: "Madrid", lat: 40.41694, lon: -3.70333 }

findNearestMunicipality({ lat: 41.0, lon: 1.0 });
// { item: { ineCode: ..., name: "Reus", ... }, distance: 8.21 }

findMunicipalitiesByName("logrono", 5);
// returns Logroño first (accent + case insensitive)

findMunicipalitiesByProvince("28");
// every municipality whose INE code starts with 28 (Madrid province)
```

The dataset is exported through a separate subpath so the main bundle
stays small — the JSON only loads when you import `aemet-client/data`.

## Caching

Wrap a `CacheAdapter` around the client to avoid repeated network
calls (AEMET rate-limits aggressively and most data is valid for
minutes to hours). The default in-memory adapter is included; plug
Redis/Upstash/Cloudflare KV by implementing the same shape.

```ts
import { AemetClient, MemoryCacheAdapter } from "aemet-client";

const aemet = new AemetClient({
  apiKey: process.env.AEMET_API_KEY!,
  cache: {
    adapter: new MemoryCacheAdapter({ maxEntries: 500 }),
    ttl: 300,           // seconds, applied when set() is called
    keyPrefix: "myapp", // optional namespacing
  },
});

await aemet.prediction.municipalDaily("28079");  // cold
await aemet.prediction.municipalDaily("28079");  // served from cache

await aemet.prediction.municipalDaily("28079", { skipCache: true });
await aemet.prediction.municipalDaily("28079", { cacheTtl: 60 });
```

Custom adapter (Redis example):

```ts
import type { CacheAdapter } from "aemet-client";

const redisAdapter: CacheAdapter = {
  async get(key) {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : undefined;
  },
  async set(key, value, ttl) {
    await redis.set(key, JSON.stringify(value), "EX", ttl ?? 300);
  },
};
```

## Error handling

All errors extend `AemetError`. Use `instanceof` to discriminate:

```ts
import {
  AemetAuthError,
  AemetNotFoundError,
  AemetRateLimitError,
  AemetNetworkError,
} from "aemet-client";

try {
  await aemet.prediction.municipalDaily("99999");
} catch (error) {
  if (error instanceof AemetAuthError) {
    // Invalid or revoked API key
  } else if (error instanceof AemetNotFoundError) {
    // Municipality does not exist
  } else if (error instanceof AemetRateLimitError) {
    // error.retryAfterMs has the suggested wait
  } else if (error instanceof AemetNetworkError) {
    // Connection failure, timeout, DNS, etc.
  }
}
```

| Class | Cause |
| --- | --- |
| `AemetAuthError` | HTTP 401/403 or envelope `estado: 401` |
| `AemetNotFoundError` | HTTP 404 or envelope `estado: 404` |
| `AemetRateLimitError` | HTTP 429, includes `retryAfterMs` |
| `AemetServerError` | HTTP 5xx after retries exhausted |
| `AemetNetworkError` | fetch/connection failure |
| `AemetInvalidResponseError` | Malformed envelope, invalid JSON, missing `datos` URL |

The transport retries `408`, `425`, `429`, `500`, `502`, `503` and `504`
responses with exponential backoff (default 3 attempts, 500 ms base delay,
honoring `Retry-After`). Network-level failures are also retried.

## Configuration

```ts
new AemetClient({
  apiKey: "...",
  baseUrl: "https://opendata.aemet.es/opendata/api", // override for proxies
  timeoutMs: 30_000,
  maxRetries: 3,
  retryBaseDelayMs: 500,
  userAgent: "my-app/1.0",
  fetch: customFetch, // inject for tests, undici, or proxy support
});
```

### Cancellation

Every resource method accepts a `signal: AbortSignal`:

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

await aemet.prediction
  .municipalDaily("28079", { signal: controller.signal })
  .catch(() => null);
```

## Runtime support

- **Node.js** ≥ 20.18
- **Bun** (uses native fetch + node:zlib compat)
- **Deno** (use the `npm:` specifier)
- **Browsers**: the HTTP transport works. CAP gzip decoding uses
  `DecompressionStream`, available in all modern browsers. CAP tar parsing is
  pure JS. Note that AEMET OpenData does not send CORS headers — direct
  browser calls will be blocked; proxy through your backend.

## Testing

```bash
pnpm test          # unit tests (70+, fully mocked)
pnpm test:e2e      # opt-in live tests, skipped without AEMET_API_KEY
pnpm typecheck
pnpm lint
```

The E2E suite hits the real API and is also wired into CI behind a repository
secret.

## Examples

Runnable scripts in [`examples/`](examples/):

- [`forecast-madrid.ts`](examples/forecast-madrid.ts) — municipal daily forecast.
- [`active-warnings.ts`](examples/active-warnings.ts) — CAP warnings for a region.
- [`nearest-station.ts`](examples/nearest-station.ts) — observation from the
  closest station to a point.
- [`coords-to-forecast-with-cache.ts`](examples/coords-to-forecast-with-cache.ts)
  — resolve coordinates to a municipality with the embedded INE dataset and
  fetch its forecast through an in-memory cache.

## Companion package

[`aemet-mcp`](../aemet-mcp) exposes this client as a Model Context Protocol
server so LLM clients (Claude Desktop, Cursor, Windsurf, …) can answer
questions about Spanish weather.

## License

MIT © [Jorge Carrera](https://github.com/jocarrd)
