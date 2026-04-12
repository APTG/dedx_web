# 2026-04-10 — Inverse Lookups Spec Draft v1 → v2

## Session Narrative

### Prompt 1: Pre-draft reading and question formulation

**AI response**: Read three source files as instructed before drafting:
- `docs/06-wasm-api-contract.md` §§2.3, 3 — `InverseStpResult`,
  `InverseCsdaResult` types; `getInverseStp()` (two-branch, `side` param)
  and `getInverseCsda()` (monotonic, no branch) service signatures.
- `docs/04-feature-specs/calculator.md` — unified table design, entity
  selection integration, URL state encoding, debounce model, validation
  pattern, export pattern.
- `docs/04-feature-specs/unit-handling.md` §§1–5 — canonical internal
  units, stopping power conversion formulas, CSDA range conversion, default
  unit rules (gas vs non-gas), SI prefix auto-scaling.

Identified seven design areas requiring decisions (A–G) and formulated 16
clarifying questions. All questions were presented as interactive button
prompts (4 questions per round).

### Prompts 2–5: Interactive Q&A (button-based)

User answered all 16 questions across four rounds of button prompts. Key
decisions captured:

**UI Surface (A)**
- Inverse lookup surfaces as **tabs on the Calculator page**.
  Tab switcher (`[ Forward ] [ Inverse STP ] [ Inverse CSDA ]`) only visible
  in Advanced mode.
- Entity selectors (Particle, Material, Program) are **shared** with the
  Forward tab.

**Scope (B)**
- **Both** `getInverseStp` and `getInverseCsda` are specified in this
  version.

**Branch selection for STP (C)**
- **Both branches shown simultaneously** as two output columns (`E low`,
  `E high`). No user toggle needed; `getInverseStp()` called twice
  (`side=0`, `side=1`) per batch.
- When STP exceeds the Bragg peak maximum (no solution on either branch):
  show **`—`** in both columns silently (no row highlight).

**Input format (D)**
- **Same unified table pattern** as the Forward tab: always-empty-bottom-row,
  paste creates multiple rows, Tab/Enter navigation.

**Output format and unit handling (E)**
- Output energy displayed in the **user's selected master energy unit**
  (MeV / MeV/nucl / MeV/u), with **eV/keV/MeV/GeV auto-scaling** applied
  (same 1–9999 rule as CSDA length auto-scaling in `unit-handling.md` §6).
- Inverse STP input unit **mirrors the forward output unit** for the current
  material (keV/µm for non-gas, MeV·cm²/g for gas), with a three-option
  dropdown (keV/µm, MeV/cm, MeV·cm²/g).
- Inverse CSDA input uses **inline length-suffix detection** (nm/µm/mm/cm/m)
  analogous to energy suffix detection in the forward calculator. Master
  unit defaults to cm. Mixed units across rows activate per-row mode.

**URL state (F)**
- **Yes, shareable** — extend the Calculator URL in place
  (`?imode=stp&ivalues=...`). No separate route.

**Advanced Options (G)**
- **Shared, applied to both** inverse calls. Same `AdvancedOptions` object
  as the Forward tab.

**Advanced feature gating (follow-up)**
- Inverse tabs are **hidden until Advanced mode is on**. No lock icons, no
  prompts in Basic mode.

**Energy output auto-scaling (follow-up)**
- Unit ladder: **eV / keV / MeV / GeV** (all four tiers, not just three).

**CSDA inline suffix parsing (follow-up)**
- **Yes — inline suffix detection** per-row, same debounce model as energy
  suffix detection.

### Prompt 6: Spec written

**AI response**: Created `docs/04-feature-specs/inverse-lookups.md`
(Draft v1) covering:

- Feature gate (§1): invisible in Basic mode; both inverse tabs appear
  on Advanced mode enable; view reverts to Forward on Advanced mode disable.
- Tab layout (§2): three-tab layout; entity row shared; tab switcher
  replaces table area.
- Shared context (§3): `EntitySelectionState`, `AdvancedOptions`,
  energy unit selector — all shared with Forward tab.
- Inverse STP tab (§4): purpose (non-monotonic, two branches); 4-column
  table (Typed Value / Unit / E low / E high); input unit dropdown defaulting
  to forward output unit by material phase; row validation; wireframe.
- Inverse CSDA tab (§5): purpose (monotonic, unique); 4-column table
  (Typed Value / → g/cm² / Unit / → Energy); inline suffix detection for
  nm/µm/mm/cm/m; master/per-row mode; internal cm→g/cm² conversion;
  row validation; wireframe.
- Energy output auto-scaling (§6): eV/keV/MeV/GeV ladder, 1–9999 rule,
  applied after unit conversion; column header adapts to uniform or mixed
  prefixes.
- Shared table behaviour (§7): append pattern, paste, Tab/Enter, debounce,
  pre-filled rows, recalculation triggers.
- Export (§8): per-tab CSV buttons, column schemas, filename patterns.
- URL state encoding (§9): `imode`, `ivalues`, `iunit` parameters;
  colon-syntax per-value unit suffixes; load behaviour.
- Error handling (§10): no-solution → `—`; out-of-range → highlight;
  density unavailable → row invalid; unexpected C error → "Show details".
- Dependencies, acceptance criteria (~45 individual checks across 9 groups),
  and 3 open questions (AdvancedOptions pass-through contract, Bragg peak
  maximum query, Advanced Options accordion scope).

### Prompt 7: Consistency review, missing links, AI logs

**AI response**: Read the full spec, `advanced-options.md` (Final v5),
`shareable-urls.md` §7.3, and `docs/04-feature-specs/README.md`. Found
and fixed the following:

**Consistency fixes applied to `inverse-lookups.md`:**

1. `advanced-options.md` was referenced as "TODO" in three places — it is
   Final v5. Replaced all three occurrences with proper links.
2. §2 wireframe was missing the Advanced Options accordion. Updated to show
   the accordion between the entity row and the tab switcher, with a note
   cross-referencing `advanced-options.md` §1 for the placement rule.
3. §6 prefix table header said "in MeV/nucl equivalent" — scaling is
   applied after conversion to the active display unit (MeV, MeV/nucl,
   or MeV/u), not directly to the MeV/nucl raw value. Updated header and
   added a clarifying paragraph.
4. Open Question #3 ("Advanced Options panel scope") was already answered
   by `advanced-options.md` §1 ("every page hosting calculations"). Removed
   the open question; the spec now correctly states that the accordion is
   global and appears above the tab switcher.

**Missing links added to `inverse-lookups.md`:**

5. `InverseStpResult` and `InverseCsdaResult` type references in §4.1 and
   §5.1 now link to `../06-wasm-api-contract.md#23-calculation-results`.
6. All `LibdedxService` method references in the Dependencies section now
   link to `../06-wasm-api-contract.md#3-service-interface`.
7. `MaterialEntity.isGasByDefault` in Dependencies now links to
   `../06-wasm-api-contract.md#22-entities`.
8. `AdvancedOptions` in Dependencies now links to
   `../06-wasm-api-contract.md#26-advanced-options`.
9. Dependencies cross-references to `unit-handling.md` §§4, 5.1, 5.2, 5.4
   added inline.
10. §10 "project vision §9" now links to
    `../01-project-vision.md#9-error-philosophy`.
11. Open Question #1's service method references now link to the WASM
    contract §3.
12. §9 URL section now documents inverse params as **step 8** in the
    canonical ordering and links to `shareable-urls.md` §7.3.
13. Related specs section updated: `advanced-options.md` proper link,
    `shareable-urls.md` §7.3 specific anchor, `shareable-urls-formal.md`
    added.

**Cross-spec updates:**

14. `docs/04-feature-specs/shareable-urls.md` §7.3 canonical ordering:
    added step 8 (`imode`, `ivalues`, `iunit`) after the existing step 7
    Advanced Options params.
15. `docs/04-feature-specs/README.md`: moved `inverse-lookups.md` from
    "Planned Specs (not yet written)" to the main table as Draft v1.

## Files Changed

| File | Change |
|------|--------|
| `docs/04-feature-specs/inverse-lookups.md` | **Created** — Draft v1; consistency and link fixes applied in same session |
| `docs/04-feature-specs/shareable-urls.md` | Updated — §7.3 canonical ordering extended with step 8 for inverse-lookup params |
| `docs/04-feature-specs/README.md` | Updated — `inverse-lookups.md` promoted from Planned to main table (Draft v1) |
| `CHANGELOG-AI.md` | Updated with this session entries |
| `docs/ai-logs/2026-04-10-inverse-lookups.md` | **Created** — this log |

### Prompt 8: Draft v2 — priority, rename, getBraggPeakStp, formal grammar

**User directive:** Range tab (Inverse CSDA) gets priority; rename it "Range"
in the menu; resolve Open Question #2 by adding a helper function; check
consistency everywhere; update formal grammar.

**AI response:**

**Changes to `inverse-lookups.md` (Draft v1 → Draft v2):**

1. Renamed "Inverse CSDA" tab to **Range** throughout the spec (tab labels,
   section headings, user story, acceptance criteria, export filename).
2. Moved Range section to §4 (was §5) and Inverse STP to §5 (was §4) —
   Range is the primary use case ("enter a range, get energy").
3. Tab bar order updated: `[ Forward ] [ Range ] [ Inverse STP ]`.
4. Export filename: `dedx_range_{particle}_{material}_{program}.csv`.
5. §9 URL state: added explicit note that the Range tab maps to `imode=csda`
   (the URL param uses the technical name for stability).
6. §9 URL example: updated `iunit` to use canonical token `kev-um` (not
   percent-encoded `keV/µm`) for consistency with `stp-unit-pair` tokens.
7. §5.4 (Inverse STP row validation): added reference to `getBraggPeakStp()`
   for the valid STP range hint below the table; updated wireframe to show
   `Valid STP range: 0–847.3 keV/µm (...)` line.
8. Open Question #2 removed (resolved by `getBraggPeakStp()` addition).
9. Dependencies section: `getBraggPeakStp()` added.

**Changes to `06-wasm-api-contract.md`:**

10. Added `getBraggPeakStp()` method to the service interface (§3), after
    `getInverseCsda()`. Returns the Bragg peak STP in MeV·cm²/g. Accepts
    `options?: AdvancedOptions` so the peak is computed under the same
    config as the inverse lookup. Calls `dedx_get_bragg_peak_stp()` from
    `dedx_tools.h` (new C function — to be added to the WASM wrapper).

**Changes to `shareable-urls-formal.md` (v4 → v5):**

11. Added `imode-pair`, `ivalues-pair`, `iunit-pair` to the `pair` production.
12. Added ABNF rules: `imode-token`, `ivalues-list`, `ivalue-item`,
    `ivalue-unit-token`, `stp-iunit-token`, `length-unit-token`.
13. §3.5 conditional enablement: inverse params silently dropped in basic mode;
    `imode`/`ivalues`/`iunit` parse rules for advanced mode added.
14. §3.6 defaults: inverse-lookup defaults documented.
15. §3.7 validation: inverse-lookup constraints documented (type checking,
    mismatch handling, `ivalues` without `imode` → ignored).
16. §4 canonicalization: step 8 added for inverse params.
17. §4 normalization rules: 5 new rules for inverse param emission.
18. §5 conformance vectors: 6 new vectors added (12–17) covering Range tab,
    Inverse STP, default omission, basic-mode strip, and error cases.

**Changes to `CHANGELOG-AI.md`:** one entry prepended (Draft v2).

### Prompt 9: Q&A rounds → Draft v3

**User directive:** Ask more questions, split long ones, then update spec.

Four rounds of button-based Q&A (16 questions total). Decisions captured:

- Multi-program: all selected programs used in inverse tabs
- Default tab on Advanced enable: Forward (unchanged — inverse tabs appear but view stays)
- Tab state: rows preserved across switches (restored on return)
- Electron: supported; output energy in MeV (no per-nucleon)
- `→ g/cm²` column: hidden (internal detail)
- Multi-program layout (Range): one column per program
- `getBraggPeakStp()` failure: hint omitted silently
- `options?` param: yes — add to `getInverseStp()` and `getInverseCsda()`
- Multi-program layout (Inverse STP): sub-rows per program
- `qfocus`: does not gate inverse tabs (unaffected)
- Multi-program export: one file, all programs
- Sub-row program label: inline in E low cell
- `hidden_programs`: same visibility governs inverse tabs
- Unsupported program: shows `—` (same as no-solution, no highlight)

**Changes to `inverse-lookups.md` (Draft v2 → v3):**
1. Status header and v3 changelog added.
2. §1: `qfocus` note added.
3. §3: three new sub-sections — Programs and Multi-Program Mode,
   Electron (ESTAR) Support, Tab State Persistence.
4. §4.2: `→ g/cm²` column removed; multi-program column layout documented.
5. §4.5: wireframe updated — g/cm² removed from single-program;
   multi-program wireframe added.
6. §5.2: multi-program sub-row layout documented with inline program label.
7. §5.5: multi-program Inverse STP wireframe added.
8. §8: export updated for multi-program (one file; `Program` column for STP;
   filename pattern without program segment for multi-program).
9. §10: `getBraggPeakStp()` silent failure and unsupported-program `—` added.
10. Dependencies: `options?` noted; `getBraggPeakStp()` multi-program note added.
11. Acceptance criteria: 13 new checks (tab switching, multi-program,
    electron, export, `qfocus`, hidden_programs, getBraggPeakStp failure).
12. Open Questions: all resolved — section now empty.

**Changes to `06-wasm-api-contract.md`:**
13. `options?: AdvancedOptions` added to `getInverseStp()` and `getInverseCsda()`.

**Changes to `CHANGELOG-AI.md`:** Draft v3 entry prepended.

## Files Changed

| File | Change |
|------|--------|
| `docs/04-feature-specs/inverse-lookups.md` | **Updated** — Draft v1 → Draft v2 (rename, reorder, getBraggPeakStp, URL token fix) |
| `docs/06-wasm-api-contract.md` | **Updated** — `getBraggPeakStp()` added to §3 service interface |
| `docs/04-feature-specs/shareable-urls-formal.md` | **Updated** — v4 → v5 (imode/ivalues/iunit ABNF, semantic rules, canonicalization step 8, 6 conformance vectors) |
| `CHANGELOG-AI.md` | Updated with Draft v2 entry |
| `docs/ai-logs/2026-04-10-inverse-lookups.md` | **Updated** — this log |

## Open Questions Remaining

_None — all open questions from this session have been resolved._
