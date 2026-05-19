# aemet-client monorepo

Tools for working with [AEMET OpenData](https://opendata.aemet.es/), the
public API of Spain's State Meteorological Agency.

| Package | Description | npm |
| --- | --- | --- |
| [`aemet-client`](packages/aemet-client) | Typed TypeScript SDK + CLI for AEMET OpenData. Used in production at [snowy.es](https://snowy.es). | [![npm version](https://img.shields.io/npm/v/aemet-client.svg)](https://www.npmjs.com/package/aemet-client) |
| [`aemet-mcp`](packages/aemet-mcp) | Model Context Protocol server: plug AEMET into Claude Desktop, Cursor, Windsurf or any MCP client. Runs locally over stdio. | [![npm version](https://img.shields.io/npm/v/aemet-mcp.svg)](https://www.npmjs.com/package/aemet-mcp) |

## Quick links

- **Just want to use AEMET from code?** → [`packages/aemet-client/README.md`](packages/aemet-client/README.md)
- **Want your LLM to answer Spanish weather questions?** → [`packages/aemet-mcp/README.md`](packages/aemet-mcp/README.md)
- **Spanish docs** → [`packages/aemet-client/README.es.md`](packages/aemet-client/README.es.md)

## Develop

Requires Node.js ≥ 20.18 and pnpm ≥ 10.

```bash
pnpm install
pnpm -r build
pnpm -r test
pnpm -r typecheck
pnpm lint
```

To work on a single package:

```bash
pnpm --filter aemet-client test
pnpm --filter aemet-mcp dev
```

The E2E suite (`pnpm --filter aemet-client test:e2e`) hits the real AEMET
API and is skipped unless `AEMET_API_KEY` is set. CI runs it behind a
repository secret.

## Release

- **`aemet-client`** is released by pushing a tag `v<x.y.z>` or
  `aemet-client-v<x.y.z>`. The release workflow checks the tag matches
  `packages/aemet-client/package.json` before publishing to npm via
  Trusted Publishing (OIDC, no token).
- **`aemet-mcp`** is released by pushing a tag `aemet-mcp-v<x.y.z>`
  using the same Trusted Publishing setup. `pnpm publish` rewrites the
  `workspace:^` dependency on `aemet-client` to a real semver range.

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for development guidelines.

## License

MIT © [Jorge Carrera](https://github.com/jocarrd)
