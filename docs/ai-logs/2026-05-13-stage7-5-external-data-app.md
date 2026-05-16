# 2026-05-13 — Stage 7.5 External Data App Integration

## Session Narrative (GitHub Copilot — handoff planning)

### Prompt 1: Start implementation

**AI response**: Began Stage 7.5 app integration on the existing `qwen/stage-7-5-external-data` branch. Confirmed the worktree was clean, refreshed project lessons and the saved implementation plan, and started the first commit-sized slice: external URL and `ext:` entity-ID primitives. Real user-hosted SRIM GUI/headless stores are treated only as local/manual smoke inputs; URL values are intentionally not recorded here.

### Prompt 2: Stop and write handoff plan

**AI response**: Stopped implementation before code edits and converted the saved Stage 7.5 plan into repo markdown handoff files for continuation in Claude Code. The handoff documents include the current state, constraints, commit-sized implementation slices, proposed modules and helper APIs, test gates, and redaction requirements. No real external store URLs were recorded.

---

## Session Narrative (Claude Sonnet 4.6 via Claude Code — Slice 1 + 2)

### Prompt 3: Implement Slice 1 — external URL and ID primitives

**AI response**: Created `src/lib/external-data/` module with:

- `types.ts` — `ExternalSourceLabel`, `ExternalEntityLocalId`, `ExtRef`, `EntityId`, `ExternalSourceDescriptor`, `ParsedExtdataParams`, URL error types
- `ids.ts` — ID validators, `parseExtRef`, `formatExtRef`, `parseEntityId`, `parseEntityIdList`, `formatEntityIdList`
- `url.ts` — `parseExtdataParams`, `appendExtdataParams`, `externalDataQuerySegments`

Updated `calculator-url.ts`, `plot-url.ts`, and `multi-program.svelte.ts` to use `EntityId[]` for program/particle/material IDs. Added type guard in `plot/+page.svelte` to skip external triplets until Slice 3/4. All wired into `src/lib/external-data/index.ts`. Wrote 58-test suite `external-data-url.test.ts`. Fixed one test bug (empty-label parse case) and two TypeScript errors.

Commit: `feat: add external data URL primitives` (9ff637b)

### Prompt 4: Implement Slice 2 — zarrita loader and ExternalDataService

**AI response**: Created:

- `schema.ts` — `ExternalStoreMetadata`, `ExternalParticleEntry`, `ExternalMaterialEntry`, `ExternalProgramEntry`, unit type aliases
- `errors.ts` — `ExternalDataError` with 8 typed error codes
- `validation.ts` — `validateRootAttrs()` with all spec §6.1 checks
- `units.ts` — `energyToMev`, `convertEnergyGrid`, `stpToInternal`, `csdaToInternal`, `convertStpColumn`, `convertCsdaColumn`
- `interpolation.ts` — piecewise linear interpolation on log-log or lin-lin axes with binary search
- `loader.ts` — zarrita FetchStore-based `loadStoreMetadata`, `loadStpSlice`, `loadCsdaSlice`; `classifyLoadError` maps zarrita `NotFoundError` and HTTP errors to typed `ExternalDataError`
- `service.ts` — `ExternalDataService` with in-memory caching, load deduplication, `getStp`/`getCsda`/`interpolateAt`

Wrote 44 tests in `external-data-loader.test.ts` and 35 tests in `external-data-service.test.ts`.

**Key bugs fixed during test writing:**

1. `FetchStore` calls `fetch(request)` with a `Request` object, not a string URL. Fixed mock to check `input instanceof Request` and use `(input as Request).url`.
2. zarrita's `NotFoundError` message is `"Not found: ..."` (lowercase `f`). Fixed `classifyLoadError` to also match by `err.name === "NotFoundError"` and `msg.startsWith("Not found:")`.
3. Mock pattern `/zarr.json` matched `prog1/csda_range/zarr.json` before the more specific pattern. Fixed by selecting the **longest** matching pattern in the mock router.

Commit: `feat: load external webdedx stores` (2e90130)

### Prompt 5: Write and commit AI log

**AI response**: Updated this session log and CHANGELOG-AI.md. Session stopped at Slice 2; Slices 3–7 (entity merging, Calculator, Plot, error UI, docs/E2E) are pending for the next session.

---

## Tasks

### Handoff planning (GitHub Copilot)

- **Status**: completed
- **Stage**: 7.5
- **Files changed**: `docs/prompts/2026-05-13-stage7-5-external-data-implementation-plan.md`, `docs/prompts/2026-05-13-stage7-5-external-data-claude-handoff.md`, `docs/ai-logs/2026-05-13-stage7-5-external-data-app.md`, `docs/ai-logs/README.md`, `CHANGELOG-AI.md`
- **Decision**: Produce a detailed plan and Claude-ready handoff prompt instead of starting implementation, preserving the no-real-URL logging constraint.

### Slice 1 — External URL and ID primitives

- **Status**: completed
- **Stage**: 7.5
- **Files changed**: `src/lib/external-data/types.ts`, `src/lib/external-data/ids.ts`, `src/lib/external-data/url.ts`, `src/lib/external-data/index.ts`, `src/lib/utils/calculator-url.ts`, `src/lib/utils/plot-url.ts`, `src/lib/state/multi-program.svelte.ts`, `src/routes/plot/+page.svelte`, `src/tests/unit/external-data-url.test.ts`
- **Decision**: `EntityId = number | ExtRef` union propagated into URL codec state types; WASM call sites guard with `typeof id === "number"` until Slice 3/4.
- **Issue**: None.

### Slice 2 — Zarrita loader and ExternalDataService

- **Status**: completed
- **Stage**: 7.5
- **Files changed**: `src/lib/external-data/errors.ts`, `src/lib/external-data/schema.ts`, `src/lib/external-data/validation.ts`, `src/lib/external-data/units.ts`, `src/lib/external-data/interpolation.ts`, `src/lib/external-data/loader.ts`, `src/lib/external-data/service.ts`, `src/lib/external-data/index.ts`, `src/tests/unit/external-data-loader.test.ts`, `src/tests/unit/external-data-service.test.ts`
- **Decision**: `classifyLoadError` checks both message patterns and zarrita's error `.name` property to correctly classify `NotFoundError`s from zarrita (which internally converts 404 → undefined before throwing its own typed error).
- **Issue**: Slices 3–7 not started; entity merging and UI integration remain.
