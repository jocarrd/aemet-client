# Contributing

Thanks for considering a contribution to `aemet-client`.

## Reporting issues

Open an issue at https://github.com/jocarrd/aemet-client/issues with:

- a minimal reproduction (or the URL of the endpoint you were calling),
- the version of `aemet-client`, Node.js and runtime (Node / Bun / Deno),
- the full error message and stack if applicable.

For new endpoint requests, please include a link to AEMET's official
documentation page for that endpoint and a small sample of the response.

## Local development

Prerequisites: Node.js >= 20.18 and pnpm 10. Then:

```bash
git clone https://github.com/jocarrd/aemet-client.git
cd aemet-client
pnpm install
pnpm test           # unit tests, fully mocked
pnpm typecheck
pnpm lint
pnpm build
```

To run the live E2E suite against the real API:

```bash
AEMET_API_KEY=your_key pnpm test:e2e
```

API keys are free at
https://opendata.aemet.es/centrodedescargas/altaUsuario.

## Pull request flow

`main` is protected:

- one approving review is required (and the maintainer is the final
  reviewer),
- CI (Node 20.18, 22, 24) has to pass green,
- linear history (rebase merges only),
- all PR conversations must be resolved before merge.

Before opening a PR, run `pnpm lint && pnpm typecheck && pnpm test` and
make sure the changeset includes:

- the code change,
- unit tests covering the new behavior and edge cases (the project keeps
  test coverage high),
- README updates if a public API or behavior changed,
- a clear commit message in Conventional Commits style
  (`feat: …`, `fix: …`, `docs: …`, `chore: …`, etc).

If you are adding a new endpoint or resource, follow the existing pattern
under `src/resources/<name>/`:

- `types.ts` for the response models and any code-map constants,
- `<name>.ts` for the resource class extending `Resource`,
- `index.ts` re-exporting the public API,
- wire the resource into `src/client.ts` and re-export from `src/index.ts`.

## Releases

Releases are tag-driven. Maintainer publishes by:

```bash
pnpm version patch    # or minor / major
git push --follow-tags
```

GitHub Actions `release.yml` then verifies the tag matches
`package.json`, runs the full pipeline, and publishes to npm via OIDC
Trusted Publishing with provenance attestations.

## Code of conduct

Be respectful. Personal attacks, harassment or discrimination of any kind
are not tolerated. Issues and PRs are about the code and the API, not
about the people who interact with them.
