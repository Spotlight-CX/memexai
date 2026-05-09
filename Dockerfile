FROM oven/bun:1.3.10 AS deps
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/service/package.json apps/service/package.json
COPY packages/sdk/package.json packages/sdk/package.json
RUN bun install --registry=https://registry.npmmirror.com --frozen-lockfile

FROM deps AS build
COPY . .
RUN bun run build

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/service/node_modules ./apps/service/node_modules
COPY --from=build /app/apps/service/dist ./apps/service/dist
COPY --from=build /app/apps/service/package.json ./apps/service/package.json
EXPOSE 8080
CMD ["node", "apps/service/dist/index.js"]
