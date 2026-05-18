import { copyFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    {
      // Copy jsroot's own pre-built UMD bundle to static/ so it can be loaded
      // via a <script> tag instead of being bundled by Rollup. This bypasses
      // Rollup's circular-dependency evaluation-order bug introduced with
      // jsroot 7.11.0 (ObjectPainter.mjs:1828 runs before core.mjs initialises
      // `internals` when Rollup linearises the module graph).
      name: "copy-jsroot-bundle",
      buildStart() {
        copyFileSync(
          fileURLToPath(new URL("./node_modules/jsroot/build/jsroot.min.js", import.meta.url)),
          fileURLToPath(new URL("./static/jsroot.min.js", import.meta.url)),
        );
      },
    },
  ],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/tests/setup.ts"],
    include: ["src/**/*.{test,spec}.{js,ts}"],
    exclude: ["**/node_modules/**", "**/vendor/**", "**/prototypes/**", "**/build/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**"],
    },
    pool: "threads",
  },
  build: {
    sourcemap: true,
    minify: true,
    // When deployed under a sub-path (e.g. BASE_PATH=/web_dev), Vite's relative
    // source paths traverse up to the origin root and miss the base segment.
    // Transform them to absolute paths so devtools links point to the correct URL.
    ...(process.env.BASE_PATH
      ? {
          sourcemapPathTransform: (relativeSourcePath: string) => {
            const match = relativeSourcePath.match(/^(?:\.\.\/)*(.+)$/);
            return match ? `${process.env.BASE_PATH}/${match[1]}` : relativeSourcePath;
          },
        }
      : {}),
  },
  optimizeDeps: {
    include: ["svelte", "@testing-library/svelte"],
  },
  // During Vitest runs, force browser export conditions so module resolution
  // matches app/browser behavior.
  resolve: process.env.VITEST ? { conditions: ["browser"] } : undefined,
});
