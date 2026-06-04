# 12 — libdedx Migration Plan (C code: `wasm/dedx_extra.c` → upstream `libdedx`)

> **Status:** Draft v1 — proposal for review.
> **Scope:** Identify which C code currently living in `dedx_web/wasm/dedx_extra.c`
> (and the duplicated TypeScript logic it mirrors) should be migrated upstream
> into the `aptg/libdedx` C library, in what order, and how to sequence the
> work across the open issues and PRs in both repositories.

---

## 1. Why migrate

`wasm/dedx_extra.c` (≈810 LOC) is a layer of C that the web project maintains
**on top of** libdedx because the upstream API does not (yet) expose what a
GUI/frontend needs. Keeping it in `dedx_web` has real costs:

- **Duplication & drift.** The material display-name table exists twice: in C
  (`dedx_get_material_friendly_name`, 151 overrides) and in TypeScript
  (`src/lib/config/material-names.ts`, `MATERIAL_NAME_OVERRIDES`, 151 entries).
  Two copies of the same physics/naming truth will drift.
- **Bug fixes stranded downstream.** `dedx_extra.c` contains a _corrected_
  inverse-stopping-power branch selection that works around a genuine bug in
  upstream `dedx_get_inverse_stp()` (monotone-decreasing curves → `find_min()`
  returns −1 → spurious errors). Every other libdedx consumer (CLI, Python
  bindings, openshieldhit) still hits the original bug.
- **Reuse.** The "flat" lifecycle wrappers (allocate workspace → load config →
  evaluate → free) and the custom-compound helpers are generically useful and
  match the convenience style libdedx already ships in `dedx_wrappers.h`.
- **Thin shims that re-expose internals.** Four `dedx_extra.c` functions
  (`dedx_get_ion_nucleon_number`, `dedx_get_ion_atom_mass`, `dedx_get_density`,
  `dedx_target_is_gas`) are one-line re-exports of `dedx_internal_*` functions
  that **already exist inside libdedx** — they just lack a public header entry.

The end state: `dedx_extra.c` shrinks to (ideally) nothing, libdedx gains a
GUI-friendly public API, and the WASM build links a vendored libdedx with no
local C patches.

---

## 2. Inventory — every symbol in `dedx_extra.c` and where it belongs

Legend for **Target**: `dedx.h` = core public API · `dedx_tools.h` = analysis
tools · `dedx_wrappers.h` = one-call convenience wrappers · _web_ = stays in
`dedx_web` for now.

| #   | Symbol(s)                                                                                                                            | What it does                                                                   | Upstream backing already exists?                                                                                                                                      | Target                                                    | Migration type                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------------------------------------- |
| 1   | `dedx_get_ion_nucleon_number`, `dedx_get_ion_atom_mass`, `dedx_get_density`, `dedx_target_is_gas`                                    | Thin public accessors                                                          | **Yes** — `dedx_internal_get_nucleon` (periodic_table.c), `dedx_internal_get_atom_mass`, `dedx_internal_read_density` & `dedx_internal_target_is_gas` (data_access.c) | `dedx.h`                                                  | **Expose** (publish existing internals) — trivial  |
| 2   | `dedx_get_material_friendly_name` (151-row override table)                                                                           | ALL-CAPS → human display names w/ disambiguation (Water liquid vs vapor, etc.) | No (table only lives here & in TS)                                                                                                                                    | `dedx.h` (`dedx_get_material_display_name`)               | **Move + dedupe** (becomes single source of truth) |
| 3   | `dedx_get_bragg_peak_stp`                                                                                                            | Samples STP on log grid, returns peak (Bragg-peak) value                       | No                                                                                                                                                                    | `dedx_tools.h`                                            | **Move** (generic tool)                            |
| 4   | `dedx_get_inverse_stp_flat` + robust bisection / branch selection                                                                    | Lifecycle wrapper **plus** a corrected inverse-STP algorithm                   | Partial — buggy `dedx_get_inverse_stp()` in `dedx_tools.c`                                                                                                            | core fix in `dedx_tools.c` + wrapper in `dedx_wrappers.h` | **Fix upstream + move wrapper**                    |
| 5   | `dedx_get_inverse_csda_flat`                                                                                                         | Lifecycle wrapper around `dedx_get_inverse_csda`                               | Core fn exists                                                                                                                                                        | `dedx_wrappers.h`                                         | **Move** (convenience wrapper)                     |
| 6   | `dedx_internal_setup_custom_compound`, `dedx_internal_cleanup_custom_compound`                                                       | Build/teardown a `dedx_config` for a user compound (Z[], atoms[], ρ, I)        | Validation path exists (`dedx_validate.c`), but no public config-builder                                                                                              | `dedx.h` (`dedx_config_set_compound` / `_free`)           | **Move + promote to API**                          |
| 7   | `dedx_calculate_custom_forward_flat`                                                                                                 | Forward STP+CSDA table for a custom compound                                   | No public flat path                                                                                                                                                   | `dedx_wrappers.h`                                         | **Move**                                           |
| 8   | `dedx_get_inverse_stp_custom_compound_flat`, `dedx_get_inverse_csda_custom_compound_flat`, `dedx_get_bragg_peak_stp_custom_compound` | Inverse / peak for custom compounds                                            | Builds on #3/#4                                                                                                                                                       | `dedx_wrappers.h`                                         | **Move** (after #3/#4/#6 land)                     |

### Cross-cutting issue surfaced by the migration

- **`double` → `int` atom counts (lines 499–518).** libdedx's `dedx_config`
  stores `elements_atoms` as `int`; the wrapper `lround()`s fractional
  stoichiometry and rejects ≤0. Migrating #6/#7 upstream is the moment to
  decide whether libdedx should accept **fractional stoichiometry or mass
  fractions** directly. This ties into libdedx **#6** (per-element I-value
  override) and the recent custom-compound fixes (#105, #107).

---

## 3. Migration phases

Each phase is one (or a few) self-contained libdedx PR(s), each releasable on
its own, ordered so the web side can adopt incrementally and `dedx_extra.c`
shrinks monotonically.

### Phase A — Publish existing internals (inventory #1) · _libdedx, ~1 small PR_

Add public declarations + thin public definitions for nucleon number, atom
mass, target density, and is-gas. The implementations already exist as
`dedx_internal_*`; this only adds the header surface (and optionally renames
the shims). Lowest risk, unblocks web issues **#175** (display density) and
**#176** (custom density) cleanly.

- Files: `include/dedx.h`, `src/dedx.c` (or `dedx_data_access.c`), tests,
  `examples/`.
- Web follow-up: delete the four shims from `dedx_extra.c`; point the TS
  density service at the new exports.

### Phase B — Material display names (inventory #2) · _libdedx, 1 PR_

Promote `dedx_get_material_friendly_name` → public
`dedx_get_material_display_name(int material)` in libdedx. Make the C table the
**single source of truth**; regenerate / replace the TS `MATERIAL_NAME_OVERRIDES`
from it (or expose it through WASM and drop the TS copy).

- Decide: does TS keep its `formatMaterialName()` title-casing for the
  _fallback_ path, or does C return fully-formatted names for everything?
  Recommendation: C owns overrides + a documented fallback; TS keeps only
  generic title-casing for un-overridden elemental names.
- Web follow-up: replace `MATERIAL_NAME_OVERRIDES` with a build-time generated
  table or a runtime WASM call; add a CI check that the two never drift.

### Phase C — Inverse-STP core fix + Bragg-peak tool (inventory #3, #4-core) · _libdedx, 1–2 PRs_

The substantive physics PR. Two parts:

1. **Fix `dedx_get_inverse_stp()` in `dedx_tools.c`:** handle monotone
   (no interior Bragg peak) curves where `find_min()` returns −1, and fix the
   `side` semantics so `side ∈ {0,1}` selects low/high branch as documented
   (currently `side < 0` ⇒ low branch, which `{0,1}` never triggers). Port the
   sampled-peak + branch-aware bisection from `dedx_extra.c`.
2. **Add `dedx_get_bragg_peak_stp(ws, cfg, ...)`** (or a flat variant) to
   `dedx_tools.h`.

- This benefits **all** libdedx consumers, not just the web. Add regression
  tests for proton/water ICRU49 (the monotone case named in the code comment).
- Web follow-up: nothing yet — the _flat_ wrappers move in Phase D.

### Phase D — Flat lifecycle wrappers (inventory #4-wrapper, #5) · _libdedx, 1 PR_

Add `dedx_get_inverse_stp_flat` / `dedx_get_inverse_csda_flat` (and the
Bragg-peak flat variant) to `dedx_wrappers.h`, matching the existing
`dedx_get_simple_stp_for_program` style (alloc → load → call → free).

- Web follow-up: delete the corresponding functions from `dedx_extra.c`;
  update `wasm/contract-manifest.json` and `docs/06-wasm-api-contract.md`.

### Phase E — Custom-compound config builder + flat wrappers (inventory #6, #7, #8) · _libdedx, 1–2 PRs_

The largest phase. Promote the config-builder (`dedx_config_set_compound` /
`dedx_config_free_compound`) to public API, then add the forward / inverse /
peak flat wrappers. Resolve the `int` vs fractional stoichiometry question
here (see §2). Coordinate with libdedx **#6** and the existing
`examples/dedx_custom_compound.c`.

- Web follow-up: delete the custom-compound block from `dedx_extra.c`; update
  manifest + contract docs. At this point `dedx_extra.c` is empty or gone.

### Phase F — Adjacent GUI API (not in `dedx_extra.c`, but the reason it exists) · _libdedx #79_

The web selector currently builds valid `(program, ion, material)`
combinations in TypeScript by intersecting `dedx_get_*_list()` results.
libdedx **#79** already proposes the upstream API for this
(`dedx_is_valid_combination`, `dedx_get_valid_programs/ions/materials`, count
helpers). Landing it removes a second pile of duplicated logic from the web and
directly serves web issues **#504**, **#147**, **#51**. Schedule alongside or
after Phase A.

---

## 4. Per-repo issue & PR strategy

### 4.1 libdedx — issues (filed)

Tracking epic **[libdedx#118](https://github.com/APTG/libdedx/issues/118)**
("Migrate dedx_web `dedx_extra.c` helpers upstream") links the per-phase child
issues below as native sub-issues. It also cross-references the broader health
review **[#108](https://github.com/APTG/libdedx/issues/108)** (the C-API
counterpart to that issue's Python-binding/ecosystem items).

| Phase | libdedx issue                                                                                     | Links / supersedes                     |
| ----- | ------------------------------------------------------------------------------------------------- | -------------------------------------- |
| A     | **#119** — Expose nucleon/atom-mass/density/is-gas in public header                               | enables web #175, #176                 |
| B     | **#120** — Public `dedx_get_material_display_name` + dedupe friendly names                        | relates to #48 (units/labels hygiene)  |
| C     | **#121** — Fix `dedx_get_inverse_stp` branch selection for monotone curves; add Bragg-peak tool   | **bug fix** — highest physics value    |
| D     | **#122** — Add flat inverse/Bragg-peak convenience wrappers                                       | extends `dedx_wrappers.h`              |
| E     | **#123** — Public custom-compound config builder + flat wrappers; decide fractional stoichiometry | relates to **#6**, builds on #105/#107 |
| F     | already **#79** (query API) — no new issue, just prioritize                                       | serves web #504/#147/#51               |

Notes on existing libdedx issues:

- **#79** (query API) — directly on the critical path for the web GUI; do early.
- **#86** (thread-safety) — relevant because the flat wrappers allocate a fresh
  workspace per call (already isolated). Note in Phase D/E that the new wrappers
  are re-entrant; don't block on the broader global-state refactor.
- **#51** (missing program/ion/material combinations) — overlaps #79; resolve
  together.
- **#48** (mass-stopping-power units) — keep the documented unit (`MeV cm²/g`)
  consistent in every new docstring added during B–E.
- **#6** (per-element I-value override) — decide in Phase E whether the public
  compound builder accepts per-element I-values (the wrapper already plumbs a
  compound-level `iValue`).
- **#95** (Bethe nucleon mass) and **#96** (table-generation script) are
  independent; not blockers, but Phase C tests should pin reference values so a
  later #95 change is caught.
- Before landing Phase A, check for in-flight libdedx PRs that touch the same
  public headers (`dedx.h` / `dedx_tools.h` / `dedx_wrappers.h`) and rebase
  Phase A after them; Phase A is otherwise self-contained and can go first.

### 4.2 dedx_web — sequencing against the migration

For each phase, the web work is a _follow-up_ PR that bumps the libdedx
submodule and removes the now-duplicated C/TS code:

1. Bump `libdedx/` submodule to the release/commit containing the phase.
2. Delete migrated functions from `wasm/dedx_extra.c`.
3. Update `wasm/contract-manifest.json` (the JS-facing ABI source of truth)
   and `docs/06-wasm-api-contract.md` (kept in sync by
   `scripts/check-wasm-contract-docs.cjs`).
4. Re-run `wasm/verify.mjs` to confirm exports/back-compat.
5. For Phase B: replace `MATERIAL_NAME_OVERRIDES` and add a drift guard.

Relevant **open web issues** that this unblocks or touches: **#175** (display
density), **#176** (custom density) → Phase A; **#504 / #147 / #51-equiv
selector** → Phase F; **#663** (CR39 STP), **#480** (projected/CSDA range) →
benefit from Phase C/E once correctness moves upstream. Before opening a
migration PR, sequence it after any in-flight web PR that touches
`wasm/dedx_extra.c`, `wasm/contract-manifest.json`, or
`docs/06-wasm-api-contract.md`; unrelated work (Svelte refactors, dependabot
bumps) does not conflict and can proceed in parallel.

> ⚠ **Submodule note:** the migration only "completes" on the web side when the
> `libdedx/` submodule points at released upstream code. Until a phase is
> merged + released in libdedx, the web copy in `dedx_extra.c` must stay. Never
> delete a web shim before its libdedx replacement is in the pinned submodule.

---

## 5. Recommended order (dependency-sorted)

```
Phase A (publish internals)        ──┐
Phase F / libdedx #79 (query API)  ──┤ independent, do first — low risk, unblocks web GUI
Phase C (inverse-stp fix + peak)   ──┘ highest physics value (real bug fix)
        │
Phase B (display names + dedupe)     parallel-able with A/C
        │
Phase D (flat wrappers)            ← needs C
        │
Phase E (custom compounds)         ← needs C, D, and the stoichiometry decision
```

**Suggested first concrete step:** open the libdedx tracking issue + the Phase A
issue, and land Phase A (publish the four internal accessors). It is the
smallest, lowest-risk PR, immediately deletes code from `dedx_extra.c`, and
unblocks two open web issues (#175, #176).

---

## 6. Open decisions for maintainers (need a call before coding)

1. **Display-name ownership (Phase B):** does C return fully formatted names, or
   C-overrides + TS title-case fallback? (Affects whether TS keeps any naming
   logic.)
2. **Fractional stoichiometry (Phase E):** keep `int` atom counts (status quo,
   wrapper rounds) or extend libdedx to accept `double` atoms / mass fractions?
3. **Per-element I-values (Phase E / libdedx #6):** expose in the public
   compound builder now, or defer?
4. **Naming conventions:** `dedx_get_material_display_name` vs `_friendly_name`;
   `dedx_config_set_compound` vs `dedx_make_compound_config`. Pick to match
   existing libdedx style.
5. **Release cadence:** one libdedx release per phase (lets the web submodule
   bump incrementally) vs batching A–C into one release.
