# AI Session Log — 2026-04-14 — Terminology Glossary

**Date:** 14 April 2026
**Stage:** 1 — Requirements & Specifications
**Output:** `docs/10-terminology.md` Final v2 (promoted from Final v1 after the original write-up)

---

## Session Summary

Wrote the Stage 1 terminology glossary (`docs/10-terminology.md`) — later
promoted from Final v1 to Final v2 — as a two-section reference document
covering physics/end-user vocabulary and developer/stack vocabulary for the
dEdx Web redesign project.

---

## Context Read

The following documents were read to source definitions and verify consistency:

| Document | Purpose |
|----------|---------|
| `docs/00-redesign-plan.md` | Full project context, Stage 1 scope, terminology section description |
| `docs/01-project-vision.md` | Audience personas, unit design principles (MeV/nucl vs MeV/u), Basic/Advanced mode, extdata |
| `docs/06-wasm-api-contract.md` | Authoritative TypeScript type names, C-level concepts (dedx_config, dedx_wrappers.h, dedx_extra.{h,c}), MSTAR mode descriptions, entity interfaces |
| `docs/04-feature-specs/README.md` | Status of all feature specs; used to verify custom-compounds and shareable-urls-formal version numbers |
| `docs/04-feature-specs/custom-compounds.md` | StoredCompound interface, Bragg additivity rule usage, custom compound workflow, I-value in compounds |
| `docs/04-feature-specs/inverse-lookups.md` | CSDA range as primary inverse use case, Bragg peak getter, Range/Inverse STP tab semantics |
| `docs/04-feature-specs/advanced-options.md` | MSTAR mode descriptions A/B/C/D/G/H, aggregate state toggle, interpolation design, CSDA integration background |
| `docs/04-feature-specs/entity-selection.md` | Particle vs ion terminology note, compatibility matrix design |
| `docs/04-feature-specs/shareable-urls.md` | urlv parameter, canonicalization policy, qfocus, mode parameter |
| `docs/04-feature-specs/shareable-urls-formal.md` | Formal ABNF grammar, extdata param, canonical algorithm steps |

---

## Decisions Made

### Included terms — Section 1 (Physics)

All terms required by the task were included. Additional terms added for
completeness and internal consistency:

- **Mass Stopping Power** — added as its own entry (distinct from Stopping Power)
  because MeV·cm²/g is the native C output unit and deserves explicit explanation.
- **ICRU 73 / ICRU 90** — merged into one entry to show how they relate within
  the `DEDX_ICRU` resolution chain.
- **PSTAR / ESTAR / ASTAR** — merged into one table entry; all three are NIST
  programs exposed in libdedx with similar characteristics.

### Included terms — Section 2 (Developer)

All terms required by the task were included. Additional terms:

- **Mass Stopping Power** is a physics term but its units are the native C API
  units, so it is referenced from the developer section where relevant.

### Format choices

- Physics terms: `Unit:` information embedded in the body (not a separate line)
  to allow more nuanced descriptions (e.g., two units for stopping power with
  a conversion note).
- Developer terms: `Type/file:` line in body, pointing to planned TypeScript file
  locations based on the target architecture in `00-redesign-plan.md` §5.
- Cross-references use Markdown anchor links within the same document.
- "Used in:" lines cite the most relevant spec files by relative path from
  `docs/` root.

### MSTAR modes

Descriptions sourced verbatim from `06-wasm-api-contract.md` §2.6 comments,
which were in turn sourced from `libdedx/include/dedx.h`. Modes E and F are
explicitly noted as unsupported.

### Particle vs ion

The terminology note from `entity-selection.md` preamble was promoted to a full
glossary entry in §1, making the C API naming convention vs. app naming convention
explicit for both physicists and developers.

### StoredCompound vs CustomCompound

These two types are named similarly but serve different layers. The distinction
was documented carefully because confusion between them is a likely source of
implementation bugs: `StoredCompound` lives in localStorage (has UUID, phase,
timestamps); `CustomCompound` is the stripped WASM-layer type (no UUID).

### Canonicalization algorithm steps

The step numbers (1–10) are based on the formal spec in
`shareable-urls-formal.md` §4. Step 9 (custom compounds) was added in v6;
step 10 is implied by the ordering rules.

---

## Files Modified

| File | Change |
|------|--------|
| `docs/10-terminology.md` | **Created** — Final v1, two-section glossary, 29 terms |
| `docs/04-feature-specs/README.md` | Added "Supporting Documents (Stage 1, not feature specs)" section with row for `10-terminology.md` |
| `CHANGELOG-AI.md` | Prepended entry for this session |
| `docs/ai-logs/README.md` | Prepended row for this session |
| `docs/ai-logs/2026-04-14-terminology.md` | **Created** — this file |

---

## Consistency Check

Cross-referenced the following specific items between `10-terminology.md` and
their source specs:

| Item | Source | Verified |
|------|--------|---------|
| MSTAR mode descriptions A/B/C/D/G/H | `06-wasm-api-contract.md` §2.6 | ✓ |
| StoredCompound interface fields | `custom-compounds.md` §1.1 | ✓ |
| CSDA integration formula `∫ 1/S(E') dE'` | `advanced-options.md` §4 background | ✓ |
| MeV/nucl vs MeV/u: proton mass = 1.00794 u | `06-wasm-api-contract.md` §2.2 comment | ✓ |
| 29 gaseous-default materials | `06-wasm-api-contract.md` §1 Design Decisions | ✓ |
| urlv current value = 1 | `shareable-urls.md` §3.1 | ✓ |
| qfocus values: both/stp/csda | `multi-program.md` §4, `shareable-urls-formal.md` §2 | ✓ |
| extdata format `{label}:{url}` | `shareable-urls-formal.md` §2 | ✓ |
| custom-compounds.md status Final v1 | `04-feature-specs/README.md` | ✓ (already correct) |
| shareable-urls-formal.md status Final v6 | `04-feature-specs/README.md` | ✓ (already correct) |
