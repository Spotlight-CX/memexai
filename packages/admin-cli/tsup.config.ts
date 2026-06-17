import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist",
  clean: true,
  // Bundle pure-ESM workspace packages; keep CJS packages (pg, fastify) and ai external
  noExternal: ["@memexai/search", "zod"],
})
