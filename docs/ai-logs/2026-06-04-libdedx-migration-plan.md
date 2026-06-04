# 2026-06-04 — libdedx migration plan

## Session Narrative

### Prompt 1: "Some of the C code could be migrated to libdedx — make a good list of what to migrate and a plan, and how to proceed with libdedx and webdedx issues and PRs."

**AI response**: Researched the C surface that dedx_web carries on top of the
libdedx submodule. The only non-vendored C in the repo is the shim
`wasm/dedx_extra.{c,h}` (~810 LOC), compiled with `libdedx.a` in
`wasm/build.sh`. Read it in full plus the WASM API contract
(`06-wasm-api-contract.md` §4.4/4.5/§11), ADR 003, `contract-manifest.json`,
and the inverse-STP bisection ai-log.

Classified the shim into five migration candidates and ranked them by
value/risk:

- **A — metadata accessors** (`dedx_get_ion_nucleon_number`,
  `dedx_get_ion_atom_mass`, `dedx_get_density`, `dedx_target_is_gas`): pure
  re-exports of libdedx internals via `extern` forward-decls → promote to
  public libdedx API. Lowest risk; removes the most fragile coupling.
- **B — inverse-STP bug fix**: `dedx_get_inverse_stp_flat` is a *corrected
  re-implementation* of `dedx_get_inverse_stp()` (find_min returns -1 for
  monotone curves → negative energies; `side<0` mapping never matches
  `side∈{0,1}`). Highest physics value; upstream the fix + tests.
- **C — flat inverse + Bragg-peak utilities**: stateless API useful to all
  consumers.
- **D — custom-compound flat API**: largest surface; flagged the `double→int`
  atom-count rounding as a decision (keep int vs widen for weight fractions,
  ties to #676/#682/#663).
- **E — friendly material names**: dead C code today; recommended fixing names
  in libdedx data over exporting a function; otherwise defer.

Wrote `docs/12-libdedx-migration-plan.md` with the ranked list, a phased
behaviour-preserving rollout (anchored on the stable `LibdedxService`
interface), the cross-repo workflow (libdedx PR → submodule bump →
`dedx_extra` trim → docs/verify), an issue/PR strategy for both repos, risks
(Emscripten empty-export footgun, `ion_a`/`*err` ordering, float/double
widths, `main` branch tracking), and open questions.

**Note for follow-up:** `APTG/libdedx` was **not in this session's GitHub
scope** (only `APTG/dedx_web`), and no `list_repos`/`add_repo` tool was
available, so the libdedx-side issues/PRs and live issue/PR listings could not
be created or read here. The plan documents this and the precedent
(libdedx#105 → dedx_web #662 bump). No GitHub issues/PRs were created.

## Tasks

### Author libdedx migration plan

- **Status**: completed
- **Stage**: Docs (cross-cutting; relates to ADR 003 / WASM)
- **Files changed**:
  - `docs/12-libdedx-migration-plan.md` (new)
  - `docs/README.md` (index row)
  - `CHANGELOG-AI.md` (entry)
  - `docs/ai-logs/2026-06-04-libdedx-migration-plan.md` (this log)
- **Decision**: Keep the `LibdedxService` TS interface as the migration
  invariant — every phase moves implementation from `dedx_extra.c` into
  libdedx with no TS API change, making each phase independently revertible.
- **Decision**: Recommend doing metadata accessors (Phase A) first as a
  low-risk dry-run of the whole upstream→bump→trim loop, then the inverse-STP
  fix (Phase B) for the correctness win.
- **Issue**: Creating the actual libdedx issues/PRs is blocked on repo scope;
  the webdedx tracking issue and per-phase follow-ups still need to be opened.
</content>
