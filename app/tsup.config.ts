import { defineConfig, type Options } from "tsup";

const core: Options = {
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  entry: ["src/index.ts"],
  outDir: "dist",
  tsconfig: "./tsconfig.json",
  treeshake: true,
};

export default defineConfig([core]);
