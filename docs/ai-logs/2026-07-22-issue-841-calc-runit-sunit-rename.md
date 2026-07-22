# 2026-07-22 — Reconcile imode=/iunit= with calc=/runit=/sunit= (#841)

## Session Narrative

### Prompt 1: work on issue #841

**AI response**: Read the issue and the normative `shareable-urls-formal.md`
(§2 grammar, §3.4 migration table, §3.5 implementation-gap note). Traced the
as-shipped code: `calculator-url.ts` read/wrote `imode=`/`iunit=` directly and
never touched `calc=`/`runit=`. The existing `sunit=` field was already wired,
but for a different purpose (the forward-mode Stopping Power column header
unit) than the STP inverse-lookup master unit that `iunit=` covered.

Investigated whether folding `iunit=` (stp) into the existing `sunit=` was
safe, since `inverseLookupState.stpMasterUnit` and `stpOutputUnit` are
independent pieces of app state that can, in principle, diverge. Traced the UI
(`table-inverse-stp.svelte`, `table-advanced.svelte`, `table-multi.svelte`,
`advanced-header.svelte`, `multi-entity-header.svelte`) and confirmed the two
controls are mutually exclusive — the STP inverse-lookup tab and the forward
results table are never both visible at once (`+page.svelte`'s tab
conditionals) — so unifying them under one wire param is behaviorally safe.

Implemented the rename with decode-side backward compatibility: `calc=` wins
when present, falling back to the retired `imode=` only when `calc=` is
absent entirely (an explicit `calc=forward` always overrides a stale
`imode=`). Same precedence for `runit=`/`sunit=` over `iunit=`. Added
default-omission for `runit=cm` and the STP-mode `sunit=kev-um` fold-in
(matching the formal spec's conformance vectors), which the pre-#841 `iunit=`
encoding never did.

Updated `calculator-page-orchestrator.svelte.ts` so a legacy
`imode=stp&iunit=` link (with no `sunit=`) also seeds the shared
`stpOutputUnit` — matching what a fresh `calc=inverse-stp&sunit=` link would
do, so the two forms are behaviorally equivalent on decode.

Fixed the 5 unit tests that asserted the literal `imode=`/`iunit=` wire
params on the *encode* side (decode-side backward-compat tests were
unaffected and still pass), and added new tests for canonical
`calc=`/`runit=`/`sunit=` round-trips and precedence over stale legacy
params. Updated two e2e specs (`calculator-url.spec.ts`,
`inverse-lookups.spec.ts`) that asserted the app's own re-encoded URL
contained the retired names. Verified manually with Playwright that a
`calc=inverse-stp&sunit=mev-cm` link and an equivalent legacy
`imode=stp&iunit=mev-cm` link both select MeV/cm on the Inverse-STP tab and
carry it over to the Forward tab's header dropdown.

Updated `shareable-urls-formal.md`, `shareable-urls.md`, `calculator.md`,
`inverse-lookups.md`, and the spec README to close out the implementation-gap
notes `#840` had left open.

## Tasks

### Rename imode=/iunit= to calc=/runit=/sunit= with backward-compat decode

- **Status**: completed
- **Stage**: post-redesign maintenance (URL contract conformance)
- **Files changed**:
  - `src/lib/utils/calculator-url.ts`
  - `src/lib/state/calculator-page-orchestrator.svelte.ts`
  - `src/tests/unit/calculator-url.test.ts`
  - `tests/e2e/calculator-url.spec.ts`
  - `tests/e2e/inverse-lookups.spec.ts`
  - `docs/04-feature-specs/shareable-urls-formal.md`
  - `docs/04-feature-specs/shareable-urls.md`
  - `docs/04-feature-specs/calculator.md`
  - `docs/04-feature-specs/inverse-lookups.md`
  - `docs/04-feature-specs/README.md`
- **Decision**: Kept the internal TS field names `imode`/`iunit` on
  `CalculatorUrlState`/`InverseModeUrlState` unchanged — the issue is about
  the URL wire format, not the in-memory representation, and renaming those
  fields would have touched many more call sites for no contract-visible
  benefit. Folded the STP-mode `iunit=` into the existing `sunit=` field
  rather than introducing a second param, since the formal contract already
  specifies them as the same token and the two underlying UI controls never
  compete for the URL at the same time. Did not attempt phase-aware
  (gas vs. condensed) default-omission for `sunit=` in STP mode — the STP
  inverse-lookup master unit's own code-level default is a static
  `"kev-um"` (not material-phase-dependent, unlike the forward-mode
  default), so omitting relative to that static default is consistent and
  low-risk without new plumbing.
- **Issue**: `inverse-lookups.md`'s many inline URL examples still use the
  pre-v2 `imode=`/`ivalues=`/`iunit=` schema — that staleness was already
  flagged in the doc itself as tracked separately under issue #560, so it
  was left alone beyond a top-of-file note pointing at this fix.
