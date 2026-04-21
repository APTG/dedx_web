# Stage 4: Local Dev Server Fixes

**Date:** 2026-04-21  
**Stage:** 4 (Scaffolding follow-up)  
**Model:** Qwen3.5-397B via opencode  
**Branch:** `qwen/stage-4-scaffolding`  
**Commit:** `633fab6`

---

## Summary

Fixed Vite and SvelteKit warnings that appeared when running `pnpm dev` on the newly scaffolded Stage 4 app. The app now loads cleanly in the browser with only expected WASM 404 errors (WASM module will be implemented in Stage 6).

**Related:**
- [Stage 4 Progress](../progress/stage-4-scaffolding.md) — Stage completion summary
- [SvelteKit Config](../../svelte.config.js) — Static adapter configuration
- [WASM Loader](../../src/lib/wasm/loader.ts) — Module with dynamic import fix

---

## Issues Fixed

### 1. Vite Dynamic Import Warning

**Problem:**
```
The above dynamic import cannot be analyzed by Vite.
See https://github.com/rollup/plugins/tree/master/packages/dynamic-import-vars#limitations
```

**Solution:** Added `/* @vite-ignore */` comment to suppress the warning for the intentional dynamic WASM import.

**File:** [`src/lib/wasm/loader.ts:10`](../../src/lib/wasm/loader.ts)
```diff
-    const factory = await import(`${base}/wasm/libdedx.mjs`);
+    const factory = await import(/* @vite-ignore */ `${base}/wasm/libdedx.mjs`);
```

---

### 2. SvelteKit Prerender Directive Warnings

**Problem:**
```
`export const prerender` will be ignored — move it to +page(.server).js/ts instead.
```

SvelteKit requires `export const prerender` to be in `+page.ts` files, not in `.svelte` components.

**Solution:** Removed `export const prerender = true` from 5 `.svelte` files and created 3 new `+page.ts` files for docs routes.

**Files modified:**
- [`src/routes/calculator/+page.svelte`](../../src/routes/calculator/+page.svelte) — removed prerender directive
- [`src/routes/plot/+page.svelte`](../../src/routes/plot/+page.svelte) — removed prerender directive
- [`src/routes/docs/+page.svelte`](../../src/routes/docs/+page.svelte) — removed prerender directive, added wasmReady import
- [`src/routes/docs/user-guide/+page.svelte`](../../src/routes/docs/user-guide/+page.svelte) — removed prerender directive, added wasmReady import
- [`src/routes/docs/technical/+page.svelte`](../../src/routes/docs/technical/+page.svelte) — removed prerender directive, added wasmReady import

**Files created:**
- [`src/routes/docs/+page.ts`](../../src/routes/docs/+page.ts) — added `export const prerender = true`
- [`src/routes/docs/user-guide/+page.ts`](../../src/routes/docs/user-guide/+page.ts) — added `export const prerender = true`
- [`src/routes/docs/technical/+page.ts`](../../src/routes/docs/technical/+page.ts) — added `export const prerender = true`

Note: `src/routes/calculator/+page.ts` and `src/routes/plot/+page.ts` already existed with the prerender directive.

---

## Verification

### Before
```
[404] GET /wasm/libdedx.mjs
warning: The above dynamic import cannot be analyzed by Vite.
`export const prerender` will be ignored — move it to +page(.server).js/ts instead.
```

### After
```
[404] GET /wasm/libdedx.mjs  (expected - Stage 6)
```

Only the expected WASM 404 remains (the module doesn't exist until Stage 6). All Vite and SvelteKit warnings are resolved.

---

## Commands Verified

```bash
pnpm dev    # ✅ Runs without warnings (except expected WASM 404)
pnpm build  # ✅ Tested in previous commit
pnpm lint   # ✅ 0 errors
pnpm test   # ✅ 3 unit tests passing
```

---

## Impact

- **User-facing:** None (app behavior unchanged)
- **Developer experience:** Clean dev server output, no confusing warnings
- **Build output:** All routes properly configured for static pre-rendering
- **Stage 4 status:** Still complete — this is a bug fix follow-up

---

## Related Files

| Category | Files |
|----------|-------|
| Modified | [`src/lib/wasm/loader.ts`](../../src/lib/wasm/loader.ts), 5× `.svelte` files |
| Created  | 3× `+page.ts` files for docs routes |
| Commit   | [`633fab6`](../../.git/refs/heads/qwen/stage-4-scaffolding) — `fix(stage-4): move prerender directive to +page.ts files` |

---

## Next Steps

Stage 4 scaffolding is now fully complete with no warnings. Ready to proceed to:

**Stage 5: Core Shared Components** (see [Stage 5 requirements](../00-redesign-plan.md))
- Install and configure shadcn-svelte
- Create Button, Select, Card, Input, Label components
- Implement energy input form with unit parser
- Build entity selector dropdowns
- Create unified results table component

---

**Attribution:** (Qwen3.5-397B via opencode)
