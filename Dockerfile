FROM node:20-slim AS bun-base
ENV BUN_INSTALL=/usr/local
RUN npm install -g bun@1.3.10

FROM bun-base AS deps
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/service/package.json apps/service/package.json
COPY apps/demo-agent/package.json apps/demo-agent/package.json
COPY apps/benchmark/package.json apps/benchmark/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/admin-cli/package.json packages/admin-cli/package.json
RUN bun install --frozen-lockfile

FROM deps AS build
COPY . .
RUN bun run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/service/node_modules ./apps/service/node_modules
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/core/package.json ./packages/core/package.json
RUN ln -s ../../apps/service/node_modules ./packages/core/node_modules
COPY --from=build /app/apps/service/dist ./apps/service/dist
COPY --from=build /app/apps/service/migrations ./apps/service/migrations
COPY --from=build /app/apps/service/admin/dist ./apps/service/admin/dist
COPY --from=build /app/apps/service/package.json ./apps/service/package.json
EXPOSE 8080
CMD ["node", "apps/service/dist/index.js"]
