# AI Session Log — 2026-04-13 — Custom Compounds Spec

**Branch:** `docs/custom_compounds_spec`
**Stage:** 1 (Requirements & Specifications)
**Output:** `docs/04-feature-specs/custom-compounds.md` **Draft v1**

---

## Prompt Summary

Write the feature specification for user-defined custom compound materials
(`docs/04-feature-specs/custom-compounds.md`). Key constraints provided:

1. WASM API already has `CustomCompound` type and `calculateCustomCompound()`
   — spec must stay consistent with `06-wasm-api-contract.md`.
2. Advanced-mode only feature (gated behind Advanced toggle).
3. User defines: name, density, elemental composition (element + atomic
   fraction or weight fraction).
4. Custom compounds appear alongside built-in materials in entity selection.
5. URL encoding: round-trip through shareable URL (ABNF `extdata` hooks noted
   as not applicable; new `ccomp_*` params needed).
6. Validation: composition sum to 100% (weight fraction mode), valid Z numbers,
   positive density.
7. Persistence: localStorage across sessions.

---

## Context Files Read

| File | Purpose |
|------|---------|
| `docs/00-redesign-plan.md` | Spec template (§7), stage plan |
| `docs/01-project-vision.md` | Advanced mode definition, audience |
| `docs/06-wasm-api-contract.md` | `CustomCompound` type, `calculateCustomCompound()` signature |
| `docs/04-feature-specs/advanced-options.md` | Format reference, Advanced Options interaction model |
| `docs/04-feature-specs/entity-selection.md` | Compact vs full panel modes, group structure |
| `docs/04-feature-specs/calculator.md` | Page context, calculator entity selection |
| `docs/04-feature-specs/shareable-urls-formal.md` | ABNF grammar, canonicalization algorithm |
| `docs/04-feature-specs/README.md` | Spec index |
| `CHANGELOG-AI.md` | Log format |
| `docs/ai-logs/README.md` | Log index format |

---

## Key Design Decisions

### URL encoding strategy

The existing `material-pair` in the ABNF grammar uses a numeric material ID.
Custom compounds have no stable numeric ID (they are user-defined). The
approach taken: extend `material-pair` to accept the sentinel value `"custom"`,
then emit separate `ccomp_name`, `ccomp_density`, `ccomp_elements`,
`ccomp_ival` (optional), and `ccomp_phase` (optional, omit-when-condensed)
parameters at a new **step 9** in the canonicalization algorithm.

This keeps the material parameter as the single dispatch point and avoids
encoding compound data into a single opaque value. The `shareable-urls-formal.md`
ABNF update to v6 is deferred until this spec is finalized.

### Round-trip guarantee without auto-save

URLs containing `material=custom` reconstruct a transient compound without
automatically persisting it to localStorage. A "Compound from shared URL —
Save to library / Dismiss" banner gives the recipient explicit control.

### Two input modes with conversion

The WASM `atomCount` field accepts floating-point values. This allows
weight-fraction input to be converted directly to relative atom counts
(`n_i = w_i / M_i`) without integer rounding, which would introduce
composition errors. The compound editor supports both Formula mode (direct
atom counts) and Weight-fraction mode (with live sum indicator and inline
derived count display).

### Phase field on StoredCompound

The WASM API's `calculateCustomCompound()` does not accept `AdvancedOptions`,
so the aggregate-state override from the Advanced Options panel cannot be
applied. Instead, a `phase` field (`"gas"` | `"condensed"`) is stored on
the compound itself and controls the default display unit — consistent with
how `isGasByDefault` works for built-in materials. The aggregate-state
toggle in the Advanced Options panel is disabled (not hidden) when a custom
compound is active.

### Compatibility filtering

Custom compounds are shown as selectable for all programs — no pre-filtering
is applied. If a program does not support the stateful `dedx_config` path
at runtime, the resulting `LibdedxError` is displayed inline using the
standard error handling rules. This is consistent with how external data
sources are handled.

---

## Open Questions Identified

1. **`getPlotDataCustomCompound()`** — No plot-data variant of
   `calculateCustomCompound()` exists in the WASM contract. Needs resolution
   before Stage 3. Either a dedicated method or repeated calls over a
   log-spaced grid.

2. **MSTAR + custom compound** — Whether MSTAR's stateful config path accepts
   `elements_id` / `elements_atoms` is unverified at spec time. Runtime error
   handling covers the failure case gracefully.

3. **Inverse lookups + custom compound** — `getInverseStp()` and
   `getInverseCsda()` take a numeric `materialId`, not a `CustomCompound`.
   Custom compound support for the inverse tabs is deferred. The spec
   documents that the inverse tabs show "Not available for custom compounds"
   when a custom compound is active.

---

## Files Modified

| File | Change |
|------|--------|
| `docs/04-feature-specs/custom-compounds.md` | Created (Draft v1) |
| `docs/04-feature-specs/README.md` | Added entry in main spec table (moved from "Planned Specs") |
| `CHANGELOG-AI.md` | Prepended session entry |
| `docs/ai-logs/README.md` | Added row for this log |
| `docs/ai-logs/2026-04-13-custom-compounds.md` | Created (this file) |
