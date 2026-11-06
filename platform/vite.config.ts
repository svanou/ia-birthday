import { defineConfig } from "vitest/config";
export default defineConfig({
  root: "platform",
  build: { outDir: "../dist", emptyOutDir: true },
  server: { port: 5173, proxy: { "/api": "http://127.0.0.1:8787" } },
  test: { include: ["platform/tests/**/*.test.ts"] },
});
