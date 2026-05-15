# 2026-05-15 — Dependabot JSROOT 7.11 build fix

## Session Narrative

### Prompt 1: Fix failing E2E tests on the JSROOT Dependabot PR

**AI response**: Investigated the reported CI failure with GitHub Actions logs and confirmed both E2E shards failed in the `Build app` step before Playwright tests ran. Reproduced `pnpm build` locally after enabling pnpm with Corepack; the build failed because Rolldown tried to load JSROOT 7.11's Node-only `@resvg/resvg-js` native binding in the browser bundle.

### Prompt 2: Apply the smallest build fix and validate it

**AI response**: Added a Vite alias for `@resvg/resvg-js` to a local throwing browser shim, preserving browser behavior while preventing the native Node binding from being bundled. Re-ran lint, production build, and unit tests successfully. `pnpm check` still fails on a pre-existing unrelated strictness error in `src/lib/external-data/units.ts` under the local Node 20 sandbox.

## Tasks

### Fix JSROOT 7.11 browser build failure

- **Status**: completed
- **Stage**: maintenance
- **Files changed**:
  - `vite.config.ts`
  - `src/lib/shims/resvg-js.ts`
- **Decision**: Used a Vite alias rather than modifying JSROOT imports or downgrading the dependency, because the native resvg backend is Node-only and not used by the app's browser plotting path.
- **Issue**: None.

### Record review pitfall for future sessions

- **Status**: completed
- **Stage**: maintenance
- **Files changed**:
  - `.opencode/lessons-learned.md`
- **Decision**: Documented the JSROOT/resvg/Rolldown failure mode so future JSROOT bumps keep the browser alias in place.
- **Issue**: None.
