import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      // Resolve the sibling SDK from source so tests run without a prior build.
      "@anyr/sdk": resolve(__dirname, "../sdk/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
