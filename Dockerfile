FROM node:20-slim AS bun-base
ENV BUN_INSTALL=/usr/local
RUN npm install -g bun@1.3.10

FROM bun-base AS deps
WORKDIR /app
COPY package.json bun.lock tsconfig.base.json ./
COPY apps/service/package.json apps/service/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/search/package.json packages/search/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/admin-cli/package.json packages/admin-cli/package.json
RUN printf 'packages:\n  - "apps/service"\n  - "packages/*"\n' > pnpm-workspace.yaml \
  && npm install -g pnpm@10.25.0 \
  && pnpm install --config.package-manager-strict=false --ignore-scripts --no-frozen-lockfile --prod=false --shamefully-hoist

FROM deps AS build
COPY . .
RUN pnpm --config.package-manager-strict=false --filter @memexai/search build \
  && pnpm --config.package-manager-strict=false --filter @memexai/core build \
  && pnpm --config.package-manager-strict=false --filter @memexai/service build \
  && pnpm --config.package-manager-strict=false --filter @memexai/admin build:cli-only

FROM node:20-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/packages/search/dist ./packages/search/dist
COPY --from=build /app/packages/search/package.json ./packages/search/package.json
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/core/package.json ./packages/core/package.json
COPY --from=build /app/apps/service/dist ./apps/service/dist
COPY --from=build /app/apps/service/migrations ./apps/service/migrations
COPY --from=build /app/apps/service/admin/dist ./apps/service/admin/dist
COPY --from=build /app/apps/service/package.json ./apps/service/package.json
COPY --from=build /app/docs ./docs
COPY --from=build /app/packages/admin-cli/dist ./packages/admin-cli/dist
COPY --from=build /app/packages/admin-cli/package.json ./packages/admin-cli/package.json
RUN ln -s /app/packages/admin-cli/dist/cli.js /usr/local/bin/memex-admin \
  && chmod +x /usr/local/bin/memex-admin
EXPOSE 8080
CMD ["node", "apps/service/dist/index.js"]
