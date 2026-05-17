# aemet-client

[![npm version](https://img.shields.io/npm/v/aemet-client.svg)](https://www.npmjs.com/package/aemet-client)
[![CI](https://github.com/jocarrd/aemet-client/actions/workflows/ci.yml/badge.svg)](https://github.com/jocarrd/aemet-client/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

A typed TypeScript client for [AEMET OpenData](https://opendata.aemet.es/), the
public API of Spain's State Meteorological Agency.

> Cliente TypeScript tipado para la API OpenData de AEMET. Funciona en Node.js
> 18+, Bun y Deno. Una sola dependencia de runtime (`fast-xml-parser`).

Originally built for and used in production at [snowy.es](https://snowy.es) — a
weather platform covering forecasts, warnings, real-time observations and
maritime data for Spain. Released as open source to give the meteorology dev
community a maintained, typed entry point to AEMET without having to reverse
the API's quirks themselves.

The AEMET API has a few rough edges — every response is a metadata envelope
pointing to a second URL, CAP warnings ship as tar archives of XML files, and
codes use mixed identifier formats. This library handles all of that and gives
you typed, ergonomic methods.

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

const stations = await aemet.observation.allStations();
console.log(`Reporting stations: ${stations.length}`);

const warnings = await aemet.warnings.latest("73");
for (const doc of warnings) {
  const es = doc.alert.info.find((i) => i.language === "es-ES");
  console.log(`${es?.severity}: ${es?.headline}`);
}
```

If you don't pass `apiKey`, the client reads `AEMET_API_KEY` from the
environment.

## Resources

### `client.prediction`

Municipal forecasts keyed by the 5-digit INE municipality code
(e.g. `28079` for Madrid, `08019` for Barcelona).

| Method | Endpoint | Description |
| --- | --- | --- |
| `municipalDaily(code)` | `/prediccion/especifica/municipio/diaria/{code}` | 7-day daily forecast |
| `municipalHourly(code)` | `/prediccion/especifica/municipio/horaria/{code}` | 40-hour hourly forecast |

### `client.observation`

Real-time observations from the SYNOP station network.

| Method | Endpoint | Description |
| --- | --- | --- |
| `allStations()` | `/observacion/convencional/todas` | Latest reading from every reporting station |
| `station(idema)` | `/observacion/convencional/datos/estacion/{idema}` | Last 24 hours for one station |

### `client.warnings`

Active CAP 1.2 alerts. The area code is `esp` (national) or a 2-digit region
code — `CAP_AREAS` exports a typed mapping:

```ts
import { CAP_AREAS } from "aemet-client";

const docs = await aemet.warnings.latest(CAP_AREAS.cataluna);
```

| Method | Endpoint | Description |
| --- | --- | --- |
| `latest(area)` | `/avisos_cap/ultimoelaborado/area/{area}` | Active warnings for a region |

The response is an array of `CapDocument` objects — one per language. Each
contains the parsed `CapAlert` plus the original XML in `raw`.

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

const forecast = await aemet.prediction
  .municipalDaily("28079", { signal: controller.signal })
  .catch(() => null);
```

## Runtime support

- **Node.js** ≥ 18.17
- **Bun** (uses native fetch + node:zlib compat)
- **Deno** (use the `npm:` specifier)
- **Browsers**: the HTTP transport works. CAP gzip decoding uses
  `DecompressionStream`, available in all modern browsers. CAP tar parsing is
  pure JS. Note that AEMET OpenData does not send CORS headers — direct
  browser calls will be blocked; proxy through your backend.

## Project status

| Feature | Status |
| --- | --- |
| Transport, retries, errors | done |
| Municipal daily / hourly forecasts | done |
| Conventional station observations | done |
| CAP warnings (tar + XML parsing) | done |
| Climatological values | planned |
| Maritime forecasts | planned |
| Radar / satellite imagery | planned |
| Antarctica + special network | planned |

Open an issue if you need an endpoint that isn't covered yet.

## License

MIT © [Jorge Carrera](https://github.com/jocarrd)
