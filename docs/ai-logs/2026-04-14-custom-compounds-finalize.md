# AI Session Log — 2026-04-14 — Custom Compounds Finalization

**Branch:** `docs/custom_compounds_spec`
**Stage:** 1 (Requirements & Specifications)
**Output:** `docs/04-feature-specs/custom-compounds.md` promoted **Draft v1 → Final v1**

---

## Prompt Summary

Resume from previous session. Check the proposed changes for consistency
across all spec documents, update logs, promote custom-compounds.md from
Draft v1 to Final v1, and assess what remains in Stage 1.

---

## Context Files Read

| File | Purpose |
|------|---------|
| `docs/04-feature-specs/custom-compounds.md` | Spec under review |
| `docs/04-feature-specs/export.md` | PDF MATERIAL row format reference |
| `docs/04-feature-specs/shareable-urls.md` | Stale "future enhancement" note check |
| `docs/04-feature-specs/shareable-urls-formal.md` | ABNF mat_* param cross-check |
| `docs/06-wasm-api-contract.md` | CustomCompound type, new service method signatures |
| `docs/04-feature-specs/README.md` | Spec index (status tracking) |
| `docs/00-redesign-plan.md` | Stage 1 completion criteria |
| `CHANGELOG-AI.md` | Log format |
| `docs/ai-logs/README.md` | Log index |

---

## Consistency Issues Found and Fixed

### 1. PDF MATERIAL row format (custom-compounds.md §8.2 vs export.md)

`export.md` (the authoritative export spec) defines the MATERIAL row format as:
```
MATERIAL  Water (liquid)  ρ = 1.000 g/cm³
```
(no colon after MATERIAL; `ρ =` as separator)

`custom-compounds.md §8.2` used a different format:
```
MATERIAL:   PMMA (custom) — 1.19 g/cm³
```
(colon present; `—` em-dash as separator)

**Fix:** Updated §8.2 examples to match the canonical format:
```
MATERIAL  PMMA (custom)  ρ = 1.19 g/cm³
MATERIAL  Custom Water (custom, gas)  ρ = 8.99e-5 g/cm³
```

### 2. shareable-urls.md §11.7 stale "future enhancement" note

`shareable-urls.md` §11.7 listed:
> "User-defined custom compounds in URL state — requires enhancement to entity encoding."

This was written before custom-compounds.md and shareable-urls-formal.md v6 existed.
The encoding is now fully specified (`material=custom` + `mat_*` params, step 9 canonicalization).

**Fix:** Updated the bullet to reference the completed specification.

---

## Files Modified

| File | Change |
|------|--------|
| `docs/04-feature-specs/custom-compounds.md` | Promoted Draft v1 → Final v1; status block updated with finalization note; §8.2 PDF MATERIAL row format fixed |
| `docs/04-feature-specs/shareable-urls.md` | §11.7 stale future-enhancement bullet updated to reference custom-compounds.md §6 and shareable-urls-formal.md v6 |
| `docs/04-feature-specs/README.md` | Status updated to Final v1 |
| `CHANGELOG-AI.md` | Session entry prepended |
| `docs/ai-logs/README.md` | Row added for this log |
| `docs/ai-logs/2026-04-14-custom-compounds-finalize.md` | Created (this file) |

---

## Stage 1 Completeness Review

Stage 1 deliverables per `docs/00-redesign-plan.md` §8:

| Deliverable | Status |
|-------------|--------|
| `docs/01-project-vision.md` | Exists (Draft v1, Apr 3) |
| All `docs/04-feature-specs/*.md` | **All Final** after this session |
| `docs/06-wasm-api-contract.md` | Exists and up to date |

### All feature specs at Final status

| Spec | Status |
|------|--------|
| entity-selection.md | Final v5 |
| calculator.md | Final v8 |
| unit-handling.md | Final v3 |
| plot.md | Final v5 |
| multi-program.md | Final v3 |
| shareable-urls.md | Final v6 |
| shareable-urls-formal.md | Final v6 |
| advanced-options.md | Final v5 |
| inverse-lookups.md | Final v4 |
| build-info.md | Final v1 |
| export.md | Final v6 |
| custom-compounds.md | **Final v1** (this session) |
| external-data.md | Final v4 (Later-Stage) |

### Items outside Stage 1 scope (not blocking)

- `docs/progress/stage-1.md` — per plan §9 best practices, a stage completion
  log should be written. Not yet created.
- `docs/01-project-vision.md` — still at Draft v1; may warrant a Final pass.
- `docs/10-terminology.md` — listed as TODO in the plan; glossary not yet written.
- `docs/05-ui-wireframes.md`, `docs/07-testing-strategy.md`,
  `docs/08-deployment.md`, `docs/decisions/` — Stage 2+ artifacts; not
  required for Stage 1 sign-off.
