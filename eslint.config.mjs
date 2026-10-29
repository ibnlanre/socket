import js from "@eslint/js";
import perfectionist from "eslint-plugin-perfectionist";
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
    extends: [perfectionist.configs["recommended-natural"]],
    rules: {
      // TypeScript already resolves globals and DOM/lib types; the core rule
      // only understands plain JS globals and reports false positives here.
      "no-undef": "off",

      "perfectionist/sort-exports": [
        "warn",
        {
          fallbackSort: { order: "asc", type: "alphabetical" },
          groups: ["type-export", ["value-export", "unknown"]],
          partitionByNewLine: true,
          type: "natural",
        },
      ],

      "perfectionist/sort-imports": [
        "warn",
        {
          fallbackSort: { order: "asc", type: "alphabetical" },
          groups: [
            ["type-builtin", "type-subpath", "type-external"],
            ["type-internal", "type-parent", "type-sibling", "type-index"],
            ["named-type-builtin", "named-type-subpath", "named-type-external"],
            [
              "named-type-internal",
              "named-type-parent",
              "named-type-sibling",
              "named-type-index",
            ],
            ["ts-equals-import"],
            [
              "named-value-builtin",
              "named-value-subpath",
              "named-value-external",
            ],
            ["named-value-internal"],
            ["named-value-parent", "named-value-sibling", "named-value-index"],
            ["value-builtin", "value-subpath", "value-external"],
            ["value-internal"],
            ["value-parent", "value-sibling", "value-index"],
            ["value-side-effect", "value-side-effect-style"],
            ["require-import"],
            ["unknown"],
          ],
          type: "natural",
        },
      ],

      // Switch fall-throughs are grouped deliberately in the stream parsers.
      "perfectionist/sort-switch-case": "off",
    },
  }
);
