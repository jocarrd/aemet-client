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
| --- | --- |
| `Minor` | green |
| `Moderate` | yellow |
| `Severe` | orange |
| `Extreme` | red |

The colour is also available inside `info.parameters[]` under
`AEMET-Meteoalerta nivel`.

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
