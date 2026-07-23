# 2026-07-23 — PWA Service Worker (#881)

## Session Narrative

### Prompt 1: Offline Android feasibility question

The user asked whether dedx_web could become a fully offline Android app, and
whether the codebase could be reused or would need a rewrite.

**AI response**: Confirmed the app already builds to a static bundle via
`@sveltejs/adapter-static`, and `libdedx` (`libdedx/CMakeLists.txt`) is plain
C11/CMake, so Emscripten is just one build target — it could equally be
cross-compiled for Android NDK. Laid out four options with pros/cons: (1) add
a Service Worker to make the existing web app an installable, offline PWA —
no rewrite, benefits all users, not just Android; (2) wrap the same static
build in Capacitor for a Play Store APK; (3) a native Kotlin/Compose rewrite
calling `libdedx` via JNI; (4) a Flutter/React Native rewrite. Recommended
(1) first regardless, since it's low-cost and doesn't foreclose (2) later.
Native rewrites (3)/(4) only make sense with a hard requirement for
best-in-class native performance, which a stopping-power calculator doesn't
have.

### Prompt 2: File a well-scoped issue for the PWA option

**AI response**: Filed [issue #881](https://github.com/APTG/dedx_web/issues/881).
Grounded it in the codebase's existing (but unwired) PWA scaffolding —
`static/site.webmanifest` already exists and is linked from `src/app.html`,
but there's no Service Worker, so today's "Install" prompt is just a
shortcut, not real offline support — and in an explicit v1 deferral already
documented in `docs/09-non-functional-requirements.md` §3.1 and
`docs/08-deployment.md` §6, including the risk that deferral called out (a
buggy SW could serve stale WASM after a `libdedx` data-table update unless
the cache key is versioned per deployment).

### Prompt 3: Implement #881

**AI response**: Implemented the Service Worker using SvelteKit's built-in
`$service-worker` module (no new dependency) rather than `vite-plugin-pwa`,
since the project already has an idiomatic adapter-static + static-manifest
setup and the built-in module gives a `version` string that changes on every
build by default (`kit.version.name` defaults to `Date.now().toString()`),
which directly satisfies the "versioned cache key invalidated on every
deployment" requirement from the deferral note with no extra plumbing.

Disabled SvelteKit's auto-registration (`kit.serviceWorker.register: false`
in `svelte.config.js`) in favor of manual registration
(`src/lib/pwa/register-service-worker.ts`), specifically to implement an
"update available — reload?" banner instead of silently swapping cached
assets under a running session (the exact failure mode the deferral note
warned about).

**Bug caught during e2e testing**: the first implementation added a
`navigator.serviceWorker.addEventListener('controllerchange', ...)` listener
unconditionally at registration time, reloading the page whenever the
controller changed. This also fires the very first time `clients.claim()`
(in the SW's `activate` handler) hands a freshly-loaded page its initial
controller — which is not a real update — causing an infinite self-reload
loop on first visit. Fixed by moving the controllerchange→reload listener
(registered with `{ once: true }`) into `applyServiceWorkerUpdate()`, so it's
only ever wired up in response to the user clicking "Reload to update," never
during ordinary first-load activation. Caught by the new
`tests/e2e/pwa-service-worker.spec.ts` `@smoke` test failing with "Execution
context was destroyed, most likely because of a navigation" — a real
Playwright build/e2e run against the compiled service worker, not just unit
mocks, was what surfaced it.

## Tasks

### Add a Service Worker for offline-capable PWA

- **Status**: completed
- **Stage**: not a redesign-plan stage — standalone enhancement (#881)
- **Files changed**:
  - `svelte.config.js` — `kit.serviceWorker.register: false`
  - `src/service-worker.ts` (new) — cache-first strategy over
    `build`/`files`/`prerendered` from `$service-worker`; cache name
    `cache-${version}`; `activate` deletes all other caches; cross-origin
    requests (e.g. the external SRIM S3 data source) pass through untouched;
    listens for `{ type: "SKIP_WAITING" }` postMessage
  - `src/lib/pwa/update-state.svelte.ts` (new) — `updateAvailable` rune state
  - `src/lib/pwa/register-service-worker.ts` (new) — manual registration,
    update detection (`updatefound`/`statechange`), `applyServiceWorkerUpdate()`
  - `src/lib/components/pwa-update-banner.svelte` (new) — persistent (non
    auto-dismissing) banner, unlike `notice-toast.svelte`, since this must
    stay until the user acts
  - `src/routes/+layout.svelte` — calls `registerServiceWorker()` in an
    `$effect`; renders `PwaUpdateBanner` above the header
  - `src/tests/unit/register-service-worker.test.ts`,
    `src/tests/components/pwa-update-banner.test.ts` (new)
  - `tests/e2e/pwa-service-worker.spec.ts` (new) — `@smoke`: SW registers and
    claims the page; `@regression`: a previously-visited page reloads and
    completes a full WASM calculation with the browser context offline and
    zero failed requests
  - Docs: `docs/09-non-functional-requirements.md` §3.1,
    `docs/08-deployment.md` §6, `docs/03-architecture.md` — replaced the "not
    implemented in v1" notes with the shipped design
- **Decision**: used SvelteKit's built-in `$service-worker` module instead of
  `vite-plugin-pwa` — zero new dependencies, and its default `version`
  behavior already satisfies the versioned-cache-key requirement.
- **Decision**: manual registration + `{ once: true }`-scoped controllerchange
  listener inside `applyServiceWorkerUpdate()`, not a global listener, to
  avoid reloading on ordinary first-activation (see bug above).
- **Issue**: none outstanding. Capacitor/native Android packaging is a
  separate, explicitly out-of-scope follow-up (see #881's "Explicitly out of
  scope" section) if still wanted after this ships.
