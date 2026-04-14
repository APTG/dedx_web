# Stage 1 — Requirements & Specifications

> **Status:** Complete (14 April 2026)
>
> Stage 1 produced all specification and reference documents required before
> implementation begins. All feature specs are at Final status and have been
> reviewed for internal consistency.

---

## Deliverables

All Stage 1 deliverables from `docs/00-redesign-plan.md §8` are complete.

### Core documents

| Document | Status | Notes |
|----------|--------|-------|
| [`docs/01-project-vision.md`](../01-project-vision.md) | Draft v1 | Audience, use cases, design principles, app structure. Intentionally left as Draft — final polish deferred to pre-launch. |
| [`docs/06-wasm-api-contract.md`](../06-wasm-api-contract.md) | Final v2 | TypeScript types, `LibdedxService` interface, C function mapping, custom compound service methods. |
| [`docs/10-terminology.md`](../10-terminology.md) | Final v2 | Two-section glossary (physics + developer terms). Alphabetically sorted, with index. |
| [`docs/09-non-functional-requirements.md`](../09-non-functional-requirements.md) | Draft v1 | WCAG 2.1 AA, performance budgets, browser support, security. Not in the original Stage 1 plan — produced early as a dependency for export spec review. |

### Feature specs (`docs/04-feature-specs/`)

| File | Final version | Brief scope |
|------|--------------|-------------|
| [`entity-selection.md`](../04-feature-specs/entity-selection.md) | v5 | Particle → Material → Program selection, bidirectional filtering, compatibility matrix, two layout modes |
| [`calculator.md`](../04-feature-specs/calculator.md) | v8 | Landing page: unified input/result table, live calculation, CSV/PDF export |
| [`unit-handling.md`](../04-feature-specs/unit-handling.md) | v3 | Canonical unit conversion contract, formulas, fixtures |
| [`plot.md`](../04-feature-specs/plot.md) | v5 | Multi-series JSROOT chart, density conversion, PNG/SVG/CSV/PDF export |
| [`multi-program.md`](../04-feature-specs/multi-program.md) | v3 | Advanced-mode multi-program comparison, `qfocus`, drag-and-drop columns |
| [`shareable-urls.md`](../04-feature-specs/shareable-urls.md) | v6 | URL state contract, `urlv` versioning, Share button |
| [`shareable-urls-formal.md`](../04-feature-specs/shareable-urls-formal.md) | v6 | ABNF grammar, semantic rules, canonicalization algorithm, conformance vectors |
| [`advanced-options.md`](../04-feature-specs/advanced-options.md) | v5 | Density/I-value/aggregate-state/interpolation/MSTAR overrides |
| [`inverse-lookups.md`](../04-feature-specs/inverse-lookups.md) | v4 | Range tab + Inverse STP tab, multi-program column layout |
| [`export.md`](../04-feature-specs/export.md) | v6 | Authoritative export: toolbar order, CSV config modal, PDF metadata, image export |
| [`custom-compounds.md`](../04-feature-specs/custom-compounds.md) | v1 | User-defined compound materials, StoredCompound, Bragg filter, URL encoding |
| [`build-info.md`](../04-feature-specs/build-info.md) | v1 | Footer build badge (commit hash, date, branch) |

### Later-stage spec produced early

| File | Final version | Notes |
|------|--------------|-------|
| [`external-data.md`](../04-feature-specs/external-data.md) | v4 | User-hosted `.webdedx.parquet` data, `extdata` URL param, entity merging. Implementation deferred to a later stage but specified now because URL grammar depends on it. |

---

## Key Design Decisions Made in Stage 1

These decisions constrain implementation. Future sessions must not change them
without creating a new spec version and CHANGELOG entry.

| Decision | Where specified |
|----------|----------------|
| **Particle vs ion naming**: app uses "particle", C API uses "ion" (legacy) | `entity-selection.md` §0, `10-terminology.md` §1 |
| **MeV/nucl ≠ MeV/u**: C API uses MeV/nucl; JS converts; MeV/u is Advanced-mode only | `06-wasm-api-contract.md` §1, `unit-handling.md` |
| **Mass stopping power (MeV·cm²/g) is the internal unit** for all WASM outputs | `06-wasm-api-contract.md` §2.3, `unit-handling.md` |
| **CSDA range is computed by integration** (not table lookup); `interpolationScale` has compound effect | `advanced-options.md` §4 background |
| **Stateless wrappers** (`dedx_wrappers.h`) are the primary WASM call path; stateful `dedx_config` only for overrides and custom compounds | `06-wasm-api-contract.md` §1 |
| **Electron (particle ID 1001)** uses MeV only; MeV/nucl and MeV/u are undefined for leptons | `06-wasm-api-contract.md` §1, `unit-handling.md` |
| **Compatibility matrix** is pre-computed at init; there is no native libdedx reverse-lookup | `entity-selection.md` §2 |
| **URL contract version `urlv=1`** is the current major version; schema changes must increment it | `shareable-urls.md` §3.1 |
| **Canonicalization is a 9-step pipeline** (step 9 = custom compounds, step 10 = param ordering) | `shareable-urls-formal.md` §4 |
| **StoredCompound ≠ CustomCompound**: localStorage type has UUID/phase/timestamp; WASM type is stripped | `custom-compounds.md` §1.1 |
| **MSTAR default mode is "b"** (auto-special: condensed → D, gaseous → H) | `06-wasm-api-contract.md` §2.6, `advanced-options.md` §5 |
| **Default display unit**: condensed materials → keV/µm; gaseous materials → MeV·cm²/g | `unit-handling.md`, `advanced-options.md` §3 |
