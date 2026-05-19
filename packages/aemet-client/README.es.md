# aemet-client

[![npm version](https://img.shields.io/npm/v/aemet-client.svg)](https://www.npmjs.com/package/aemet-client)
[![CI](https://github.com/jocarrd/aemet-client/actions/workflows/ci.yml/badge.svg)](https://github.com/jocarrd/aemet-client/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Cliente TypeScript tipado para [AEMET OpenData](https://opendata.aemet.es/), la
API pública de la Agencia Estatal de Meteorología.

> [English version](README.md) · Funciona en Node.js 20+, Bun y Deno. Una sola
> dependencia de runtime (`fast-xml-parser`).

Construido originalmente para [snowy.es](https://snowy.es) — la plataforma
meteorológica para España con predicción, avisos, observaciones en tiempo real
y datos marítimos — y publicado como open source para que la comunidad de
desarrolladores meteorológicos no tenga que pelearse con las particularidades
de la API.

AEMET OpenData tiene varias rarezas: cada respuesta es un sobre con metadatos
que apunta a una segunda URL con los datos reales, los avisos CAP llegan
empaquetados en archivos tar de XML, los valores climatológicos usan coma como
separador decimal y los códigos usan formatos mixtos. Esta librería esconde
toda esa fricción.

## Instalación

```bash
pnpm add aemet-client
# o
npm install aemet-client
# o
yarn add aemet-client
```

Necesitas una API key. Solicítala gratis en
[opendata.aemet.es/centrodedescargas/altaUsuario](https://opendata.aemet.es/centrodedescargas/altaUsuario).

## Uso básico

```ts
import { AemetClient } from "aemet-client";

const aemet = new AemetClient({ apiKey: process.env.AEMET_API_KEY! });

const prediccion = await aemet.prediction.municipalDaily("28079");
console.log(prediccion[0].prediccion.dia[0].temperatura);
// → { maxima: 28, minima: 14, dato: [...] }

const avisos = await aemet.warnings.latest("73");
for (const doc of avisos) {
  const es = doc.alert.info.find((i) => i.language === "es-ES");
  console.log(`${es?.severity}: ${es?.headline}`);
}
```

Si no pasas `apiKey`, el cliente lee `AEMET_API_KEY` del entorno.

## CLI

`aemet-client` incluye una CLI para consultas rápidas desde terminal:

```bash
npx aemet-client forecast 28079
npx aemet-client warnings 73 --json
npx aemet-client climate 3195 --from 2026-01-01 --to 2026-01-31
npx aemet-client radar vc            # imprime la URL del GIF regional
npx aemet-client radar --download > radar.gif
```

Ejecuta `npx aemet-client --help` para la lista completa.

## Recursos

| Recurso | Métodos | Endpoint AEMET |
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

Cada método resuelve internamente el sobre `datos` en dos pasos y te devuelve
directamente el payload parseado. Consulta
[docs/endpoints.md](docs/endpoints.md) para el detalle de parámetros y schemas.

### Mapas de códigos tipados

```ts
import { CAP_AREAS, MOUNTAIN_AREAS, REGIONAL_RADARS } from "aemet-client";

await aemet.warnings.latest(CAP_AREAS.cataluna);
await aemet.mountain.forecast(MOUNTAIN_AREAS.pirineoAragones, 0);
await aemet.radar.regionalUrl(REGIONAL_RADARS.valencia);
```

### Helper para decimales con coma

Los endpoints climatológicos devuelven valores como `"5,2"` o `"1.020,4"`. Usa
`parseSpanishNumber` para convertirlos:

```ts
import { parseSpanishNumber } from "aemet-client";

parseSpanishNumber("5,2");      // 5.2
parseSpanishNumber("1.020,4");  // 1020.4
parseSpanishNumber("");         // undefined
```

### Helpers geo

Encuentra la estación más cercana a un punto o convierte el formato AEMET de
coordenadas a grados decimales:

```ts
import {
  AemetClient,
  findNearest,
  findNearestN,
  haversine,
  parseAemetCoordinate,
} from "aemet-client";

const aemet = new AemetClient({ apiKey: process.env.AEMET_API_KEY! });
const estaciones = await aemet.observation.allStations();

const cercana = findNearest(
  { lat: 40.4168, lon: -3.7038 },
  estaciones,
  (s) => ({ lat: s.lat, lon: s.lon }),
);
console.log(`${cercana?.item.ubi} — ${cercana?.distance.toFixed(1)} km`);

const top3 = findNearestN(
  { lat: 41.3851, lon: 2.1734 },
  estaciones,
  (s) => ({ lat: s.lat, lon: s.lon }),
  3,
);

// Convierte "402411N" → 40.4030...
const lat = parseAemetCoordinate("402411N");
```

`haversine` también se exporta para distancias punto a punto.

### Catálogo de municipios embebido

`aemet-client/data` incluye todos los municipios españoles (8182 entradas — código INE,
nombre y coordenadas) para resolver coords → municipio sin necesidad de
otro servicio:

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
// devuelve Logroño primero (sin importar acentos ni mayúsculas)

findMunicipalitiesByProvince("28");
// todos los municipios cuyo código INE empieza por 28 (Madrid)
```

El dataset va por un subpath aparte para que el bundle principal no
crezca — el JSON solo se carga cuando importas `aemet-client/data`.

## Caché

Conecta un `CacheAdapter` al cliente para evitar llamadas repetidas
(AEMET tiene rate-limit fuerte y casi todos los datos son válidos de
minutos a horas). El adapter en memoria viene incluido; conecta Redis,
Upstash o Cloudflare KV implementando la misma interfaz.

```ts
import { AemetClient, MemoryCacheAdapter } from "aemet-client";

const aemet = new AemetClient({
  apiKey: process.env.AEMET_API_KEY!,
  cache: {
    adapter: new MemoryCacheAdapter({ maxEntries: 500 }),
    ttl: 300,           // segundos
    keyPrefix: "miapp", // opcional
  },
});

await aemet.prediction.municipalDaily("28079");  // primera llamada
await aemet.prediction.municipalDaily("28079");  // sirve desde caché

await aemet.prediction.municipalDaily("28079", { skipCache: true });
await aemet.prediction.municipalDaily("28079", { cacheTtl: 60 });
```

Ejemplo de adapter Redis:

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

## Manejo de errores

Todos los errores extienden `AemetError`. Usa `instanceof` para discriminar:

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
    // API key inválida o revocada
  } else if (error instanceof AemetNotFoundError) {
    // El municipio no existe
  } else if (error instanceof AemetRateLimitError) {
    // error.retryAfterMs trae la espera sugerida
  } else if (error instanceof AemetNetworkError) {
    // Fallo de conexión, timeout, DNS, etc.
  }
}
```

| Clase | Causa |
| --- | --- |
| `AemetAuthError` | HTTP 401/403 o `estado: 401` en el sobre |
| `AemetNotFoundError` | HTTP 404 o `estado: 404` en el sobre |
| `AemetRateLimitError` | HTTP 429, incluye `retryAfterMs` |
| `AemetServerError` | HTTP 5xx tras agotar reintentos |
| `AemetNetworkError` | Fallo de fetch/conexión |
| `AemetInvalidResponseError` | Sobre mal formado, JSON inválido, falta `datos` |

El transport reintenta `408`, `425`, `429`, `500`, `502`, `503` y `504` con
backoff exponencial (3 intentos por defecto, 500 ms base, respeta
`Retry-After`). Los fallos de red también se reintentan.

## Configuración

```ts
new AemetClient({
  apiKey: "...",
  baseUrl: "https://opendata.aemet.es/opendata/api", // override para proxies
  timeoutMs: 30_000,
  maxRetries: 3,
  retryBaseDelayMs: 500,
  userAgent: "mi-app/1.0",
  fetch: fetchPersonalizado, // útil para tests, undici o proxies
});
```

### Cancelación

Todos los métodos aceptan `signal: AbortSignal`:

```ts
const controller = new AbortController();
setTimeout(() => controller.abort(), 5_000);

await aemet.prediction
  .municipalDaily("28079", { signal: controller.signal })
  .catch(() => null);
```

## Compatibilidad de runtime

- **Node.js** ≥ 20.18
- **Bun** (usa fetch nativo + node:zlib compatibility)
- **Deno** (con el especificador `npm:`)
- **Navegadores**: el transport HTTP funciona. La descompresión gzip de los
  avisos CAP usa `DecompressionStream`, disponible en navegadores modernos. El
  parser tar es JS puro. AEMET OpenData no envía cabeceras CORS, así que las
  llamadas directas desde el navegador serán bloqueadas; pasa por tu backend.

## Tests

```bash
pnpm test          # tests unitarios (70+, mockeados)
pnpm test:e2e      # tests opt-in contra la API real, se saltan sin AEMET_API_KEY
pnpm typecheck
pnpm lint
```

La suite E2E se ejecuta también en CI cuando el repositorio tiene configurado
el secret `AEMET_API_KEY`.

## Ejemplos

Scripts ejecutables en [`examples/`](examples/):

- [`forecast-madrid.ts`](examples/forecast-madrid.ts) — predicción diaria municipal.
- [`active-warnings.ts`](examples/active-warnings.ts) — avisos CAP de una CCAA.
- [`nearest-station.ts`](examples/nearest-station.ts) — observación de la
  estación más cercana a un punto.
- [`coords-to-forecast-with-cache.ts`](examples/coords-to-forecast-with-cache.ts)
  — resolver coordenadas a municipio con el dataset INE embebido y obtener
  su predicción a través de una caché en memoria.

## Paquete complementario

[`aemet-mcp`](../aemet-mcp) expone este cliente como servidor del Model
Context Protocol para que clientes LLM (Claude Desktop, Cursor, Windsurf…)
puedan responder preguntas sobre el tiempo en España.

## Licencia

MIT © [Jorge Carrera](https://github.com/jocarrd)
