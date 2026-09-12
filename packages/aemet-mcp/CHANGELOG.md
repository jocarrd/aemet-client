# Changelog

All notable changes to `aemet-mcp` are documented here. This project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] — 2026-09-12

### Added

- `get_climate_history` tool: daily climate records over a date range, or a
  station's long-term monthly normals. Resolves the closest climate station
  from AEMET's 926-entry inventory, accepting a municipality name, an INE code
  or a coordinate pair. Ranges longer than a month are aggregated by month so a
  model gets a summary instead of hundreds of rows.
- `get_beach_forecast` tool: three-day forecast for the 591 beaches AEMET
  covers during the bathing season, with sky, wind and waves split into morning
  and afternoon, plus maximum temperature, water temperature, thermal sensation
  and UV index. Beach names resolve without accents and tolerate the way people
  write them; ambiguous names answer with the candidates and their codes.
- `get_mountain_forecast` tool: AEMET's bulletin for its nine mountain areas,
  with the forecast by section, freezing levels, free-atmosphere winds and
  temperatures at named refuges and passes, plus the last 24 hours. Areas
  resolve by name, including the aliases people actually use.
- `get_maritime_forecast` tool: coastal waters (8 areas) and high seas (3
  areas), with warnings, synoptic situation, per-zone forecast and next-day
  trend. Resolves zone names and coastal provinces, not just codes.
- `get_air_quality` tool: background pollution from the rural EMEP/VAG/CAMP
  reference network, by station or nearest to a location. Values AEMET flags as
  invalid are labelled so a model does not quote them.
- In-memory response cache, on by default with a 10-minute TTL. Set
  `AEMET_CACHE_TTL` to change it, or `0` to turn it off.

The server now covers every AEMET product that answers today: eight tools over
the twelve SDK resources. The ones left out are documented as unavailable
upstream (significant weather maps, retired in 2020) or as images rather than
data (radar, satellite).

### Changed

- Tool error messages read as sentences instead of two clauses run together.
- Built on `aemet-client` 0.5.0, whose types now match what AEMET really
  returns. Climate normals and beach forecasts stopped needing local
  workarounds in this package as a result.

## [0.2.0] and earlier

Released without a changelog. `0.1.x` shipped `get_forecast`, `get_warnings`
and `get_nearest_observation`.
