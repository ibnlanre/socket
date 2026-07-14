import { defineConfig } from "tsup";

export default defineConfig({
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  entry: ["src/index.ts"],
  outDir: "dist",
  tsconfig: "./tsconfig.json",
  treeshake: true,
});
