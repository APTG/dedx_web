import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
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
  resolve: {
    alias: {
      // Browser-only shim: force @resvg/resvg-js to resolve to a TS shim in browser/test builds
      // to avoid native Node.js binding resolution (see lessons-learned.md Entry 44).
      "@resvg/resvg-js": fileURLToPath(new URL("./src/lib/shims/resvg-js.ts", import.meta.url)),
    },
    // During Vitest runs, force browser export conditions so module resolution
    // matches app/browser behavior (including the @resvg/resvg-js shim path).
    ...(process.env.VITEST ? { conditions: ["browser"] } : {}),
  },
});
