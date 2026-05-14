# Stage 7.5 — External Data

**Status:** ✅ Complete  
**Branch:** `qwen/stage-7-5-external-data`  
**PR:** [#465](https://github.com/APTG/dedx_web/pull/465)  
**Specs:** `docs/04-feature-specs/external-data.md`, `docs/04-feature-specs/shareable-urls-formal.md`

## What was implemented

- External `.webdedx` URL primitives: `extdata={label}:{url}` parsing/serialization and `ext:label:localId` entity references.
- Zarrita-based metadata and STP slice loading for user-hosted Zarr v3 stores.
- `ExternalDataService` caching, in-flight load reuse, source limits, eviction behavior, and interpolation.
- External compatibility mapping that merges source programs, particles, and materials into app selection state.
- Calculator integration for external programs, including unit conversion and out-of-range row display.
- Plot integration for external series and URL round-tripping.
- Source attribution UI and validation/error handling for failed source loads.
- SRIM Arrow-to-`.webdedx` converter tooling and ignored local data artifacts for generated stores.
- Unit tests for URL helpers, loader/validation/unit conversion, service caching/interpolation, and compatibility mapping.
- Review follow-ups for URL codec symmetry, cache races, malformed URL parsing comments, per-program coverage assumptions, and sharded E2E regressions.

## Notes for Stage 8

- User feedback and remaining polish should be tracked as Stage 8 issues.
- Live comparison against the hosted SRIM dataset at `https://s3.cloud.cyfronet.pl/dedxweb/srim-gui.webdedx/` still depends on runtime network access in the target environment; the Copilot sandbox could not resolve that host during PR #465 review.
