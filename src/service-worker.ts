/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

// Cache-first offline support for the static app shell + libdedx WASM (issue
// #881). `version` changes on every build (SvelteKit's default
// `kit.version.name` is `Date.now().toString()`), so a new deployment always
// gets a fresh cache name and the activate handler evicts the previous one —
// this is the "versioned cache key" the deferral note in
// docs/09-non-functional-requirements.md §3.1 called for.

import { build, files, prerendered, version } from "$service-worker";

const sw = self as unknown as ServiceWorkerGlobalScope;

const CACHE = `cache-${version}`;

const ASSETS = [...build, ...files, ...prerendered];

sw.addEventListener("install", (event) => {
  async function addFilesToCache() {
    const cache = await caches.open(CACHE);
    await cache.addAll(ASSETS);
  }
  event.waitUntil(addFilesToCache());
});

sw.addEventListener("activate", (event) => {
  async function deleteOldCaches() {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await sw.clients.claim();
  }
  event.waitUntil(deleteOldCaches());
});

sw.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  // Let cross-origin requests (e.g. the external SRIM S3 data source) pass
  // through untouched — this SW only manages the app's own static assets.
  if (url.origin !== sw.location.origin) return;

  async function respond(): Promise<Response> {
    const cache = await caches.open(CACHE);

    if (ASSETS.includes(url.pathname)) {
      const cached = await cache.match(url.pathname);
      if (cached) return cached;
    }

    try {
      const response = await fetch(event.request);
      if (response.status === 200) {
        cache.put(event.request, response.clone());
      }
      return response;
    } catch (err) {
      const cached = await cache.match(event.request);
      if (cached) return cached;
      throw err;
    }
  }

  event.respondWith(respond());
});

// Told by register-service-worker.ts (in response to the user clicking
// "Reload to update") to take over immediately instead of waiting for every
// tab to close.
sw.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    sw.skipWaiting();
  }
});
