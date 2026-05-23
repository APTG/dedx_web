# 2026-05-22 — URL Schema v2 Design Doc (Issue #554)

## Session Narrative

### Prompt 1: Implement issue #554 — URL-sharing schema v2

**AI response**: Read the issue, all blocked sub-issues (#555–#561), and the
existing shareable-urls spec files to understand the full v2 schema delta.
Key findings:
- The v2 schema renames three core params (`particle=` → `particleId=`, etc.)
- `qfocus=stp|csda|both` (3-state) is replaced by `qshow=stp|range` (2-state)
- `hidden=` / `hidden_programs=` is removed entirely (Columns dropdown gone)
- New params: `uanchor=`, `runit=`, `sunit=`, `mode=forward|range|inverse-stp`,
  `istpbranch=`, `tip_seen=`, `across=`
- `imode=csda|stp` is replaced by `mode=range|inverse-stp`

Created three deliverables:
1. `docs/04-feature-specs/url-schema.md` — canonical v2 schema with one
   worked example per param, inline-unit grammar, migration rules, and a
   cross-spec consistency checklist.
2. `docs/decisions/006-url-schema-v2.md` — ADR justifying the `hidden=` drop
   and the `qfocus=` → `qshow=` rename.
3. Seven new unit tests in `calculator-url.test.ts` that serve as regression
   anchors for the v1→v2 migration (no behaviour change; documents current
   v1 decoder behaviour against the v2 spec).

## Tasks

### Prompt 2 (2026-05-23): drop *Id rename, extend runit, address Copilot review

**User feedback:** PR #565 got a Copilot review. Maintainer (grzanka) doesn't
want the `particle=` → `particleId=` rename (and the parallel `material=` →
`materialId=`, `program=` → `programId=` renames). Also asked to extend
`runit=` to include `dm` and `km`. Asked to update issue #554 description with
the decision and check the impact on other linked issues in #552.

**AI response:**

1. Reverted the `Id` suffix rename in `url-schema.md` and ADR 006. The §3.2,
   §3.3, §3.4 param tables now show `particle=`, `material=`, `program=` as
   "unchanged from v1". ADR 006 §3 records the rejection rationale (no
   payoff vs. high link-rot cost; reviewer pushback).
2. Extended `runit=` to `nm|um|mm|cm|dm|m|km` (added `dm` and `km`).
3. Updated §3.16 / §3.17 split per Copilot review #4: §3.16 lists genuinely
   unchanged v1 params still emitted in v2; new §3.17 lists deprecated v1
   params accepted for migration only.
4. Fixed §3.7 worked-example bug (Copilot review #3): removed the nonsense
   "mode=range&mode=advanced" example + corrected cross-reference to §4.2.
5. Made `energies=` and `ivalues=` conditional on the active `mode=` in the
   canonical URL form (§4.1, Copilot review #5).
6. Renamed two misleading migration-fixture test titles (Copilot reviews
   #1 and #2). The tests still assert the current v1 decoder behaviour; the
   new names make it clear that the v2 mapping lands in #561.
7. Updated test-file top-of-file doc comment to drop the *Id rename mention.
8. Updated issue #554 description to record the revision decisions and
   pointed at the revised PR/ADR.
9. Checked all linked sub-issues in #552 for impact: only #555 mentions
   `?particleId=`/`?materialId=`/`?programId=` (in its "Existing behaviour
   preserved" acceptance criterion). Posted a comment on #555 noting that
   the schema-doc revision keeps the v1 names, so the acceptance criterion
   should read `?particle=`/`?material=`/`?program=`. No other sub-issue
   needs to change.

All 60 calculator-url unit tests continue to pass.

### Write url-schema.md

- **Status**: completed
- **Stage**: Foundations (pre-#555)
- **Files changed**: `docs/04-feature-specs/url-schema.md` (new)
- **Decision**: Followed existing `docs/decisions/` ADR convention rather than
  creating a new `docs/05-adr/` directory (the issue specified `docs/05-adr/`
  but the project convention is `docs/decisions/`).
- **Decision**: `qshow=` is omitted from the canonical URL when both quantities
  are visible (absence = default), unlike v1 which always emitted `qfocus=both`.
  This is consistent with the general "omit defaults" principle.
- **Decision**: Advanced/basic picker mode is no longer a URL param in v2 —
  it is inferred from the presence of `programs=` vs `programId=`. The old
  `mode=advanced` literal is accepted on read for migration but not emitted.

### Write ADR 006

- **Status**: completed
- **Stage**: Foundations (pre-#555)
- **Files changed**: `docs/decisions/006-url-schema-v2.md` (new)

### Update calculator-url.test.ts

- **Status**: completed
- **Stage**: Foundations (pre-#555)
- **Files changed**: `src/tests/unit/calculator-url.test.ts`
- **Decision**: Added a top-of-file doc comment pointing to the schema doc and
  ADR. Added a new `describe` block "v1 → v2 migration fixture" with 7 tests
  that document the mapping from old v1 param names to new v2 semantics. These
  tests verify the current v1 decoder accepts v1 URLs correctly; they will
  be updated to assert v2 canonical output once the v2 encoder lands in
  #555–#561.
- **Issue**: The tests for `qfocus=csda` and `hidden_programs=` pass because
  the v1 decoder handles them; the assertion documents v1 behaviour with a
  comment noting the expected v2 behaviour. These fixtures must be re-checked
  when the v2 decoder lands.
