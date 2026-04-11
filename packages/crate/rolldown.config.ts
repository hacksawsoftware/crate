import { defineConfig } from "rolldown";
import { bundleSizeReporterPlugin } from "./rolldown-size-plugin.ts";

export default defineConfig({
  input: "src/index.ts",
  output: {
    dir: "dist",
    format: "esm",
    sourcemap: true,
    minify: true,
  },
  platform: "node",
  external: [/^node:/, /@bomb\.sh\/args/, /@standard-schema\/spec/],
  plugins: [bundleSizeReporterPlugin()],
});
