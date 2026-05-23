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

### Prompt 3 (2026-05-23): rename ivalues=→lookups=; trim unchanged-from-v1 sections

**User feedback:** rename `ivalues=` to something that won't be confusing
with the I-value from the Bethe-Bloch formula. Also, skip so much
description of the unchanged stuff wrt v1. Adjust the PR description to
match. Remember the AI logs.

**AI response:**

1. **Rename `ivalues=` → `lookups=`.** The `i` prefix in `ivalues=` was
   originally chosen for "inverse" but it reads like a plural of `ival=`
   / `mat_ival=` (the I-value / mean excitation potential). The two
   concepts are unrelated (`ival=` is a Bethe-Bloch physics parameter;
   `ivalues=` carried inverse-lookup input rows). Picked `lookups=`
   because (a) it describes the role — each entry is a value to *look
   up* an energy for — and (b) it doesn't reuse the `i` prefix. Also
   considered `inputs=` (too generic), `targets=` (suggests destinations),
   `invvalues=` / `invals=` (still I-adjacent). ADR 006 gained a new §4
   recording the rationale and the alternatives.
2. **Aggressively trim unchanged-from-v1 sections in `url-schema.md`.**
   The earlier draft had a full per-param section for each of `particle=`,
   `material=`, `program=`, `programs=` even though they don't change in
   v2. Collapsed all of those into a single one-row-each table in §3.1
   ("Unchanged From v1"). Full per-param sections are now reserved for
   v2-specific params (`across=`, `mode=`, `uanchor=`, `runit=`, `sunit=`,
   `energies=` extended, `lookups=`, `qshow=`, `istpbranch=`, `tip_seen=`).
   The doc is now shorter and easier to scan.
3. **Migration rule:** v1 `ivalues=` is accepted on read and copied
   verbatim into `lookups=`. Value syntax (number + optional `:unit`
   suffix) is unchanged.
4. **Test update:** added one new fixture covering the `ivalues=` round-
   trip through the current v1 decoder. Title makes clear that the v2
   decoder will copy this into `lookups=` (implementation in #555/#560).
   Total 61 calculator-url tests pass.
5. **README + CHANGELOG + PR description** updated to reflect the rename.
6. **Issue #554 description** updated with the rename and a third
   migration-rule row.

### Prompt 4 (2026-05-23): merge url-schema.md into shareable-urls.md; add migration modal

**User feedback:** Instead of maintaining a separate `url-schema.md`, modify the
existing `shareable-urls.md` and `shareable-urls-formal.md` and almost completely
replace the v1 content. Backward compatibility is not critical (v2 is OK), but a
modal/notification is needed when users load old v1 URLs in the new v2 app. Also
asked about renaming `forward|range|inverse-stp` mode tokens.

**AI response:**

1. **Rewrote `shareable-urls.md` as v7** (the canonical v2 URL spec), incorporating
   all content from `url-schema.md`:
   - Added §2 Schema Delta Table (v1→v2 changes at a glance).
   - Added per-param reference sections for all v2 params (`uanchor=`, `runit=`,
     `sunit=`, `lookups=`, `qshow=`, `mode=`, `across=`, `istpbranch=`, `tip_seen=`).
   - Added §7 v1→v2 Migration: migration rules table + §7.2 Migration Modal spec:
     - v1 URL → non-blocking dismissable banner "Your link was in an older format".
     - Future-version URL (`urlv > 2`) → blocking modal with "Try migration" and "Load defaults".
   - Removed v1-specific examples; updated all examples to v2.
   - Retained Share button spec (§10), security (§11), and acceptance criteria.
   - Proposed mode token renaming alternatives (`e|r|s` matching E→/R→/S→ tab
     glyphs; `energy|range-in|stp-in` explicit form) but kept `forward|range|inverse-stp`
     since the user said "at some point" — the note is in §2.

2. **Rewrote `shareable-urls-formal.md` as v7** (normative ABNF + semantics):
   - Extended ABNF grammar with all v2 pairs: `uanchor-pair`, `runit-pair`,
     `sunit-pair`, `lookups-pair`, `qshow-pair`, `across-pair`, `istpbranch-pair`,
     `tip-seen-pair`.
   - Updated `mode-pair` to `forward|range|inverse-stp` calc-operation tokens.
   - Extended `length-unit-token` with `dm` and `km`.
   - Marked deprecated v1 pairs with `;(deprecated)` comment — still parsed,
     never emitted in v2 canonical output.
   - Added §3.4 v1→v2 migration mapping table.
   - Updated §3.4 version negotiation (`CURRENT_URL_MAJOR = 2`).
   - Updated §3.5 conditional enablement: advanced mode inferred from `programs=`
     vs `program=`, not from `mode=advanced` literal.
   - Updated §3.6 defaults to v2 values.
   - Updated §4 canonicalization algorithm to v2 ordering.
   - Added §5.2 migration conformance vectors (8 v1→v2 migration cases).

3. **Deleted `url-schema.md`** — content fully absorbed by the updated shareable-urls docs.

4. **Updated test file doc comment** — changed reference from `url-schema.md` to
   `shareable-urls.md §2 §7`.

5. **Updated `docs/04-feature-specs/README.md`** — replaced url-schema.md row,
   updated shareable-urls.md and shareable-urls-formal.md status to `v7 (2026-05-23)`.

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
