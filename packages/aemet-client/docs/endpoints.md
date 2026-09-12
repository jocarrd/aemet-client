# AEMET OpenData endpoints reference

This document maps the AEMET OpenData REST endpoints to the methods exposed by
`aemet-client`. Each entry links the resource method, the raw HTTP path and
the response shape returned after the envelope is resolved.

## Prediction — `client.prediction`

### `municipalDaily(municipio)`

- **Endpoint:** `GET /prediccion/especifica/municipio/diaria/{municipio}`
- **Argument:** 5-digit INE code (string), e.g. `"28079"`
- **Returns:** `MunicipalDailyForecast[]`
- **Schema highlights:**
  - `prediccion.dia[].temperatura.{maxima,minima}` — daily extrema
  - `prediccion.dia[].probPrecipitacion[]` — per-period rain probability
  - `prediccion.dia[].estadoCielo[]` — sky-state codes with Spanish description
  - `prediccion.dia[].viento[]` — direction + speed in km/h
  - `prediccion.dia[].uvMax` — daily UV index peak

### `municipalHourly(municipio)`

- **Endpoint:** `GET /prediccion/especifica/municipio/horaria/{municipio}`
- **Argument:** same INE code as above
- **Returns:** `MunicipalHourlyForecast[]`
- Schema is similar but with hourly entries inside `prediccion.dia[]`. The
  `vientoAndRachaMax[]` array carries both sustained wind and gusts per hour.

## Observation — `client.observation`

### `allStations()`

- **Endpoint:** `GET /observacion/convencional/todas`
- **Returns:** `StationObservation[]` — last reading from every reporting
  station in the network.
- Each station carries `idema`, `lat`, `lon`, `alt`, `ubi` (location name) and
  `fint` (reading timestamp), plus SYNOP fields. Optional fields are absent
  when the station does not report that variable.

### `station(idema)`

- **Endpoint:** `GET /observacion/convencional/datos/estacion/{idema}`
- **Argument:** 3 to 6 alphanumeric chars (e.g. `"1387"`, `"C649I"`)
- **Returns:** `StationObservation[]` — last 24 hours, one entry per
  observation slot (usually every 10 minutes).

## Warnings — `client.warnings`

### `latest(area)`

- **Endpoint:** `GET /avisos_cap/ultimoelaborado/area/{area}`
- **Argument:** `"esp"` or one of the regional codes exported by `CAP_AREAS`.
- **Returns:** `CapDocument[]` — one document per language and region.
- The endpoint returns a `tar` archive (optionally gzipped) containing CAP 1.2
  XML files. The client unpacks the archive and parses every `.xml` entry.
- Each `CapDocument` has `filename` (original entry name), `raw` (the XML
  string) and `alert` (the parsed [CAP 1.2](https://docs.oasis-open.org/emergency/cap/v1.2/CAP-v1.2-os.html)
  structure).

### CAP severity levels

AEMET uses the standard CAP severity scale, mapped 1-to-1 to its public
warning colours:

| CAP `severity` | AEMET colour |
| -------------- | ------------ |
| `Minor`        | green        |
| `Moderate`     | yellow       |
| `Severe`       | orange       |
| `Extreme`      | red          |

The colour is also available inside `info.parameters[]` under
`AEMET-Meteoalerta nivel`.

## Mountain — `client.mountain`

AEMET serves both mountain bulletins under the `pasada` path segment; the
forecast is the variant that carries a `/dia/{day}` suffix. There is no
`/prediccion/especifica/montaña/{area}/periodo/{p}` endpoint.

### `forecast(area, day)`

- **Endpoint:** `GET /prediccion/especifica/montaña/pasada/area/{area}/dia/{day}`
- **Arguments:** an area code from `MOUNTAIN_AREAS` (`peu1`, `nav1`, `arn1`,
  `cat1`, `rio1`, `arn2`, `mad2`, `gre1`, `nev1`) and a day `0` (today) to `3`.
- **Returns:** `MountainBulletin[]` — the forecast text lives in
  `seccion[].apartado[]`, one entry per heading (sky state, precipitation,
  storms, temperature, wind).

### `past(area)`

- **Endpoint:** `GET /prediccion/especifica/montaña/pasada/area/{area}`
- **Returns:** `MountainBulletin[]` — a summary of the last 24-36 hours, with
  the text in `seccion[].parrafo[]` instead of `apartado[]`.

## Maritime — `client.maritime`

### `highSeas(area)`

- **Endpoint:** `GET /prediccion/maritima/altamar/area/{area}`
- **Argument:** `HIGH_SEAS_AREAS` — `0` (Atlantic south of 35N), `1` (Atlantic
  north of 30N), `2` (Mediterranean). AEMET rejects any other value.

### `coastal(coast)`

- **Endpoint:** `GET /prediccion/maritima/costera/costa/{coast}`
- **Argument:** `COASTAL_AREAS` — `40` to `47`. AEMET rejects any other value.

## Radar — `client.radar`

### `nationalUrl()` / `nationalImage()`

- **Endpoint:** `GET /red/radar/nacional`
- The endpoint exists, but AEMET has been answering it with an envelope of
  `{"descripcion": "Error al obtener los datos", "estado": 404}`, which the
  client surfaces as `AemetNotFoundError`. The failure is upstream; the
  regional composites are unaffected.

### `regionalUrl(code)` / `regionalImage(code)`

- **Endpoint:** `GET /red/radar/regional/{code}`
- **Argument:** a code from `REGIONAL_RADARS`: `am` Almería, `sa` Asturias,
  `pm` Illes Balears, `ba` Barcelona, `cc` Cáceres, `co` A Coruña, `ma` Madrid,
  `ml` Málaga, `mu` Murcia, `vd` Palencia, `ca` Las Palmas, `se` Sevilla,
  `va` Valencia, `ss` Vizcaya, `za` Zaragoza.

## Satellite — `client.satellite`

### `productUrl(product)` / `productImage(product)`

- **Endpoint:** `GET /satelites/producto/{product}`
- **Argument:** `SATELLITE_PRODUCTS` — only `nvdi` (normalised vegetation
  index, refreshed on Thursdays) and `sst` (sea surface temperature, refreshed
  daily). The path is not a generic parameter: any other product name is a
  route AEMET does not serve.

## Maps — `client.maps`

### `analysisUrl()` / `analysisImage()`

- **Endpoint:** `GET /mapasygraficos/analisis`
- Surface pressure analysis chart, updated every 12 hours (00, 12).

### `significantMapUrl(date, area, period)` / `significantMapImage(...)`

- **Endpoint:** `GET /mapasygraficos/mapassignificativos/fecha/{YYYY-MM-DD}/{area}/{period}`
- **Arguments:** a date, an area from `SIGNIFICANT_MAP_AREAS` (`esp` plus the
  17 autonomous community codes) and a period from `SIGNIFICANT_MAP_PERIODS`
  (`a` D+0 00-12, `b` D+0 12-24, `c` D+1 00-12, `d` D+1 12-24, `e` D+2 00-12,
  `f` D+2 12-24).
- AEMET stopped producing this product on 22/01/2020 and its archive no longer
  answers: every date tried, in and out of range, returns `{"descripcion": "No
hay datos que satisfagan esos criterios", "estado": 404}`. The route is kept
  because it is the one the official specification documents.

## Antarctica — `client.antarctica`

### `observations(station, from, to)`

- **Endpoint:** `GET /antartida/datos/fechaini/{from}/fechafin/{to}/estacion/{station}`
- **Argument:** `ANTARCTICA_STATIONS` — `89064` (Juan Carlos I) and `89070`
  (Gabriel de Castilla), plus the `R`/`RA` radiometric suffixes.
- Data is campaign-based (austral summer), so ranges outside a campaign return
  no data.

## Air quality — `client.airQuality`

### `backgroundPollution(station)` / `backgroundPollutionRaw(station)`

- **Endpoint:** `GET /red/especial/contaminacionfondo/estacion/{station}`
- **Argument:** a two-digit EMEP station code from `POLLUTION_STATIONS`. The
  endpoint takes no network segment.
- The `datos` payload is a plain-text FINN file in ISO-8859-15, not JSON: one
  line per ten-minute slot, each carrying `NAME(code): value unit CV: v FC: f`
  groups. `backgroundPollution` parses it into `PollutionMeasurement[]`;
  `backgroundPollutionRaw` returns the text untouched.

## Notes on the envelope

Every AEMET endpoint returns a two-step envelope:

```json
{ "descripcion": "exito", "estado": 200, "datos": "...", "metadatos": "..." }
```

`aemet-client` resolves the `datos` URL transparently. If you need the raw
envelope (for debugging or custom flows), drop down to the transport:

```ts
const env = await aemet.transport.requestEnvelope("/prediccion/especifica/municipio/diaria/28079");
console.log(env.datos, env.metadatos);
```
