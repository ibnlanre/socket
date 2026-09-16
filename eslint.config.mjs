import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "**/playwright-report/**",
      "**/test-results/**",
      "**/.vitepress/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["app/src/**/*.{ts,tsx}"],
    rules: {
      // TypeScript already resolves globals and DOM/lib types; the core rule
      // only understands plain JS globals and reports false positives here.
      "no-undef": "off",
    },
  }
);
