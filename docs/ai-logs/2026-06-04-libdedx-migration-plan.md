# 2026-06-04 — libdedx migration plan for `wasm/dedx_extra.c`

## Session Narrative

### Prompt 1: Inventory `wasm/dedx_extra.c` and plan its migration upstream into libdedx

**AI response**: Added `docs/12-libdedx-migration-plan.md`, a phased plan to
migrate the C helpers currently living in `wasm/dedx_extra.c` (810 LOC) upstream
into `libdedx`. The plan includes a per-symbol inventory mapping each helper to
its intended upstream home (`dedx.h` / `dedx_tools.h` / `dedx_wrappers.h`), and
flags two concrete wins:

- the duplicated material display-name table (the C `MATERIAL_NAME_OVERRIDES`
  vs `src/lib/config/material-names.ts`), and
- the inverse-STP branch-selection bug worked around locally that should be
  fixed upstream.

Work is sequenced across libdedx issues (#79, #51, #48, #6, #86, #95) and the
dedx_web follow-ups (#175, #176, #504). Filed the upstream tracking epic
libdedx#118 with per-phase sub-issues libdedx#119–#123 (Phase F = existing #79),
cross-referenced to the health-review epic #108 to avoid duplication. Indexed
the new doc in `docs/README.md`.

### Prompt 2: Address PR #704 review comments

**AI response**: Reworked two passages in `docs/12-libdedx-migration-plan.md`
that asserted point-in-time PR state (Copilot review). Replaced the
"no open libdedx PRs" claim and the enumerated open web PR range (#696–#703)
with durable sequencing instructions keyed on the files a PR touches rather than
on ephemeral PR numbers. Added this session log and its changelog `Log:` link to
satisfy the documented changelog contract.

## Tasks

### libdedx migration plan

- **Status**: completed
- **Stage**: Docs / libdedx migration (cross-repo, supports Stage 8 follow-ups)
- **Files changed**: `docs/12-libdedx-migration-plan.md`, `docs/README.md`,
  `CHANGELOG-AI.md`, `docs/ai-logs/2026-06-04-libdedx-migration-plan.md`,
  `docs/ai-logs/README.md`
- **Decision**: The plan documents sequencing as a rule (check what files an
  in-flight PR touches) rather than enumerating current PR numbers, so it does
  not go stale as PRs merge/close.
- **Issue**: Upstream libdedx phases must be merged + released and the
  `libdedx/` submodule re-pinned before any web shim in `dedx_extra.c` is
  deleted.
