# URL Schema v2 — Canonical Query-Parameter Reference

> **Status:** v3 (2026-05-23) · Canonical design doc for the calculator-table redesign
>
> **Part of:** master epic #552 / #526 (calculator-table redesign)
>
> **Blocks:** #555, #556, #557, #558, #559, #560, #561
>
> **Supersedes:** `shareable-urls.md` §3–§5 for calculator-page params;
> `shareable-urls-formal.md` ABNF grammar and canonicalization — those files
> remain authoritative for plot-page and shared entity params until they are
> updated to reference this doc.
>
> **Cross-check rule:** If this file conflicts with `shareable-urls.md` or
> `shareable-urls-formal.md`, this file wins **for the calculator route**.
>
> **Revision history:**
>
> - **v1** (2026-05-22): initial draft (later reverted: had `particleId=` etc. renames).
> - **v2** (2026-05-23): reverted the `*Id` rename; extended `runit=` with `dm` and `km`;
>   addressed PR #565 Copilot review.
> - **v3** (2026-05-23): renamed `ivalues=` → `lookups=` to avoid clashing with the
>   I-value / mean excitation potential (`ival=`, `mat_ival=`) from the Bethe-Bloch
>   formula. Aggressively trimmed unchanged-from-v1 param sections — each gets one
>   line in §3 plus a row in the §2 delta table.

---

## 1. Why a Separate Schema Doc

The calculator-table redesign introduces new query params, replaces existing
ones, and drops one entirely. Letting each implementation issue (#555–#561)
make ad-hoc URL decisions would produce inconsistency. This document is the
single source of truth that every dependent issue MUST reference.

**Scope:** every query parameter accepted by the Calculator route
(`/calculator`); migration rules from `master` (v1, `urlv=1`); one worked URL
example per new/changed parameter; explicit coverage of the two riskiest
formats — inline-unit suffix in row values (`100,10:keV,2:GeV`) and the
inverse-STP branch sticky flag (`istpbranch=hi|lo|both`).

**Out of scope:** plot-route params that don't change (series-strip encoding
stays as-is); any actual UI behaviour — those land in #555 onwards.

---

## 2. Schema Delta Table (v1 → v2)

This table is the canonical sign-off for all calculator-route URL changes.
Dependent issues must not deviate from it without updating this doc first.

| Param | v2 Status | Notes |
|---|---|---|
| `urlv=` | **bumped to 2** | Triggers v1→v2 migration on read |
| `particle=` · `material=` · `program=` · `programs=` | unchanged | Same names + semantics as v1 |
| `extdata=` · `mat_*=` · `agg_state=` · `interp_*=` · `mstar_mode=` · `density=` · `ival=` | unchanged | Same as `shareable-urls-formal.md` v6 |
| `across=none\|programs\|materials\|particles` | **new URL param** | Was UI state only in v1; now in URL |
| `mode=forward\|range\|inverse-stp` | **new** | Calculator operation mode; replaces `imode=csda\|stp` |
| `hidden=` / `hidden_programs=` | **removed** | Silently dropped on read; visibility now from picker selection |
| `qshow=stp\|range` | **replaces `qfocus=`** | 3-state → 2-state; values renamed (see §6) |
| `uanchor=mev\|mev-nucl\|mev-u` | **new** | Energy unit anchor; replaces `eunit=` |
| `runit=nm\|um\|mm\|cm\|dm\|m\|km` | **new** | Range unit anchor (Range → mode + CSDA range display) |
| `sunit=kev-um\|mev-cm\|mev-cm2-g` | **new** | STP unit anchor (STP → mode + STP display) |
| `energies=100,10:keV,2:GeV` | **extended** | Inline `:unit` per row; used only when `mode=forward` |
| `lookups=` | **renamed** (from `ivalues=`) | Inverse-mode input list; same inline `:unit` syntax |
| `istpbranch=hi\|lo\|both` | **new** | Sticky inverse-STP branch column state |
| `tip_seen=inline_unit` | **new (optional)** | Inline-unit tip dismissal flag |

---

## 3. Parameter Reference

Params that didn't change from v1 are listed in §3.1 in one line each. The
v2-specific params get full per-param sections starting at §3.2.

### 3.1 Unchanged From v1

| Param | Source of truth |
|---|---|
| `urlv=` | `shareable-urls.md` §3.1 — value is `2` in v2 canonical output |
| `particle=` | `shareable-urls.md` §3.1 (default `1` = proton) |
| `material=` | `shareable-urls.md` §3.1 (default `276` = water liquid; `"custom"` allowed) |
| `program=` | `shareable-urls.md` §4.1 (basic mode; default `"auto"`) |
| `programs=` | `shareable-urls-formal.md` §3.5 (advanced mode; comma-separated IDs) |
| `extdata=` | `shareable-urls-formal.md` §2 |
| `agg_state=` · `interp_scale=` · `interp_method=` · `mstar_mode=` · `density=` · `ival=` | `advanced-options.md` |
| `mat_name=` · `mat_density=` · `mat_elements=` · `mat_ival=` · `mat_phase=` | `custom-compounds.md` §6 |

> **Note on `ival=` and `mat_ival=`:** these encode the **I-value** (mean
> excitation potential) used in the Bethe-Bloch formula. They are unrelated
> to the v1 `ivalues=` param (which carried *inverse-lookup* input rows and
> has been renamed to `lookups=` in v2 to remove the naming collision).

### 3.2 `across` — Compare-Across Dimension (new in v2)

| Attribute | Value |
|---|---|
| Type | `"none"` \| `"programs"` \| `"materials"` \| `"particles"` |
| Default | `"none"` (omitted from canonical URL) |
| Mode | Advanced mode only; silently ignored in basic mode |

Controls which entity axis drives the multi-entity comparison columns.

**Worked example:**

```
?urlv=2&particle=1&material=276&programs=9,2&energies=100,200&uanchor=mev&across=programs&qshow=stp
```

→ Advanced mode, comparing programs 9 and 2 across two energy rows.

### 3.3 `mode` — Calculator Operation Mode (new in v2)

| Attribute | Value |
|---|---|
| Type | `"forward"` \| `"range"` \| `"inverse-stp"` |
| Default | `"forward"` (omitted from canonical URL) |
| v1 equivalent | implicit `"forward"`; inverse modes used `imode=csda\|stp` |

| Token | Meaning | Replaces |
|---|---|---|
| `forward` | Energy → STP + CSDA Range | no `imode` |
| `range` | CSDA Range → Energy | `imode=csda` |
| `inverse-stp` | Stopping Power → Energy | `imode=stp` |

The `imode=` param is removed; `mode=` covers all three. Advanced/basic
**picker** mode is no longer a URL param — it is inferred from the presence
of `programs=` vs `program=` (§4.2).

**Worked example — range lookup:**

```
?urlv=2&particle=1&material=276&programs=9&lookups=7.72:cm,20:cm&runit=cm&uanchor=mev&mode=range
```

→ Range-to-energy lookup for two CSDA range values. Input column = range
(via `lookups=`); output columns = energies. `energies=` is absent.

**Worked example — inverse STP:**

```
?urlv=2&particle=1&material=276&programs=9&lookups=10.0:kev-um&sunit=kev-um&uanchor=mev&mode=inverse-stp&istpbranch=both
```

### 3.4 `uanchor` — Energy Unit Anchor (new in v2)

| Attribute | Value |
|---|---|
| Type | `"mev"` \| `"mev-nucl"` \| `"mev-u"` |
| Default | `"mev"` |
| v1 equivalent | `eunit=MeV\|MeV/nucl\|MeV/u` |

Determines how unsuffixed rows in `energies=` are interpreted and what the
Energy column header reads. Note: for proton (A=1), `mev` and `mev-nucl` are
numerically identical; for proton + `mev-u` the value differs by ~0.1% — see
the `(≠MeV)` badge in #558.

**Worked example:**

```
?urlv=2&particle=6&material=276&program=auto&energies=10,50,200&uanchor=mev-nucl
```

→ Carbon-12, energies interpreted as 10/50/200 MeV/nucl.

### 3.5 `runit` — Range Unit Anchor (new in v2)

| Attribute | Value |
|---|---|
| Type | `"nm"` \| `"um"` \| `"mm"` \| `"cm"` \| `"dm"` \| `"m"` \| `"km"` |
| Default | `"cm"` |
| v1 equivalent | `iunit=` (for `imode=csda`) |

Controls (1) the unit shown in the CSDA Range column header, (2) how
unsuffixed rows in `lookups=` are interpreted when `mode=range`, (3) the
anchor in the Range → unit-anchor strip. The full SI prefix set spans
sub-mm (`nm`, `um`, `mm`) through everyday (`cm`, `dm`, `m`) to large
(`km`) — needed for high-energy / low-density cases (e.g. cosmic rays
through air, alpha particles through km-scale gas columns). The on-screen
anchor strip defaults to a five-button subset per #558; `dm` and `km` are
accepted in URLs for round-trip fidelity.

Per-cell rendering auto-scales to an appropriate prefix independent of
`runit=` (per #556's `value-formatters.ts`). `runit=` only anchors the
**input** interpretation and the column header.

**Worked example — basic, mm display:**

```
?urlv=2&particle=1&material=276&program=auto&energies=100,200&uanchor=mev&runit=mm
```

**Worked example — range lookup, large-scale ranges:**

```
?urlv=2&particle=2&material=3&programs=9&lookups=1.5,3.0&runit=km&uanchor=mev&mode=range
```

→ Alpha particles in air at km-scale ranges.

### 3.6 `sunit` — STP Unit Anchor (new in v2)

| Attribute | Value |
|---|---|
| Type | `"kev-um"` \| `"mev-cm"` \| `"mev-cm2-g"` |
| Default | `"kev-um"` (condensed material); `"mev-cm2-g"` (gas) |
| v1 equivalent | `stp_unit=` (plot page) / `iunit=` (for `imode=stp`) |

| Token | Display label |
|---|---|
| `kev-um` | keV/µm |
| `mev-cm` | MeV/cm |
| `mev-cm2-g` | MeV·cm²/g |

**Worked example — display unit override:**

```
?urlv=2&particle=1&material=276&program=auto&energies=100,200&uanchor=mev&sunit=mev-cm
```

### 3.7 `energies` — Energy Input Values (extended in v2)

| Attribute | Value |
|---|---|
| Type | Comma-separated `energy-item` list |
| Grammar | `energy-item = number [":" energy-unit-token]` |
| Mode | Only used when `mode=forward` (the default); absent in `mode=range` and `mode=inverse-stp` (which use `lookups=` instead) |

Each row is either a bare number (inherits `uanchor=`) or a number with an
explicit per-row `:unit` suffix. The `:` separator is RFC 3986 §3.4-safe;
see §7 for grammar analysis.

Valid per-row unit tokens: `eV`, `keV`, `MeV`, `GeV`, `TeV`, `MeV/nucl`,
`keV/nucl`, `GeV/nucl`, `MeV/u`, `keV/u`, `GeV/u`. Unknown tokens →
invalid row; excluded from calculation; validation message shown.

**Worked example — mixed inline units:**

```
?urlv=2&particle=1&material=276&program=auto&energies=100,10:keV,2:GeV,250&uanchor=mev
```

→ Four rows: 100 MeV (from `uanchor`), 10 keV (explicit), 2 GeV (explicit),
   250 MeV (from `uanchor`).

### 3.8 `lookups` — Inverse-Lookup Input Values (renamed in v2 from `ivalues=`)

| Attribute | Value |
|---|---|
| Type | Comma-separated `lookup-item` list |
| Grammar | `lookup-item = number [":" unit-token]` |
| v1 name | `ivalues=` (renamed to `lookups=` to avoid colliding with the I-value `ival=`) |
| Mode | Only parsed when `mode=range` or `mode=inverse-stp` |

When `mode=range`: per-row unit is a length token from §3.5 (`nm` /
`um` / `mm` / `cm` / `dm` / `m` / `km`); master unit from `runit=`. When
`mode=inverse-stp`: per-row unit is a STP token (`kev-um` / `mev-cm` /
`mev-cm2-g`); master unit from `sunit=`.

**Why the rename?** In v1, `ivalues=` carried inverse-lookup input rows.
The `i` prefix collided with the I-value (mean excitation potential)
encoded by `ival=` (and `mat_ival=` for custom compounds) — a Bethe-Bloch
physics quantity. The two have nothing to do with each other; the rename
makes the URL self-documenting.

**Worked example — range lookup, mixed length units:**

```
?urlv=2&particle=1&material=276&programs=9&lookups=7.718:cm,45:um,1.5:mm&runit=cm&uanchor=mev&mode=range
```

→ Three range-lookup rows: 7.718 cm, 45 µm, 1.5 mm.

**Worked example — STP inverse lookup, master unit only:**

```
?urlv=2&particle=1&material=276&programs=9&lookups=45.76,10.00&sunit=kev-um&uanchor=mev&mode=inverse-stp
```

### 3.9 `qshow` — Quantity Display Toggle (replaces v1 `qfocus=`)

| Attribute | Value |
|---|---|
| Type | `"stp"` \| `"range"` |
| Default | both quantities visible (param absent from URL) |
| Mode | Advanced mode only; ignored in basic mode |

| v2 `qshow=` | v1 `qfocus=` | Meaning |
|---|---|---|
| `stp` | `stp` | Show stopping power columns only |
| `range` | `csda` | Show CSDA range columns only |
| *(absent)* | `both` | Show both (default) |

CSV export always includes both quantities regardless of `qshow=`. Unlike
v1 which always emitted `qfocus=both`, v2 omits `qshow=` when both are
visible (default = absence).

**Worked example:**

```
?urlv=2&particle=1&material=276&programs=9,2&energies=100,200&uanchor=mev&qshow=range
```

### 3.10 `istpbranch` — Inverse-STP Branch Sticky Flag (new in v2)

| Attribute | Value |
|---|---|
| Type | `"hi"` \| `"lo"` \| `"both"` |
| Default | `"hi"` |
| Mode | Only relevant when `mode=inverse-stp` |

Controls the column-visibility state for the dual-branch inverse-STP table.
Some STP values have two corresponding energies (high-E and low-E branches).

| Token | Meaning |
|---|---|
| `hi` | Show high-energy branch only (default) |
| `lo` | Show low-energy branch only (reserved; not implemented in #560 — schema stub) |
| `both` | Both branch columns visible (sticky after the user has seen a dual-solution row) |

The `both` state is sticky: once a dual-solution row appears the column
reveals; `istpbranch=both` keeps that column visible on reload.

**Worked example — sticky both-branch state:**

```
?urlv=2&particle=1&material=276&programs=9&lookups=10.0:kev-um,5.0:kev-um&sunit=kev-um&uanchor=mev&mode=inverse-stp&istpbranch=both
```

### 3.11 `tip_seen` — Tip Dismissal Flag (new in v2, optional)

| Attribute | Value |
|---|---|
| Type | Literal `"inline_unit"` (only valid value currently) |
| Default | tip not yet seen (param absent) |

Cross-device sharing of the "type a unit too — e.g. `10 keV`" dismissal
state. Primary persistence is `localStorage` key
`dedx_tip_inline_unit_seen`; the URL param is an optional supplement.

**Worked example:**

```
?urlv=2&particle=1&material=276&program=auto&energies=100,10:keV&uanchor=mev&tip_seen=inline_unit
```

### 3.12 Deprecated v1 Params (accepted on read; never emitted in v2)

| Deprecated v1 param | v2 behaviour |
|---|---|
| `mode=advanced` / `mode=basic` | Accepted; not emitted. Advanced mode is inferred from `programs=` vs `program=` (§4.2). |
| `eunit=` | Accepted; mapped to `uanchor=` (§3.4). |
| `qfocus=` | Accepted; mapped to `qshow=` per §6. |
| `imode=` | Accepted; mapped to `mode=range\|inverse-stp` per §6. |
| `iunit=` | Accepted; mapped to `runit=` (when prior `imode=csda`) or `sunit=` (when prior `imode=stp`). |
| `ivalues=` | Accepted; copied verbatim to `lookups=` (same value syntax). |
| `hidden=` / `hidden_programs=` | Silently dropped; column visibility now derived from picker selection. |

---

## 4. Canonical URL Form (v2)

### 4.1 Parameter Order

Square brackets denote conditional emission:

```
/calculator
  ?urlv=2
  [&extdata={label}:{url}]              ← one per source, declaration order
  &particle={id}
  &material={id|"custom"}
  &{program={id|"auto"} | programs={ids}}   ← exactly one, by mode
  [&across={dimension}]                 ← omit when "none" (default)
  [&energies={csv}]                     ← only when mode=forward (default)
  [&lookups={csv}]                      ← only when mode=range or mode=inverse-stp
  &uanchor={token}                      ← always emitted
  [&runit={token}]                      ← omit when "cm" (default)
  [&sunit={token}]                      ← omit when default for material phase
  [&mode={forward|range|inverse-stp}]   ← omit when "forward" (default)
  [&qshow={stp|range}]                  ← omit when both visible (default)
  [&istpbranch={hi|lo|both}]            ← omit when "hi" (default)
  [&tip_seen=inline_unit]               ← omit unless tip dismissed
  [&agg_state=...] [&interp_scale=...] ...  ← advanced options
  [&mat_name=...] ...                   ← custom compound
```

### 4.2 Advanced Mode vs Basic Mode in v2

Advanced/basic mode is no longer stored as a `mode=advanced|basic` URL param.
Instead:

- **Basic mode:** URL contains `program=` (one program param).
- **Advanced mode:** URL contains `programs=` (multi-program param).

The literal `mode=advanced` / `mode=basic` is accepted on read for v1
migration only and never emitted. (No ambiguity with the v2 `mode=` calc-
operation tokens because the value-sets don't overlap.)

### 4.3 When `qshow=` is Omitted

| Value | Canonical emission |
|---|---|
| `qshow=stp` | emit `qshow=stp` |
| `qshow=range` | emit `qshow=range` |
| both visible (default) | omit `qshow=` |

### 4.4 Worked Canonical Examples

**Basic mode — mixed inline units:**

```
/calculator?urlv=2&particle=1&material=276&program=auto&energies=100,10:keV,2:GeV&uanchor=mev
```

**Advanced mode — multi-program, STP only:**

```
/calculator?urlv=2&particle=1&material=276&programs=9,2&energies=100,200&uanchor=mev&qshow=stp
```

**Advanced mode — range lookup:**

```
/calculator?urlv=2&particle=1&material=276&programs=9&lookups=7.718:cm,20:cm&runit=cm&uanchor=mev&mode=range
```

**Advanced mode — inverse STP, sticky both-branch:**

```
/calculator?urlv=2&particle=1&material=276&programs=9&lookups=10.0:kev-um,5.0:kev-um&sunit=kev-um&uanchor=mev&mode=inverse-stp&istpbranch=both
```

**Advanced mode — compare-across programs:**

```
/calculator?urlv=2&particle=1&material=276&programs=9,2,101&energies=100,200&uanchor=mev&across=programs&qshow=range
```

---

## 5. Removed Params

### 5.1 `hidden=` / `hidden_programs=`

Used in v1 to hide program columns in multi-entity advanced mode. The
Columns dropdown is removed in #561; column visibility = entity selection
in the picker (selected = visible, deselected = absent).

**On read:** silently drop. No warning. No hidden-column state restoration.

---

## 6. Migration Rules: v1 → v2

When loading a URL with `urlv=1` (or no `urlv`):

| v1 param | v2 behaviour |
|---|---|
| `particle=` · `material=` · `program=` · `programs=` | unchanged — emitted as-is in v2 |
| `eunit={token}` | read as `uanchor=` with mapped token (`MeV`→`mev`, `MeV/nucl`→`mev-nucl`, `MeV/u`→`mev-u`) |
| `qfocus=both` | treat as `qshow=` absent (both visible, default) |
| `qfocus=stp` | treat as `qshow=stp` |
| `qfocus=csda` | treat as `qshow=range` |
| `imode=csda` | treat as `mode=range` |
| `imode=stp` | treat as `mode=inverse-stp` |
| `iunit=` | treat as `runit=` (when prior `imode=csda`) or `sunit=` (when prior `imode=stp`) |
| `ivalues=` | rename to `lookups=` (value syntax unchanged) |
| `mode=advanced` | infer advanced mode from `programs=` param (discard literal) |
| `hidden=` or `hidden_programs=` | silently drop |
| `energies=` without `:unit` suffixes | load with `uanchor=` default; values unchanged |
| Any unknown param | silently drop (forward-compat) |

After applying migration, the parser emits a canonical v2 URL via
`replaceState`, bumping `urlv` to `2`.

---

## 7. Inline-Unit Suffix Grammar (Risk Analysis)

The inline `:unit` suffix uses a literal colon inside the query component.
RFC 3986 §3.4 permits `:` unencoded within a query string; `URLSearchParams`
preserves literal colons inside values. Safety analysis:

1. The query string is split on raw `&` and raw `=` first (per ABNF
   tokenisation in `shareable-urls-formal.md` §2).
2. After extracting the `energies=` or `lookups=` value, the CSV is split
   on `,` (also literal and safe per RFC 3986 §3.4).
3. Each item is then split on the **last** `:` to separate the number
   from the unit token. Current unit tokens (`MeV`, `keV`, `GeV`,
   `MeV/nucl`, `keV/nucl`, `GeV/nucl`, `MeV/u`, `keV/u`, `GeV/u`, `nm`,
   `um`, `mm`, `cm`, `dm`, `m`, `km`, `kev-um`, `mev-cm`, `mev-cm2-g`)
   contain no colons, so the split is unambiguous. Future tokens must
   not include colons.

**The `|` in `istpbranch=hi|lo|both`:** not a URL issue. `istpbranch`
carries a single token value (`hi`, `lo`, or `both`); the `|` is grammar
alternative notation in the spec table only.

---

## 8. Test-Plan Summary

This issue ships **documentation only**. No Playwright tests are added here.

| Test coverage | Where |
|---|---|
| Round-trip parse → serialise → parse for new params | `calculator-url.test.ts` (this issue references the doc as source of truth; behavioural coverage in #555–#561) |
| Schema validator | Added in #555 |
| Inline-unit round-trips | `inline-unit.test.ts` (new in #557) |
| `istpbranch` sticky logic | `inverse-stp.spec.ts` E2E (new in #560) |

---

## 9. Cross-Spec Consistency Checklist

- [ ] `uanchor=` replaces `eunit=` in canonical output; migration reads `eunit=` and maps tokens (#555).
- [ ] `qshow=stp|range` replaces `qfocus=stp|csda|both`; `multi-program.svelte.ts` + `multi-entity.svelte.ts` state shape updated (#561).
- [ ] `mode=forward|range|inverse-stp` replaces `imode=csda|stp`; route handling updated (#558).
- [ ] `across=` URL param wired to entity-selection state (#561).
- [ ] `istpbranch=` round-trips through `calculator-url.ts` (#560).
- [ ] `runit=` token set extended to `nm|um|mm|cm|dm|m|km` (#558).
- [ ] `lookups=` replaces `ivalues=` in encoder/decoder + state field (#555 / #560).
- [ ] `hidden=` / `hidden_programs=` silently dropped (#561 migration).
- [ ] `shareable-urls-formal.md` ABNF grammar updated with v2 params after #561.
- [ ] `shareable-urls.md` §3–§5 updated to reference this doc after #561.
- [ ] `docs/04-feature-specs/README.md` status table updated after #561.
