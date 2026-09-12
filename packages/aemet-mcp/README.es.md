# aemet-mcp

[![npm version](https://img.shields.io/npm/v/aemet-mcp.svg)](https://www.npmjs.com/package/aemet-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Servidor del [Model Context Protocol](https://modelcontextprotocol.io/) para que
los clientes LLM (Claude Desktop, Cursor, Windsurf, Zed o agentes propios)
respondan preguntas sobre el tiempo en España con datos reales de
[AEMET](https://www.aemet.es), la Agencia Estatal de Meteorología.

> [English version](README.md) · Ocho herramientas sobre los datos abiertos de
> AEMET. Requiere Node.js 20.19 o superior.

Está construido sobre [`aemet-client`](https://www.npmjs.com/package/aemet-client),
el mismo SDK de TypeScript que mueve [snowy.es](https://snowy.es).

Se ejecuta **en local por stdio**, sin infraestructura alojada ni API key
compartida. Cada usuario pone la suya, que es gratuita.

## Consigue una API key de AEMET

Es gratis y lleva un minuto:

1. Abre [opendata.aemet.es/centrodedescargas/altaUsuario](https://opendata.aemet.es/centrodedescargas/altaUsuario)
2. Escribe tu correo
3. Te mandan la key en forma de JWT; cópiala

## Uso desde Claude Desktop

Edita `~/Library/Application Support/Claude/claude_desktop_config.json` en macOS
o `%APPDATA%\Claude\claude_desktop_config.json` en Windows y añade:

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

Reinicia Claude Desktop y pregúntale: _«¿Qué predicción hay para Madrid esta
semana?»_, _«¿Hay avisos activos en Cataluña ahora mismo?»_, _«¿Cuánto llovió en
Logroño el agosto pasado?»_ o _«¿A qué temperatura está el agua en La Concha?»_.

## Uso desde Cursor / Windsurf / Zed

El mismo objeto de configuración vale para todos, porque cualquier cliente con
soporte MCP acepta la forma `{ command, args, env }`. Mira en su documentación
dónde vive el fichero.

## Herramientas

### `get_forecast`

La predicción oficial de AEMET para cualquiera de los más de 8000 municipios de
España.

| Argumento     | Tipo                    | Notas                                                                    |
| ------------- | ----------------------- | ------------------------------------------------------------------------ |
| `location`    | string                  | Nombre (`"Madrid"`, `"Logroño"`, `"A Coruña"`) o código INE de 5 dígitos |
| `days`        | entero 1-7 (opcional)   | 3 por defecto. Se ignora cuando `granularity="hourly"`                   |
| `granularity` | `"daily"` \| `"hourly"` | Resumen diario o las próximas ~40 h hora a hora                          |

### `get_warnings`

Avisos CAP (Common Alerting Protocol) activos en una comunidad autónoma o en
toda España.

| Argumento     | Tipo                                             | Notas                                                 |
| ------------- | ------------------------------------------------ | ----------------------------------------------------- |
| `area`        | string                                           | `"Cataluña"`, `"Madrid"`, `"73"` (La Rioja), `"esp"`… |
| `language`    | `"es" \| "en" \| "ca" \| "gl" \| "eu" \| "any"`  | Idioma preferido del aviso. `"es"` por defecto        |
| `minSeverity` | `"Minor" \| "Moderate" \| "Severe" \| "Extreme"` | Descarta los avisos por debajo de ese umbral          |

### `get_nearest_observation`

La última observación en tiempo real (temperatura, humedad, viento,
precipitación, presión, visibilidad) de la estación de AEMET más cercana a un
punto.

| Argumento  | Tipo   | Notas                                                                                |
| ---------- | ------ | ------------------------------------------------------------------------------------ |
| `location` | string | Nombre de municipio, código INE o par de coordenadas decimales (`"40.4168,-3.7038"`) |

### `get_climate_history`

Datos climatológicos históricos de la estación de AEMET más cercana a un punto:
los registros diarios de un rango de fechas o los valores normales mensuales de
la estación.

| Argumento  | Tipo                     | Notas                                                                                |
| ---------- | ------------------------ | ------------------------------------------------------------------------------------ |
| `location` | string                   | Nombre de municipio, código INE o par de coordenadas decimales                       |
| `mode`     | `"range"` \| `"normals"` | `"range"` (por defecto) lee los registros diarios. `"normals"`, las medias mensuales |
| `from`     | string                   | `YYYY-MM-DD`. Obligatorio con `"range"`                                              |
| `to`       | string (opcional)        | `YYYY-MM-DD`; hoy por defecto                                                        |

AEMET limita las consultas climatológicas diarias a **186 días** por petición,
así que los rangos más largos se rechazan con un mensaje que lo explica. Los
rangos de más de un mes llegan agregados por meses (media de máximas y mínimas,
extremos, precipitación total y días de lluvia) en vez de una línea por día.

### `get_beach_forecast`

Predicción a tres días para cualquiera de las 591 playas que AEMET cubre durante
la temporada de baño: cielo, viento y oleaje repartidos en mañana y tarde, más
temperatura máxima, temperatura del agua, sensación térmica e índice UV.

| Argumento      | Tipo              | Notas                                                                                                                               |
| -------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `location`     | string            | Nombre de playa (`"La Concha"`, `"Es Trenc"`), un municipio costero para listar sus playas, o el código AEMET de playa de 7 dígitos |
| `municipality` | string (opcional) | Municipio o provincia, para distinguir playas que comparten nombre                                                                  |
| `days`         | entero 1-3        | 3 por defecto                                                                                                                       |

Los nombres se resuelven sin tildes y aguantan cómo los escribe la gente
(`"la kontxa"`, `"playa de la concha, suances"`). Cuando un nombre encaja con
varias playas, el servidor responde con las candidatas y sus códigos. Fuera de la
temporada de baño AEMET deja de publicar y la herramienta lo dice.

### `get_mountain_forecast`

El boletín de montaña de AEMET para las nueve áreas que cubre: la predicción por
apartados, las cotas de la isoterma de cero grados, los vientos en la atmósfera
libre y las temperaturas en refugios y puertos con su altitud. También sirve las
últimas 24 horas.

| Argumento | Tipo                     | Notas                                                                                                                                                                                                                                                                                   |
| --------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `area`    | string                   | Nombre o código del área: Picos de Europa (`peu1`), Pirineo Navarro (`nav1`), Pirineo Aragonés (`arn1`), Pirineo Catalán (`cat1`), Ibérica Riojana (`rio1`), Ibérica Aragonesa (`arn2`), Sierras de Guadarrama y Somosierra (`mad2`), Sierra de Gredos (`gre1`), Sierra Nevada (`nev1`) |
| `mode`    | `"forecast"` \| `"past"` | Predicción (por defecto) o las últimas 24 horas                                                                                                                                                                                                                                         |
| `day`     | entero 0-3               | Días de adelanto de la predicción, 0 (hoy) por defecto                                                                                                                                                                                                                                  |

Funcionan los alias habituales: `"Guadarrama"`, `"Moncayo"`, `"Urbión"`,
`"Peñibética"`, `"Val d'Aran"`, `"Gredos"`.

### `get_maritime_forecast`

Los boletines marítimos de AEMET: aguas costeras (8 zonas) y alta mar (3 zonas),
con los avisos, la situación sinóptica, la predicción por zona y la tendencia
para el día siguiente.

| Argumento | Tipo                         | Notas                                                                                                                                                      |
| --------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `area`    | string                       | Zona, provincia costera o región (`"Gipuzkoa"`, `"Girona"`, `"Mar Menor"`, `"Gran Sol"`, `"Alborán"`), o un código: 40-47 para costeras, 0-2 para alta mar |
| `product` | `"coastal"` \| `"high_seas"` | Fuerza uno de los dos productos cuando un nombre existe en los dos                                                                                         |

AEMET redacta el viento, el estado de la mar y la visibilidad como un único texto
por zona, así que la herramienta lo entrega tal cual y no lo trocea a base de
suposiciones.

### `get_air_quality`

Contaminación de fondo de la red rural de referencia de AEMET (EMEP/VAG/CAMP).
Son estaciones alejadas de las ciudades, miden el aire de fondo regional y **no**
informan de la calidad del aire urbana.

| Argumento  | Tipo              | Notas                                                                                                |
| ---------- | ----------------- | ---------------------------------------------------------------------------------------------------- |
| `station`  | string (opcional) | Nombre de la estación o código de 2 dígitos (`"Campisábalos"`, `"Doñana"`, `"09"`)                   |
| `location` | string (opcional) | Municipio, código INE o coordenadas; resuelve la estación más cercana e indica a qué distancia queda |

Las medidas llevan los códigos de validación de AEMET, y los valores marcados
como inválidos van etiquetados para que un modelo no los cite como lecturas
buenas.

## Caché

La API de AEMET tiene rate-limit y algunas respuestas pesan. El inventario de
estaciones son 926 entradas y el servidor lo lee en cada consulta
climatológica, así que las respuestas se guardan en memoria durante
**10 minutos** por defecto, por endpoint.

Para cambiarlo, pon `AEMET_CACHE_TTL` en el mismo bloque `env` que la API key,
en segundos, o a `0` para desactivar la caché:

```json
"env": {
  "AEMET_API_KEY": "paste-your-key-here",
  "AEMET_CACHE_TTL": "1800"
}
```

La caché vive en el proceso del servidor, así que desaparece cuando tu cliente
MCP lo cierra. Si necesitas algo compartido o persistente, pásale tu propio
adapter `cache` por `clientConfig`.

## Uso programático

Si estás montando tu propia integración MCP, el servidor también se expone como
librería:

```ts
import { createServer } from "aemet-mcp";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const { server } = createServer({ apiKey: process.env.AEMET_API_KEY });
await server.connect(new StdioServerTransport());
```

En lugar de la API key puedes pasarle un `AemetClient` ya construido, por ejemplo
uno conectado a una caché en Redis:

```ts
import { AemetClient } from "aemet-client";
import { createServer } from "aemet-mcp";

const client = new AemetClient({ apiKey, cache: { adapter: redisAdapter } });
const { server } = createServer({ client });
```

## Cómo resuelve los municipios

`location` acepta nombres escritos a mano porque el paquete embebe el catálogo
completo de municipios del INE (más de 8000 entradas) que trae `aemet-client`.
Buscar `"logrono"`, `"Logroño"` o `"26089"` lleva al mismo sitio. Las coordenadas
decimales se resuelven al municipio más cercano.

Para las comunidades autónomas funcionan los alias habituales: `"Cataluña"`,
`"catalunya"`, `"Catalonia"`, `"Euskadi"`, `"País Vasco"`,
`"Comunitat Valenciana"`, etc.

## Licencia

MIT © [Jorge Carrera](https://github.com/jocarrd)
