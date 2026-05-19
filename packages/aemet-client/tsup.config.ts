import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts", data: "src/data/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: true,
    clean: true,
    treeshake: true,
    splitting: false,
    minify: false,
    target: "node20",
    loader: { ".json": "json" },
  },
  {
    entry: { cli: "src/cli.ts" },
    format: ["esm"],
    sourcemap: true,
    clean: false,
    treeshake: true,
    splitting: false,
    minify: false,
    target: "node20",
    banner: { js: "#!/usr/bin/env node" },
    outExtension: () => ({ js: ".js" }),
  },
]);
