# libdedx Migration Plan — Upstreaming the `wasm/dedx_extra` shim

> **Status:** Draft v1 (4 June 2026)
>
> This document lists the C code currently carried in **dedx_web**
> (`wasm/dedx_extra.{c,h}`) that should be migrated **upstream into
> libdedx**, ranks it by value/risk, and defines the cross-repo workflow
> for landing each piece through libdedx PRs and webdedx submodule bumps.

---

## 1. Context

The libdedx C library is a git submodule (`libdedx/`, branch `main`) and is
kept **unmodified** — see [ADR 003](decisions/003-wasm-build-pipeline.md). To
expose functionality the public libdedx API does not provide, dedx_web carries
a local C shim, `wasm/dedx_extra.{c,h}` (~810 LOC), compiled alongside
`libdedx.a` in the Emscripten build (`wasm/build.sh`).

The shim does three different jobs, and only the first is genuinely a
"web-only" concern:

1. **Packaging** — flattening libdedx's stateful workspace/config API into
   self-contained calls that JavaScript can drive without managing C pointers.
2. **Exposure** — re-publishing libdedx _internal_ functions that are linked
   but not declared in the public headers (forward-declared with `extern`).
3. **Correctness** — a re-implementation of `dedx_get_inverse_stp()` that
   fixes a real bug in libdedx's `dedx_tools.c` (see §4, Phase 2).

Jobs 2 and 3 are libdedx gaps that happen to be patched downstream. They
belong upstream so that **every** libdedx consumer benefits and dedx_web stops
depending on internal symbols and a forked algorithm.

### 1.1 The invariant that makes this safe

ADR 003 already states the goal: _"When libdedx's public API eventually
exposes these functions natively, the `dedx_extra` wrappers can be removed
with no changes to the TypeScript layer (the service interface is stable)."_

The **`LibdedxService` interface in [`06-wasm-api-contract.md`](06-wasm-api-contract.md)
does not change** in any phase of this plan. Migration moves the
_implementation_ from `wasm/dedx_extra.c` into `libdedx/`; the TS wrapper
(`src/lib/wasm/libdedx.ts`), its mock, and all callers are untouched except
for the C symbol name a few `ccall`s resolve. This invariant is the contract
that lets us land the work incrementally and revert any single phase.

### 1.2 Repo access note

At the time of writing, **`APTG/libdedx` is not in this session's GitHub
scope** (only `APTG/dedx_web` is). The libdedx-side issue/PR work in §6 must
be done either after adding `APTG/libdedx` to the session, or from a session
scoped to that repo. The precedent already exists:
[APTG/libdedx#105](https://github.com/APTG/libdedx/pull/105) (the custom-compound
double-call fix) was merged upstream and picked up via submodule bump
(dedx_web #662) — the same fix-upstream-then-bump loop applies here.

---

## 2. What `dedx_extra` contains today

| Block                                    | Symbols                                                                                                                                                                    | What it really is                                                                                                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Metadata accessors                       | `dedx_get_ion_nucleon_number`, `dedx_get_ion_atom_mass`, `dedx_get_density`, `dedx_target_is_gas`                                                                          | Thin re-exports of libdedx **internal** functions (`dedx_internal_get_nucleon`, `…_get_atom_mass`, `…_read_density`, `…_target_is_gas`) that are linked but not in a public header.                       |
| Inverse STP (fixed)                      | `dedx_get_inverse_stp_flat`                                                                                                                                                | A **re-implementation** of `dedx_get_inverse_stp()` with sample-based Bragg-peak detection + two-branch bisection + corrected `side` convention. Fixes two upstream bugs (see §4 Phase 2).                |
| Inverse CSDA (flat)                      | `dedx_get_inverse_csda_flat`                                                                                                                                               | Lifecycle wrapper around the core `dedx_get_inverse_csda()` (allocate workspace → set `ion_a` → load config → call → free).                                                                               |
| Bragg-peak STP                           | `dedx_get_bragg_peak_stp`                                                                                                                                                  | Samples 300 log-spaced energies to return the peak mass stopping power. No upstream equivalent.                                                                                                           |
| Custom-compound forward + inverse + peak | `dedx_calculate_custom_forward_flat`, `dedx_get_inverse_stp_custom_compound_flat`, `dedx_get_inverse_csda_custom_compound_flat`, `dedx_get_bragg_peak_stp_custom_compound` | Same lifecycle pattern but for user-defined materials (parallel `elements_id` / `elements_atoms` arrays).                                                                                                 |
| Custom-compound helpers                  | `dedx_internal_setup_custom_compound`, `dedx_internal_cleanup_custom_compound`                                                                                             | Build/tear down a `dedx_config` for a compound. Contains the **`double → int` atom-count rounding** workaround (libdedx stores `elements_atoms` as `int`).                                                |
| Friendly material names                  | `dedx_get_material_friendly_name` (static, **not exported**)                                                                                                               | ~130-entry override table mapping ALL-CAPS run-on libdedx names to human-readable, disambiguated names (e.g. `276 → "Water (liquid)"`). Pure presentation; currently dead C code (the TS side does this). |

---

## 3. Migration candidate list (ranked)

Ranked by **value ÷ risk**. "Value" = how much it helps _all_ libdedx users
and removes fragile coupling; "risk" = chance of changing physics output or
breaking the build.

| #   | Candidate                                                  | libdedx target                                                                       | Value  | Risk        | Verdict                              |
| --- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------ | ----------- | ------------------------------------ |
| A   | 4 metadata accessors (nucleon, atom mass, density, is-gas) | Public decls in `dedx.h` wrapping the existing internals                             | High   | Very low    | **Migrate first**                    |
| B   | Inverse-STP bug fix (monotone curves + `side` convention)  | Fix inside `dedx_get_inverse_stp()` in `dedx_tools.c`                                | High   | Medium      | **Migrate (highest physics value)**  |
| C   | Flat/stateless inverse + Bragg-peak API                    | New `dedx_*_flat` / `dedx_get_bragg_peak_stp` in `dedx_wrappers.*` + `dedx_tools.*`  | Medium | Low         | Migrate                              |
| D   | Custom-compound flat API + fractional stoichiometry        | New compound entry points; optional `double` atom counts in `dedx_config`            | Medium | Medium-High | Migrate (phased; decide on `double`) |
| E   | Friendly material names                                    | Fix the **names in libdedx data tables**, or add `dedx_get_material_friendly_name()` | Low    | Low         | Defer / prefer data fix (see §5.5)   |

---

## 4. Phased plan

Each phase is independently shippable and revertible. The exit criterion for
every phase is the same: **libdedx PR merged → submodule bumped → matching
lines deleted from `dedx_extra.c` + `build.sh` exports → docs + verify
updated → `pnpm test` and the WASM contract checks green**.

### Phase 0 — Groundwork (do once)

- Add `APTG/libdedx` to the working set (session scope or a dedicated session).
- Stand up a **behaviour-preserving contract test**: a small Node/`verify.mjs`
  harness that runs the seven `serviceBacking` symbols from
  [`wasm/contract-manifest.json`](../wasm/contract-manifest.json) against known
  fixtures (e.g. PSTAR proton/water STP = 7.28614 at 100 MeV; ICRU49 proton/water
  1 keV/µm inverse in 40–120 MeV). Run it against **both** the current shimmed
  build and each candidate upstream build so every migration is provably a
  no-op for outputs.
- Decide the libdedx contribution mechanics (write access vs fork PRs, release/
  tagging cadence, whether webdedx tracks `main` or a tag).

### Phase 5.A — Metadata accessors _(start here)_

The four accessors merely re-publish internals. Lowest risk, immediately
removes the `extern int dedx_internal_*` forward declarations — the most
fragile coupling (ADR 003's "internal struct layout changes" risk).

- **libdedx:** declare `dedx_get_ion_nucleon_number(int)`,
  `dedx_get_ion_atom_mass(int)`, `dedx_get_density(int, int*)`,
  `dedx_target_is_gas(int)` in `dedx.h`; implement them in the same TU as the
  internals (or simply promote the internals to public). Add to the public API
  test.
- **webdedx:** delete the four wrappers + their `extern` decls from
  `dedx_extra.c`; the `EXPORTED_FUNCTIONS` names are unchanged, so
  `build.sh`, `libdedx.ts`, and `06-wasm-api-contract.md` §4.5/§11 only need
  the "thin wrapper" rows moved into §4.4 (now public). Bump submodule.

### Phase 5.B — Inverse-STP correctness fix _(highest physics value)_

`dedx_get_inverse_stp_flat` is not packaging — it is a corrected algorithm.
Two upstream bugs (documented in
[`ai-logs/2026-05-08-inverse-stp-bisection-fix.md`](ai-logs/2026-05-08-inverse-stp-bisection-fix.md)):

- **Bug A:** `find_min()` returns `-1` for monotonically-decreasing STP curves
  (e.g. ICRU49 proton/water); the caller uses `-1` as an energy endpoint,
  producing negative midpoints and a spurious error.
- **Bug B:** `side < 0 → low branch` mapping never matches the `side ∈ {0,1}`
  convention the callers use, so both branches return the high-energy root.

Plan: upstream the sample-based peak detection + two-branch bisection into
`dedx_get_inverse_stp()` itself (or expose `find_min`/a peak helper so the
core routine can be fixed without sampling). Add libdedx unit tests for the
monotone (ICRU49) and Bragg-peak (PSTAR) cases. Once merged, `dedx_extra` can
either drop its copy and call the fixed core via a flat wrapper (Phase 5.C) or
keep only the lifecycle shell.

> This is the single most important item — it is a physics-correctness fix
> currently living only in the web app's private shim.

### Phase 5.C — Flat inverse + Bragg-peak utilities

A stateless inverse API (`dedx_get_inverse_stp_flat`,
`dedx_get_inverse_csda_flat`) and a Bragg-peak finder
(`dedx_get_bragg_peak_stp`) are useful to any libdedx consumer, not just WASM.
Mirror the existing stateless **forward** API in `dedx_wrappers.*`; put the
peak finder in `dedx_tools.*`. After merge, delete the bodies from
`dedx_extra.c` (names already match the exports, so no ABI churn).

### Phase 5.D — Custom-compound flat API

Largest surface. Migrate `dedx_calculate_custom_forward_flat` and the three
custom inverse/peak entry points, plus the setup/cleanup helpers, into a
public libdedx "compound" API.

**Decision needed — atom-count type.** The shim accepts `double` atom counts
and `lround()`s them into libdedx's `int elements_atoms`, rejecting fractional
stoichiometry. Two options:

1. **Keep `int` upstream** — migrate as-is; the rounding stays a documented
   wrapper-boundary behaviour.
2. **Widen to `double` / add weight-fraction input upstream** — lets libdedx
   accept fractional formulas natively. This unblocks the weight-fraction /
   complex-ratio compound work already shipped UI-side (dedx_web #676, #682)
   and the CR-39 check (#663), which currently normalise to integer ratios.

Recommend option 2 as a **separate** libdedx feature PR after the straight
migration lands, so the move stays behaviour-preserving first.

### Phase 5.E — Friendly material names _(defer / reconsider)_

`dedx_get_material_friendly_name` is dead C code today (TS does the work). It
is the most debatable migration: display formatting is arguably a UI concern.
However, the _root problem_ — ALL-CAPS run-on names like
`TISSUE_EQUIVALENTGAS_METHANEBASED` and the water-liquid/vapor ambiguity — is a
**data-quality issue in libdedx** that affects all consumers. Preferred
resolution: fix the names (and add explicit phase disambiguation) in libdedx's
material tables, which removes the need for _both_ the C and TS override
tables. If a function is wanted instead, exporting
`dedx_get_material_friendly_name()` is low-risk but low-value. Either way,
keep `material-names.ts` as the source of truth until libdedx ships verified
names, then collapse the duplication.

---

## 5. Cross-repo workflow per item

```
libdedx                                   dedx_web
─────────────────────────────────────     ─────────────────────────────────────
1. issue: "expose X / fix Y"
2. PR: implement + unit test  ───merge──▶  3. bump submodule (libdedx/ SHA)
                                           4. delete migrated body from
                                              wasm/dedx_extra.c (+ extern decls)
                                           5. update wasm/build.sh exports only
                                              if a symbol name changed
                                           6. update docs:
                                              - 06-wasm-api-contract.md §4.4/4.5/§11
                                              - decisions/003 (dedx_extra rationale)
                                           7. update wasm/verify.mjs +
                                              contract-manifest.json
                                           8. rebuild WASM, run contract test,
                                              pnpm test → green
                                           9. CHANGELOG-AI.md + ai-log entry
```

Key guardrails already in the repo that keep this honest:

- [`wasm/contract-manifest.json`](../wasm/contract-manifest.json) — single
  source of truth for inverse-wrapper ABI symbols; consumed by `verify.mjs` and
  `scripts/check-wasm-contract-docs.cjs`.
- ADR 003 §Consequences flags the **EXPORTED_FUNCTIONS ↔ `LibdedxService`
  drift** risk: a missing underscore-prefixed symbol fails only at first call.
  After each phase, run the full-service smoke path so every method is exercised.

---

## 6. Issue / PR strategy

**webdedx (this repo):**

- Open one **tracking issue** — _"Upstream `wasm/dedx_extra` shims into
  libdedx"_ — with a checklist of Phases A–E, each linking its libdedx PR and
  its submodule-bump PR. This file is the design doc it references.
- One follow-up issue per phase for the bump + `dedx_extra` trim + docs sync,
  so each is a small reviewable PR.
- Link the existing related issues so they ride along: #175/#176 (density
  display/override — Phase A's `dedx_get_density`), #663/#676/#682 (compound
  stoichiometry — Phase D option 2).

**libdedx (needs scope/session):**

- One issue + PR per phase. Phase A and B are independent and can go in
  parallel; C depends conceptually on B (flat inverse should call the fixed
  core); D is standalone; E is optional.
- Each libdedx PR must add a unit test reproducing the webdedx fixture it
  replaces (esp. Phase B's ICRU49 monotone + PSTAR peak cases) so the behaviour
  is pinned in libdedx, not only in dedx_web's E2E suite.
- Reference the originating dedx_web shim code and ai-logs in the PR body for
  reviewer context.

**Sequencing recommendation:** A → B → C → D, with E deferred. Land A first as
a low-risk dry run of the whole loop (proves Phase 0 tooling), then B for the
correctness win.

---

## 7. Risks & gotchas

- **Silent empty-export footgun.** Emscripten 5.x needs JSON-quoted
  `EXPORTED_FUNCTIONS`; an unquoted/typo'd name links cleanly but yields a
  ~241-byte WASM with no exports (ADR 003). Verify exports after every rebuild.
- **`ion_a` ordering.** The flat wrappers set `cfg.ion_a` from the nucleon
  number _before_ `dedx_load_config` because `dedx_get_inverse_csda` checks
  `ion_a <= 0` on entry. Any upstreamed flat/compound API must preserve that
  ordering, or move the responsibility into `dedx_load_config`.
- **`*err` zeroing.** `dedx_get_csda` / `dedx_get_inverse_csda` check
  `*err != 0` on entry; the shim zeroes `*err` before the bisection loop.
  Preserve in the upstreamed versions.
- **`float` vs `double`.** Core libdedx evaluation is `float`; the flat
  wrappers compute bisection in `double` and downcast at the `dedx_get_stp`
  boundary. Keep the same widths to avoid changing the last ULPs of results.
- **Submodule branch.** dedx_web tracks libdedx `main` (the old `master` was
  deleted; see CHANGELOG-AI 2026-05-29). Bumps must target `main`.
- **WASM not in CI for unit tests.** The mock covers unit/integration; only E2E
  needs real binaries. Each phase still needs a local/CI WASM rebuild + the
  contract test before merge.

---

## 8. What stays in dedx_web (out of scope)

- The TypeScript `LibdedxService`, its mock, unit conversions
  (`unit-conversions.ts`), spline interpolation, JS-side plot grids — all
  explicitly JS-side per the API contract.
- The buffer/heap marshalling layer in `libdedx.ts` (the whole point of the
  flat API is to keep pointer lifecycle out of JS).
- `material-names.ts` until/unless Phase E lands upstream names.

---

## 9. Open questions

1. libdedx contribution model: direct write access or fork PRs? Release tags or
   track `main`?
2. Phase D: widen `elements_atoms` to `double` / add weight-fraction input
   upstream, or keep integer-only and document the rounding?
3. Phase E: fix names in libdedx data, export a friendly-name function, or
   leave presentation entirely in TS?
4. Should the flat inverse API replace the stateful core call sites inside
   libdedx too, or live alongside them as convenience wrappers only?

---

## References

- [`wasm/dedx_extra.c`](../wasm/dedx_extra.c) / [`.h`](../wasm/dedx_extra.h) — the shim being migrated
- [`wasm/contract-manifest.json`](../wasm/contract-manifest.json) — ABI source of truth
- [ADR 003 — WASM Build Pipeline](decisions/003-wasm-build-pipeline.md) — `dedx_extra` rationale and drift risks
- [`06-wasm-api-contract.md`](06-wasm-api-contract.md) §4.5, §11 — thin-wrapper inventory
- [`ai-logs/2026-05-08-inverse-stp-bisection-fix.md`](ai-logs/2026-05-08-inverse-stp-bisection-fix.md) — Phase B bug analysis
- [APTG/libdedx#105](https://github.com/APTG/libdedx/pull/105) — precedent: upstream fix + submodule bump
  </content>
  </invoke>
