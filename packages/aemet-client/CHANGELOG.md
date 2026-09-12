# Changelog

All notable changes to `aemet-client` are documented here. This project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html). While the package is
below 1.0, breaking changes land in minor releases.

## [0.5.0] — 2026-09-12

Everything below was measured against the live API with a valid key and
cross-checked with the OpenAPI specification AEMET publishes at
`opendata.aemet.es/AEMET_OpenData_specification.json`.

### Breaking

- **`beach`**: `BeachForecastDay` now describes what AEMET actually returns.
  `estadoCielo`, `viento` and `oleaje` carry a morning and an afternoon value
  (`f1` and `f2`, each with its description), not a single one. `tMaxima`,
  `tAgua` and `uvMax` are objects with `valor1`, not numbers. `fecha`,
  `localidad` and `id` are numbers. `municipio`, `subZona` and `origen.enlace`
  are gone, because the API never sent them. Beach codes are validated as
  exactly 7 digits (5-digit INE code plus a 2-digit index).
- **`climatology`**: `ClimatologyNormal` no longer declares invented fields
  (`p_med`, `t_med`, `d_llu`, `i_med`). Normals are 43 variables across 11
  statistical suffixes (`_md`, `_mn`, `_q1`..`_q4`, `_max`, `_min`, `_s`, `_cv`,
  `_n`), now composed as a type. Note the values use a decimal point, unlike
  daily and monthly records, which use a comma.
- **`mountain`**: forecast and past summary were inverted. AEMET serves both
  under the `pasada` path segment, and the one with `/dia/{day}` is the
  forecast. Area codes are `peu1`, `nav1`, `arn1`, `cat1`, `rio1`, `arn2`,
  `mad2`, `gre1` and `nev1`, not `"1"`–`"8"`. The payload is a sectioned text
  bulletin, not days with a snow line, so `MountainForecast` and friends are
  replaced by `MountainBulletin`.
- **`radar`**: the regional codes `vc`, `lc`, `lp` and `mh` do not exist. The
  table now holds the 15 official ones.
- **`airQuality`**: the route had an extra `/red/{network}` segment and the
  response is a plain-text FINN file in ISO-8859-15, not JSON. It is parsed into
  `PollutionMeasurement[]`; `backgroundPollutionRaw()` returns the original
  text. `POLLUTION_NETWORKS` is replaced by `POLLUTION_STATIONS`.
- **`satellite`**: only `nvdi` and `sst` exist as products.

### Fixed

- Daily climate queries are capped at **186 days**, the real AEMET limit,
  instead of five years. Monthly queries are capped at **3 years** (36 months)
  and were not validated at all before. Both errors now say how to split the
  request.
- Passing an invalid area, station or product code fails client-side with the
  list of valid values, instead of reaching AEMET and returning a bare 404.
- A 404 on a beach forecast is reported as `BeachForecastUnavailableError`,
  explaining the product only runs from May to September.

### Documented

- `docs/endpoints.md` records the endpoints AEMET no longer serves: the
  significant weather maps were retired on 2020-01-22 and the archive answers
  "no data" for every date, and `/red/radar/nacional` has been failing upstream.
