import { defineConfig } from "vitest/config";

import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * @type {import('vitest').VitestConfig}
 */
export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    exclude: ["**/node_modules/**"],
    environment: "jsdom",
    pool: "forks",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/**"],
      exclude: ["**/*.test.*", "**/*.spec.*", "src/mocks/**", "src/types/**"],
    },
  },
});
