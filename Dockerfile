# syntax=docker/dockerfile:1

FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY tsconfig.json tsconfig.base.json ./
COPY lib ./lib
COPY artifacts ./artifacts
RUN pnpm install --frozen-lockfile
RUN pnpm build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    PUBLIC_DIR=/app/artifacts/smart-home/dist/public \
    DATA_DIR=/app/data

# The API is bundled by esbuild, so no node_modules are needed at runtime.
COPY --from=build /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=build /app/artifacts/smart-home/dist ./artifacts/smart-home/dist
RUN mkdir -p /app/data && chown -R node:node /app
USER node

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/api/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
