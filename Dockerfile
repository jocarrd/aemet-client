# Image for the aemet-mcp server (stdio). Registries that score MCP servers
# (Glama, Docker MCP) build it from here, start it with no credentials and call
# tools/list, so the server must come up without AEMET_API_KEY. It does: the key
# is only needed once a tool actually queries AEMET.
#
#   docker build -t aemet-mcp .
#   docker run -i --rm -e AEMET_API_KEY=your-key aemet-mcp

FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

# Manifests first, so dependency install is cached across source changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/aemet-client/package.json packages/aemet-client/
COPY packages/aemet-mcp/package.json packages/aemet-mcp/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter aemet-client build && pnpm --filter aemet-mcp build \
 && pnpm --filter aemet-mcp deploy --prod --legacy /out

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /out ./
USER node
ENTRYPOINT ["node", "dist/bin.js"]
