import adapter from "@sveltejs/adapter-static";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

/** @type {import('@sveltejs/kit').Config} */
const rawBasePath = process.env.BASE_PATH?.trim();
const basePath = rawBasePath && rawBasePath !== "/" ? rawBasePath.replace(/\/+$/, "") : "";

const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      fallback: "404.html",
    }),
    prerender: {
      handleHttpError: "warn",
    },
    paths: {
      base: basePath,
    },
    serviceWorker: {
      // Registered manually from src/lib/pwa/register-service-worker.ts so we
      // can show an "update available" prompt instead of swapping assets
      // silently under a running session (see docs/09-non-functional-requirements.md §3.1).
      register: false,
    },
    alias: {
      $lib: "./src/lib",
    },
  },
};

export default config;
