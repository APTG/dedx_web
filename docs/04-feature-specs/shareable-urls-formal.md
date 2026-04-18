# Feature: Shareable URLs — Formal Contract (ABNF + Semantic Rules)

> **Status:** Final v6 (13 April 2026)
>
> This document is the machine-oriented companion to
> [`shareable-urls.md`](shareable-urls.md). It defines:
> - ABNF grammar for query-string syntax
> - semantic validation/default/precedence rules
> - canonicalization algorithm
> - conformance test vectors
>
> **v1** (8 April 2026): Initial formal grammar, parse pipeline, canonicalization
> algorithm, and conformance vectors.
>
> **v2** (8 April 2026): ABNF allows trailing `&`/empty segments, `unknown-pair`
> value widened to any char except `&`/`=`, `series` canonicalization rule added,
> parse pipeline refined for per-component percent-decoding.
>
> **v3** (9 April 2026): Integrated `extdata` (external data sources) into grammar
> and parse pipeline. `url-value` charset tightened to exclude `&`, `=`, and `:`.
> `series-item` extended to support `ext:{label}:{id}` triplet components for
> external entities. `programs` and `hidden_programs` updated to accept `entity-id`
> (built-in int or `ext-ref`). Canonicalization §4 rewritten to unambiguously
> specify `program` vs `programs` by mode, sub-ordering within advanced-mode params,
> and `extdata` placement.
>
> **v4** (10 April 2026): Added Advanced Options parameters (`agg_state`,
> `interp_scale`, `interp_method`, `mstar_mode`, `density`, `ival`) to ABNF
> grammar (§2), semantic rules §3.5–§3.7, canonicalization §4 (step 7), and
> conformance vectors §5. Sourced from `advanced-options.md`.
>
> **v5** (10 April 2026): Added inverse-lookup parameters (`imode`, `ivalues`,
> `iunit`) to ABNF grammar (§2), semantic rules §3.5, canonicalization §4 (step 8),
> and conformance vectors §5. `stp-iunit-token` and `length-unit-token` rules
> added. Sourced from `inverse-lookups.md` §9.
>
> **v6** (13 April 2026): Added custom compound parameters (`mat_name`,
> `mat_density`, `mat_elements`, `mat_ival`, `mat_phase`) to ABNF grammar (§2),
> `material-pair` extended to accept `"custom"` sentinel, semantic rules §3.5
> and §3.8 (custom compound enablement and validation), canonicalization §4
> (step 9), and conformance vectors §5 (vectors 18–21). Sourced from
> `custom-compounds.md`.
>
> **Normative relationship:**
> - If this file and `shareable-urls.md` conflict on syntax, this file wins.
> - If they conflict on UX behavior (warnings/messages), `shareable-urls.md` wins.

---

## 1. Scope

This grammar covers URL query strings for:
- Calculator basic mode
- Calculator advanced mode
- Plot page

It does not encode route path itself (`/calculator`, `/plot`) in ABNF rules below.

---

## 2. ABNF Grammar

ABNF notation follows RFC 5234. Query strings are tokenized on raw `&` and raw `=`
first, then each key/value component is percent-decoded individually (or parsed via
`URLSearchParams`). The full raw query string must not be percent-decoded before
tokenization, because encoded delimiters such as `%26` and `%3D` belong to values.

```abnf
query               = [pair *("&" [pair])]

pair                = urlv-pair
                    / extdata-pair
                    / particle-pair
                    / material-pair
                    / program-pair
                    / programs-pair
                    / hidden-programs-pair
                    / qfocus-pair
                    / mode-pair
                    / energies-pair
                    / eunit-pair
                    / series-pair
                    / stp-unit-pair
                    / xscale-pair
                    / yscale-pair
                    / agg-state-pair
                    / interp-scale-pair
                    / interp-method-pair
                    / mstar-mode-pair
                    / density-pair
                    / ival-pair
                    / imode-pair
                    / ivalues-pair
                    / iunit-pair
                    / mat-name-pair
                    / mat-density-pair
                    / mat-elements-pair
                    / mat-ival-pair
                    / mat-phase-pair
                    / unknown-pair

; -----------------------------
; shared core params
; -----------------------------
urlv-pair           = "urlv=" int-pos
extdata-pair        = "extdata=" ext-label ":" url-value
                    ; ext-label is the stable source label assigned by the user.
                    ; url-value is the percent-encoded URL of the .webdedx
                    ; Zarr v3 store root. The first literal ':' in the raw parameter value is
                    ; unambiguously the label/URL separator (url-value excludes ':').
particle-pair       = "particle=" int-pos
material-pair       = "material=" (int-pos / "custom")
                    ; "custom" sentinel used when a user-defined compound is active
program-pair        = "program=" ("auto" / int-pos)    ; basic mode only

; -----------------------------
; calculator params
; -----------------------------
energies-pair       = "energies=" energies
energies            = energy-item *("," energy-item)
energy-item         = number [":" energy-unit-token]

eunit-pair          = "eunit=" energy-unit-token
energy-unit-token   = "MeV"
                    / "MeV/nucl"
                    / "MeV/u"
                    / "keV"
                    / "GeV"
                    / "keV/nucl"
                    / "GeV/nucl"
                    / "keV/u"
                    / "GeV/u"

mode-pair           = "mode=" ("basic" / "advanced")
programs-pair       = "programs=" entity-id *("," entity-id)   ; advanced mode only
hidden-programs-pair= "hidden_programs=" entity-id *("," entity-id)
qfocus-pair         = "qfocus=" ("both" / "stp" / "csda")

; -----------------------------
; plot params
; -----------------------------
series-pair         = "series=" series-item *("," series-item)
series-item         = entity-id "." entity-id "." entity-id
                    ; components are programId.particleId.materialId
                    ; each may be a built-in int-pos or an ext-ref
stp-unit-pair       = "stp_unit=" ("kev-um" / "mev-cm" / "mev-cm2-g")
xscale-pair         = "xscale=" ("log" / "lin")
yscale-pair         = "yscale=" ("log" / "lin")

; -----------------------------
; advanced options params (Advanced mode only; omitted at default values)
; -----------------------------
agg-state-pair      = "agg_state=" agg-state-token
agg-state-token     = "gas" / "condensed"
                    ; emitted only when selected state ≠ material built-in phase
                    ; (i.e. an override is active)

interp-scale-pair   = "interp_scale=" interp-scale-token
interp-scale-token  = "lin-lin"
                    ; only non-default value emitted; omitted when "log-log"

interp-method-pair  = "interp_method=" interp-method-token
interp-method-token = "spline"
                    ; only non-default value emitted; omitted when "linear"

mstar-mode-pair     = "mstar_mode=" mstar-mode-token
mstar-mode-token    = "a" / "b" / "c" / "d" / "g" / "h"
                    ; omitted when value = "b" (default)

density-pair        = "density=" number
                    ; number must parse as positive (> 0); omitted when not set
                    ; very small values may use scientific notation: e.g. 8.99e-5

ival-pair           = "ival=" number
                    ; number must parse as positive and ≤ 10000; omitted when not set

; -----------------------------
; inverse-lookup params (Calculator only; Advanced mode only)
; omitted entirely when the Forward tab is active; silently dropped in Basic mode
; -----------------------------
imode-pair          = "imode=" imode-token
imode-token         = "stp" / "csda"
                    ; "csda" = Range tab (energy from CSDA range)
                    ; "stp"  = Inverse STP tab (energy from stopping power)

ivalues-pair        = "ivalues=" ivalues-list
ivalues-list        = ivalue-item *("," ivalue-item)
ivalue-item         = number [":" ivalue-unit-token]
                    ; per-value unit suffix overrides iunit for that row
                    ; when imode=stp: must be stp-iunit-token
                    ; when imode=csda: must be length-unit-token

iunit-pair          = "iunit=" ivalue-unit-token
                    ; master unit for all rows without a per-value suffix
                    ; when imode=stp:  one of stp-iunit-token (default: kev-um for
                    ;   non-gas, mev-cm2-g for gas — omit when equal to default)
                    ; when imode=csda: one of length-unit-token (default: cm —
                    ;   omit when equal to default)

ivalue-unit-token   = stp-iunit-token / length-unit-token

stp-iunit-token     = "kev-um" / "mev-cm" / "mev-cm2-g"
                    ; URL-safe kebab tokens; same mapping as stp-unit-pair:
                    ;   kev-um    → keV/µm
                    ;   mev-cm    → MeV/cm
                    ;   mev-cm2-g → MeV·cm²/g

length-unit-token   = "nm" / "um" / "mm" / "cm" / "m"
                    ; "um" is the canonical URL token for µm

; -----------------------------
; custom compound params (Advanced mode only; only when material=custom)
; -----------------------------
mat-name-pair       = "mat_name=" value
                    ; compound name; percent-decoded (URLSearchParams behavior)
mat-density-pair    = "mat_density=" number
                    ; material density in g/cm³; must be > 0; scientific notation allowed
mat-elements-pair   = "mat_elements=" mat-element *("," mat-element)
                    ; comma-separated list; elements in ascending Z order (canonical)
mat-element         = int-pos ":" number
                    ; int-pos = atomic number Z ∈ [1, 118]
                    ; number = atom count > 0 (may be fractional)
mat-ival-pair       = "mat_ival=" number
                    ; mean excitation potential in eV; must be > 0 and ≤ 10000
                    ; omitted when compound has no iValue
mat-phase-pair      = "mat_phase=" ("gas" / "condensed")
                    ; omitted when "condensed" (default)

; -----------------------------
; entity ID (built-in or external)
; -----------------------------
entity-id           = int-pos / ext-ref
ext-ref             = "ext:" ext-label ":" entity-local-id
ext-label           = 1*(ALPHA / DIGIT / "_" / "-")
entity-local-id     = 1*(ALPHA / DIGIT / "_" / "-")

; -----------------------------
; lexical rules
; -----------------------------
int-pos             = nz-digit *digit
number              = signless-int / signless-float / signless-sci
signless-int        = 1*digit
signless-float      = 1*digit "." 1*digit
signless-sci        = (signless-int / signless-float) ("e" / "E") ["+" / "-"] 1*digit

unknown-pair        = key ["=" value]
key                 = 1*(ALPHA / DIGIT / "_" / "-")
value               = *(%x20-25 / %x27-3C / %x3E-FF)
                    ; any char except '&' (%x26) and '=' (%x3D)
                    ; after per-component percent-decoding

url-value           = 1*(%x21-25 / %x27-39 / %x3B-3C / %x3E-FF)
                    ; printable ASCII excluding:
                    ;   space (%x20), '&' (%x26), '=' (%x3D), ':' (%x3A)
                    ; Ranges: %x21-25 = '!'-'%', %x27-39 = '''-'9' (excl. ':'),
                    ;         %x3B-3C = ';'-'<', %x3E-FF = '>'-high.
                    ; The external URL must be percent-encoded so that its own
                    ; ':' characters (e.g. in 'https:') never appear literally.

nz-digit            = %x31-39
```

Notes:
- Grammar permits duplicates syntactically; semantics define resolution.
- `unknown-pair` preserves forward compatibility.
- `extdata-pair` may appear multiple times (one per external source).
- `ext-ref` uses the stable label assigned in `extdata-pair`, not a positional index.

---

## 3. Semantic Rules

## 3.1 Parse Pipeline

1. Parse route (`/calculator` or `/plot`).
2. Split raw query on `&` into pairs, ignoring empty segments.
3. For each pair, split on the first raw `=` into key/value components; a bare key is treated as an empty-string value.
4. Percent-decode each key/value component individually, or rely on equivalent `URLSearchParams` behavior.
5. For each `extdata` value, split on the first literal `:` to extract the label and the percent-encoded URL. Validate label matches `ext-label` rule. Collect ordered list of `(label, url)` pairs. Labels must be unique across all `extdata` occurrences; duplicate labels are a parse error (treat as unknown param).
6. Parse ABNF tokens.
7. Apply duplicate resolution.
8. Apply version negotiation.
9. Resolve external data sources: fetch and validate each `extdata` source; merge external entities into compatibility matrix (see `external-data.md` §5).
10. Apply defaults.
11. Apply conditional enablement/precedence.
12. Validate against compatibility matrix and unit rules.
13. Produce normalized canonical state.
14. Emit canonical URL via `replaceState`.

## 3.2 Duplicate Parameter Resolution

If the same key appears multiple times, use the **last occurrence**.
Rationale: browser and framework behavior often exposes last value.

## 3.3 Unknown Parameters

Unknown parameters are ignored for runtime state, but preserved nowhere in canonical output.
Canonical output drops unknown params.

## 3.4 Version Negotiation

Constants:
- `CURRENT_URL_MAJOR = 1`
- `MIN_SUPPORTED_URL_MAJOR = 1`

Rules:
- Missing `urlv` => assume `1`.
- `urlv == CURRENT_URL_MAJOR` => parse normally.
- `MIN_SUPPORTED_URL_MAJOR <= urlv < CURRENT_URL_MAJOR` => migrate through registered chain.
- `urlv < MIN_SUPPORTED_URL_MAJOR` or `urlv > CURRENT_URL_MAJOR` => major mismatch:
  - block calculation
  - show warning UI
  - allow `Try migration` (if available) or `Load defaults`.

## 3.5 Conditional Enablement and Precedence

- If `mode != advanced`:
  - ignore `programs`, `hidden_programs`, `qfocus`
  - use `program`
  - **ignore all Advanced Options params**: `agg_state`, `interp_scale`,
    `interp_method`, `mstar_mode`, `density`, `ival` are silently dropped
  - **ignore all inverse-lookup params**: `imode`, `ivalues`, `iunit` are
    silently dropped (inverse tabs are hidden in Basic mode)
- If `mode == advanced`:
  - use `programs`
  - ignore `program`
  - validate `hidden_programs` subset of `programs`
  - default `qfocus=both`
  - Advanced Options params are parsed and applied (see §3.6, §3.7)
  - `imode` activates the indicated inverse tab; absent → Forward tab active
  - `ivalues` and `iunit` are parsed and applied only when `imode` is present

Energy precedence:
- In `energies`, per-row suffix (`value:unit`) overrides `eunit` for that row.
- Unsuffixed rows inherit `eunit`.

## 3.6 Defaults

Global:
- `urlv=1`
- `particle=1`
- `material=276`
- `program=auto`

Calculator:
- `eunit=MeV`
- `energies=100` if missing/empty

Advanced Options (when `mode=advanced`; all omit-when-default):
- `agg_state` — absent = no override (toggle lands on material built-in phase)
- `interp_scale` — absent = `"log-log"`
- `interp_method` — absent = `"linear"`
- `mstar_mode` — absent = `"b"`
- `density` — absent = no override (built-in density used)
- `ival` — absent = no override (built-in I-value used)

Inverse-lookup (when `mode=advanced`; only parsed when `imode` is present):
- `imode` — absent = Forward tab active (no inverse tab)
- `ivalues` — absent = tab opens with default pre-filled row
- `iunit` — absent = default for active imode and material phase:
  - `imode=stp`, non-gas material → `kev-um`
  - `imode=stp`, gas material → `mev-cm2-g`
  - `imode=csda` → `cm`

Plot:
- `stp_unit=kev-um`
- `xscale=log`
- `yscale=log`
- `series` optional (empty = no committed series)

## 3.7 Validation Constraints

Entity constraints:
- IDs must exist in compatibility matrix.
- Program must support particle+material.

Advanced constraints:
- `programs` list after validation must be non-empty; otherwise fallback to auto-selected single program.
- `hidden_programs` must be a subset of selected `programs`. Both lists accept `entity-id` (built-in `int-pos` or `ext-ref`); mixed built-in and external programs are allowed in both lists.

Energy constraints:
- Value parse must succeed.
- Value must be > 0.
- Unit token must be in allowed set.
- Converted energy must be within valid bounds for chosen program/particle.

Plot constraints:
- Each `series` triplet must be valid; invalid triplets are dropped.
- Partial success is allowed.

Inverse-lookup constraints (applied only when `mode=advanced` and `imode` present):
- `imode`: value must be `"stp"` or `"csda"`. Invalid value → silently ignored
  (Forward tab loads).
- `ivalues`: each item is parsed as `number[":" ivalue-unit-token]`. Items where
  the number fails to parse are silently dropped. Items with an unrecognized unit
  token are silently dropped. Empty list → tab opens with default pre-filled row.
- `iunit`: value must be a valid `stp-iunit-token` (for `imode=stp`) or
  `length-unit-token` (for `imode=csda`). Type mismatch or unknown value →
  silently ignored (default unit used).
- `ivalues` per-value suffixes override `iunit` for that row. Suffixes must match
  the expected type for the active `imode`; mismatched suffixes → row invalid on
  load (same as unrecognized suffix typed by user).
- `ivalues` and `iunit` without `imode` → silently ignored.

## 3.8 Custom Compound Constraints

Applied only when `mode=advanced` AND `material=custom`. All `mat_*`
params are silently ignored when either condition is false.

- `mat_name`: must be non-empty after percent-decoding and trimming.
  Missing or blank → fall back to default material (liquid water, ID 276);
  show warning banner.
- `mat_density`: must parse as a finite positive number (> 0). Scientific
  notation valid. Missing, zero, negative, or non-numeric → fall back to
  default material; show warning banner.
- `mat_elements`: must be present with at least one valid element token.
  Missing entirely → fall back to default material; show warning banner.
  Individual token errors:
  - Z outside [1, 118] → silently drop that element
  - atom count ≤ 0 or non-numeric → silently drop that element
  - duplicate Z → collapse by summing counts
  - If all tokens are invalid → fall back to default material; show warning
- `mat_ival`: must parse as a positive number > 0 and ≤ 10 000. Out of
  range or non-numeric → silently ignored (compound proceeds without
  iValue override).
- `mat_phase`: must be `"gas"` or `"condensed"`. Unknown value → silently
  ignored; defaults to `"condensed"`.

Receiving `material=custom` does **not** automatically save the compound
to `localStorage`. A dismissible "Compound from shared URL" banner is
shown (see `custom-compounds.md` §6.4).

Advanced Options constraints (applied only when `mode=advanced`):
- `agg_state`: value must be `"gas"` or `"condensed"`. If the value equals the
  material's built-in phase, treat as no override (same as absent).
  Invalid values → silently ignored (no override applied).
- `interp_scale`: value must be `"lin-lin"`. Any other value → silently ignored
  (default `"log-log"` used).
- `interp_method`: value must be `"spline"`. Any other value → silently ignored
  (default `"linear"` used).
- `mstar_mode`: value must be one of `"a"` `"b"` `"c"` `"d"` `"g"` `"h"`.
  Invalid values → silently ignored (default `"b"` used).
- `density`: must parse as a finite positive number (> 0). Scientific notation
  (e.g. `8.99e-5`) is valid. Zero, negative, non-numeric, or non-finite → silently
  ignored (no override applied).
- `ival`: must parse as a positive number > 0 and ≤ 10 000. Out-of-range or
  non-numeric → silently ignored (no override applied).

---

## 4. Canonicalization Algorithm

Canonical parameter order:

1. `urlv`
2. `extdata` — one occurrence per external source, in label-declaration order.
   **Omitted entirely when no external sources are present.**
3. `particle`, `material`
4. Program param — **exactly one** of the following, depending on mode:
   - **Basic mode:** `program` (always emitted; value is `auto` or a built-in numeric
     program ID). `programs` is never emitted in basic mode.
   - **Advanced mode:** `programs` (always emitted; value is a comma-separated list
     of `entity-id` in display order). `program` is never emitted in advanced mode.
5. Page-specific params:
   - Calculator: `energies`, `eunit`
   - Plot: `series`, `stp_unit`, `xscale`, `yscale`
6. Advanced-mode params — present **only** when `mode=advanced`, in this sub-order:
   a. `mode=advanced` (always first among the advanced group)
   b. `hidden_programs` — omitted when the set is empty; otherwise emitted as a
      comma-separated list of `entity-id`
   c. `qfocus` — **always** emitted in advanced mode, even when the value equals
      the default `both`

7. Advanced Options params — present **only** when `mode=advanced`; each
   omitted when at its default value, in this sub-order:
   a. `agg_state` — omitted when no override is active (selected phase = built-in)
   b. `interp_scale` — omitted when value = `"log-log"`
   c. `interp_method` — omitted when value = `"linear"`
   d. `mstar_mode` — omitted when value = `"b"`
   e. `density` — omitted when not set; serialized via JS `Number.prototype.toString()`
      (output may be decimal or scientific notation per ECMAScript number formatting rules)
   f. `ival` — omitted when not set; serialized as decimal number

8. Inverse-lookup params — present **only** when `mode=advanced` and an inverse
   tab is active, in this sub-order:
   a. `imode` — always emitted when an inverse tab is active (`"stp"` or `"csda"`)
   b. `ivalues` — omitted when no input rows have data; per-value suffix uses
      the canonical token form (`stp-iunit-token` or `length-unit-token`)
   c. `iunit` — omitted when equal to the default for the active `imode` and
      material phase (see §3.6); otherwise serialized as a canonical token
      (`stp-iunit-token` or `length-unit-token`)

9. Custom compound params — present **only** when `mode=advanced` AND
   `material=custom`, in this sub-order:
   a. `mat_name` — always emitted (percent-encoded via `encodeURIComponent`)
   b. `mat_density` — always emitted; serialized via `Number.prototype.toString()`
   c. `mat_elements` — always emitted; elements ordered by **ascending Z**;
      atom counts serialized via `Number.prototype.toString()`
   d. `mat_ival` — omitted when compound has no iValue; otherwise emitted as
      decimal number
   e. `mat_phase` — omitted when `"condensed"` (default); emitted as `"gas"`
      otherwise

Normalization rules:
- Always emit `urlv`.
- Always emit `particle`, `material`, and the mode-appropriate program param.
- Always emit explicit defaulted page-state params (`eunit=MeV`, `xscale=log`,
  `yscale=log`, `stp_unit=kev-um`) for deterministic round-trip stability.
- Emit comma-separated ID lists without spaces.
- Preserve declared order of `programs` as display order.
- Emit `hidden_programs` only when non-empty.
- Emit `mode=advanced` only when advanced mode is active; never emit `mode=basic`.
- Emit `qfocus` only in advanced mode (always emit, including when value is `both`).
- Emit `program=auto` in basic mode when no explicit program is selected.
- In `series`, always emit resolved `int-pos` or `ext-ref` triplets; never emit `auto`.
- Emit `extdata={label}:{url}` for each external source using its assigned label.
- Never emit Advanced Options params in basic mode, even if present in localStorage.
- Omit each Advanced Options param individually when at its default (do not emit
  zero-length values or explicit default values like `interp_scale=log-log`).
- Never emit `imode`, `ivalues`, or `iunit` in basic mode.
- Never emit `ivalues` or `iunit` without `imode`.
- Omit `iunit` when equal to the default for the active `imode`/material-phase pair.
- In `ivalues`, per-value unit suffixes use canonical token form (e.g., `cm`, `um`,
  `kev-um`); never emit raw Unicode unit strings in the canonical URL.
- Emit `imode` first among the inverse params; `ivalues` second; `iunit` last.
- When `material=custom`, always emit all required `mat_*` params (`mat_name`,
  `mat_density`, `mat_elements`) in step 9; omit `mat_ival` when absent; omit
  `mat_phase` when condensed.
- Never emit any `mat_*` param when `material` is a built-in integer ID.
- Never emit `mat_*` params in basic mode, even if a custom compound is in memory.
- In `mat_elements`, always emit elements in ascending Z order.
- `mat_name` is always percent-encoded; never emit raw non-ASCII characters.
- `mat_density` and `mat_elements` atom counts are serialized with
  `Number.prototype.toString()` (decimal or scientific notation per ECMAScript rules).

---

## 5. Conformance Test Vectors

### 5.1 Valid Inputs

1. Basic calculator:
- Input: `urlv=1&particle=1&material=276&program=auto&energies=100,200&eunit=MeV`
- Result: valid, canonical unchanged.

2. Advanced calculator (no hidden programs):
- Input: `urlv=1&particle=1&material=276&programs=9,2&mode=advanced&qfocus=stp&energies=100&eunit=MeV`
- Canonical: `urlv=1&particle=1&material=276&programs=9,2&energies=100&eunit=MeV&mode=advanced&qfocus=stp`
- Note: `hidden_programs` omitted (empty set); `mode` precedes `qfocus`.

3. Advanced calculator (with hidden programs):
- Input: `urlv=1&particle=1&material=276&programs=9,2,101&mode=advanced&hidden_programs=2&qfocus=both&energies=100&eunit=MeV`
- Canonical: `urlv=1&particle=1&material=276&programs=9,2,101&energies=100&eunit=MeV&mode=advanced&hidden_programs=2&qfocus=both`
- Note: `mode`, then `hidden_programs`, then `qfocus`; `qfocus=both` always emitted.

4. Plot:
- Input: `urlv=1&particle=1&material=276&program=auto&series=9.1.276,2.1.276&stp_unit=kev-um&xscale=log&yscale=log`
- Result: valid, canonical unchanged.

5. External data source (labeled):
- Input: `urlv=1&extdata=srim:https%3A%2F%2Fexample.com%2Fsrim.webdedx&particle=1&material=276&program=auto&series=ext%3Asrim%3Asrim-2013.ext%3Asrim%3Ap.ext%3Asrim%3Awater,9.1.276&stp_unit=kev-um&xscale=log&yscale=log`
- Result: label `srim` assigned to the external source; series mixes one external
  triplet (`ext:srim:srim-2013` / `ext:srim:p` / `ext:srim:water`) and one built-in
  triplet (`9` / `1` / `276`). Canonical form unchanged.

### 5.2 Invalid / Recovery

1. Unsupported version:
- Input: `urlv=99&particle=1&material=276`
- Result: show major-mismatch warning; no silent calc.

2. Missing version legacy:
- Input: `particle=1&material=276&program=auto`
- Result: parse as v1; canonical emit includes `urlv=1`.

3. Invalid unit token:
- Input: `urlv=1&particle=1&material=276&energies=100:foo&eunit=MeV`
- Result: row invalid; excluded from calculation.

4. Advanced params in basic mode:
- Input: `urlv=1&particle=1&material=276&mode=basic&programs=9,2&qfocus=stp`
- Result: ignore advanced params; parse as basic.

5. Advanced Options — density + aggregate state override:
- Input: `urlv=1&particle=1&material=3&programs=9,2&energies=100&eunit=MeV&mode=advanced&qfocus=both&agg_state=condensed&density=8.99e-5`
- Canonical: same (all params in canonical order; both at non-default values so neither omitted).

6. Advanced Options — lin-lin scale + spline method:
- Input: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&interp_scale=lin-lin&interp_method=spline`
- Canonical: same.

7. Advanced Options — MSTAR mode, non-default:
- Input: `urlv=1&particle=1&material=276&programs=101&energies=100&eunit=MeV&mode=advanced&qfocus=both&mstar_mode=c`
- Canonical: same.

8. Advanced Options — default values are omitted:
- Input: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&interp_scale=log-log&mstar_mode=b`
- Canonical: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both`
- Note: both params equal their defaults → omitted in canonical output.

9. Advanced Options in basic mode — silently dropped:
- Input: `urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&density=1.2&agg_state=condensed`
- Canonical: `urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV`
- Note: no `mode=advanced` → Advanced Options params stripped.

10. Advanced Options — invalid density silently ignored:
- Input: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&density=-1`
- Canonical: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both`
- Note: negative density invalid → treated as absent.

11. Advanced Options — `agg_state` equals material built-in → no override:
- Input: `urlv=1&particle=1&material=3&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&agg_state=gas`
  (material 3 is a gas by default)
- Canonical: `urlv=1&particle=1&material=3&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both`
- Note: `agg_state=gas` matches built-in → no override active → param omitted.

12. Range tab (imode=csda), mixed units, iunit=cm (default — omitted):
- Input: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&imode=csda&ivalues=7.718:cm,45:um,1.5:mm&iunit=cm`
- Canonical: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&imode=csda&ivalues=7.718:cm,45:um,1.5:mm`
- Note: `iunit=cm` equals the default for `imode=csda` (non-gas material) → omitted.
  Per-value suffixes are retained; all are canonical `length-unit-token` values.

13. Range tab (imode=csda), no suffixes, non-default master unit:
- Input: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&imode=csda&ivalues=7.718,1.5&iunit=mm`
- Canonical: same (unchanged; `iunit=mm` is non-default so it is emitted).

14. Inverse STP tab (imode=stp), non-gas material, iunit=kev-um (default — omitted):
- Input: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&imode=stp&ivalues=45.76,10.00&iunit=kev-um`
- Canonical: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&imode=stp&ivalues=45.76,10.00`
- Note: `iunit=kev-um` equals the default for `imode=stp` non-gas → omitted.

15. Inverse params in basic mode — silently dropped:
- Input: `urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV&imode=csda&ivalues=7.718&iunit=cm`
- Canonical: `urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV`
- Note: no `mode=advanced` → inverse params stripped.

16. `ivalues` without `imode` — silently ignored:
- Input: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&ivalues=7.718`
- Canonical: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both`
- Note: `ivalues` without `imode` → dropped.

17. Invalid `imode` value — silently ignored (Forward tab loads):
- Input: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&imode=foo&ivalues=7.718`
- Canonical: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both`
- Note: `imode=foo` is not a valid `imode-token` → dropped; `ivalues` without `imode` also dropped.

18. Custom compound — PMMA, condensed (phase omitted), no iValue:
- Input: `urlv=1&particle=1&material=custom&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&mat_name=PMMA&mat_density=1.2&mat_elements=1:8,6:5,8:2`
- Canonical: same (all params in canonical order; `mat_phase` omitted because condensed is default; `mat_ival` omitted because absent).
- Note: elements in ascending Z (H=1, C=6, O=8) ✓.

19. Custom compound — LiF pellets, condensed (explicitly specified), with iValue:
- Input: `urlv=1&particle=2&material=custom&programs=101&energies=5&eunit=MeV&mode=advanced&qfocus=both&mat_name=LiF%20pellet&mat_density=2.2&mat_elements=3:1,9:1&mat_ival=94.0&mat_phase=condensed`
- Canonical: `urlv=1&particle=2&material=custom&programs=101&energies=5&eunit=MeV&mode=advanced&qfocus=both&mat_name=LiF%20pellet&mat_density=2.2&mat_elements=3:1,9:1&mat_ival=94`
- Note: `mat_phase=condensed` was explicitly provided in input, but canonicalization omits it because condensed is the default phase (§4 step 9e).
- Note: elements in ascending Z (Li=3, F=9) ✓; `mat_ival=94` (ECMAScript drops trailing .0).

20. Custom compound — `mat_*` params in basic mode — silently dropped:
- Input: `urlv=1&particle=1&material=custom&program=auto&energies=100&eunit=MeV&mat_name=PMMA&mat_density=1.2&mat_elements=1:8,6:5,8:2`
- Canonical: `urlv=1&particle=1&material=276&program=auto&energies=100&eunit=MeV`
- Note: no `mode=advanced` → `material=custom` and `mat_*` params silently dropped; material defaults to liquid water (276).

21. Custom compound — `mat_name` missing → fall back:
- Input: `urlv=1&particle=1&material=custom&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&mat_density=1.2&mat_elements=1:8,6:5,8:2`
- Result: `mat_name` absent → fall back to default material (276); show warning banner.
- Canonical: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both`

---

## 6. Implementation Guidance

Recommended architecture:
- `parseQuery(raw: string): ParsedTokens` (ABNF-equivalent parser)
- `resolveState(tokens, route, services): ResolvedState` (semantic pass)
- `canonicalize(state): string` (single canonical URL writer)
- `migrateUrl(vFrom, vTo, state): state` (version migration chain)

Validation should be deterministic and side-effect free.

---

## 7. Cross-References

- Primary product behavior: [`shareable-urls.md`](shareable-urls.md)
- Multi-program semantics: [`multi-program.md`](multi-program.md)
- Energy units and conversion: [`unit-handling.md`](unit-handling.md)
- Custom compounds (mat_* params, §6 URL contract): [`custom-compounds.md`](custom-compounds.md)
- Plot series semantics: [`plot.md`](plot.md)
- Entity compatibility rules: [`entity-selection.md`](entity-selection.md)
- Type and ID source of truth: [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md)
- Advanced Options semantics and defaults: [`advanced-options.md`](advanced-options.md)
