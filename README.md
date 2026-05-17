# aemet-client

[![npm version](https://img.shields.io/npm/v/aemet-client.svg)](https://www.npmjs.com/package/aemet-client)
[![CI](https://github.com/jocarrd/aemet-client/actions/workflows/ci.yml/badge.svg)](https://github.com/jocarrd/aemet-client/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

Typed TypeScript client for the [AEMET OpenData API](https://opendata.aemet.es/) —
Spain's State Meteorological Agency.

> Cliente TypeScript tipado para la API OpenData de AEMET (Agencia Estatal de
> Meteorología). Pensado para Node.js 18+ y entornos modernos. Sin dependencias
> de runtime.

## Status

Work in progress — first stable release coming soon. See the
[roadmap](#roadmap) below.

## Install

```bash
pnpm add aemet-client
# or
npm install aemet-client
```

## Quick start

```ts
import { AemetClient } from "aemet-client";

const aemet = new AemetClient({ apiKey: process.env.AEMET_API_KEY! });

const forecast = await aemet.prediction.municipalDaily("28079");
console.log(forecast);
```

## Roadmap

- [x] HTTP transport (envelope two-step, retries, errors)
- [x] `AemetClient` core
- [ ] Prediction: municipal daily / hourly
- [ ] Observation: conventional stations
- [ ] Climatological values
- [ ] CAP warnings
- [ ] Radar / satellite imagery
- [ ] Maritime forecast

## License

MIT © [Jorge Carrera](https://github.com/jocarrd)
