# aemet-client

[![npm version](https://img.shields.io/npm/v/aemet-client.svg)](https://www.npmjs.com/package/aemet-client)
[![CI](https://github.com/jocarrd/aemet-client/actions/workflows/ci.yml/badge.svg)](https://github.com/jocarrd/aemet-client/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Cliente TypeScript tipado para [AEMET OpenData](https://opendata.aemet.es/), la
API pública de la Agencia Estatal de Meteorología.

> [English version](README.md) · Funciona en Node.js 18+, Bun y Deno. Una sola
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

- **Node.js** ≥ 18.17
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

## Licencia

MIT © [Jorge Carrera](https://github.com/jocarrd)
