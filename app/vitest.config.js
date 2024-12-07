import { resolve } from "path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

/**
 * @type {import('vitest').VitestConfig}
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    exclude: ["**/node_modules/**"],
    environment: "jsdom",
    pool: "forks",
  },
});
