import { defineConfig, loadEnv } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig(({ mode }) => {
  const rootEnv = loadEnv(mode, "../..", "")
  const proxyTarget = process.env.MEMEX_ADMIN_PROXY_TARGET
    ?? rootEnv.MEMEX_ADMIN_PROXY_TARGET
    ?? `http://localhost:${process.env.MEMEX_PORT ?? rootEnv.MEMEX_PORT ?? "8080"}`

  console.log(`Admin dev proxy target: ${proxyTarget}`)

  return {
    root: "admin",
    base: "/admin/",
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        "/v1": {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  }
})
