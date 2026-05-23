import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "vendor/**",
      "prototypes/**",
      "node_modules/**",
      ".svelte-kit/**",
      "build/**",
      "static/wasm/**",
      "static/jsroot.min.js",
      "wasm/output/**",
      "scripts/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...svelte.configs["flat/recommended"],
  prettier,
  ...svelte.configs["flat/prettier"],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: [".svelte", ".svelte.ts"],
      },
    },
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off", // JSROOT uses any for painter objects
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      // TypeScript 6 enables `noUncheckedIndexedAccess` semantics on TypedArrays
      // and Maps, which makes `!` non-null assertions the most ergonomic way to
      // express "this index/lookup is guaranteed by an in-bounds loop or prior
      // `has()` check". Allow them project-wide.
      "@typescript-eslint/no-non-null-assertion": "off",
      "svelte/no-at-debug-tags": "warn",
      "svelte/valid-compile": "error",
      // Disable rules that are too strict for scaffolding phase
      "svelte/no-navigation-without-resolve": "off",
      "svelte/valid-prop-names-in-kit-pages": "off",
      "svelte/prefer-svelte-reactivity": "off", // Allow Map for now; will migrate to SvelteMap later
      "preserve-caught-error": "off",
      // Enforce .js extension on $lib/utils import (SvelteKit ESM requirement).
      // NOTE: warn severity — pre-existing violations in product code need fixing
      // before this can be upgraded to "error". See PR #427 post-mortem.
      "no-restricted-imports": [
        "warn",
        {
          // Exact-path bans (use `paths` for precise matching, not glob patterns)
          paths: [
            {
              name: "$lib/utils",
              message:
                'Import from "$lib/utils.js" (with .js extension) for SvelteKit ESM compatibility.',
            },
          ],
          // Pattern bans: *.svelte.ts import specifiers should use *.svelte
          patterns: [
            {
              group: ["**/*.svelte.ts"],
              message:
                'Import from the ".svelte" specifier, not ".svelte.ts" (e.g. "component.svelte").',
            },
          ],
        },
      ],
    },
  },
  // Ban waitForTimeout() in E2E tests — use waitForSelector/waitForFunction/expect.poll instead.
  // See .opencode/lessons-learned.md Entry 12.
  {
    files: ["tests/e2e/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "CallExpression[callee.type='MemberExpression'][callee.property.name='waitForTimeout']",
          message:
            "waitForTimeout() is banned in E2E tests (flaky in CI). Use waitForSelector, waitForFunction, or expect.poll with an explicit timeout. See .opencode/lessons-learned.md Entry 12.",
        },
      ],
    },
  },
);
