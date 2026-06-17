import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  // No source maps in the published tarball — they embed the original TS source.
  sourcemap: false,
  clean: true,
  treeshake: true,
  // Peer deps + the sibling SDK are resolved by the consumer, never bundled.
  external: ["@anyr/sdk", "ai", "@ai-sdk/provider", "@ai-sdk/provider-utils", "zod"],
  outExtension({ format }) {
    return { js: format === "esm" ? ".mjs" : ".js" }
  },
})
