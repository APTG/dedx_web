# Feature: Shareable URLs — Formal Contract (ABNF + Semantic Rules)

> **Status:** Draft v1 (8 April 2026)
>
> This document is the machine-oriented companion to
> [`shareable-urls.md`](shareable-urls.md). It defines:
> - ABNF grammar for query-string syntax
> - semantic validation/default/precedence rules
> - canonicalization algorithm
> - conformance test vectors
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

ABNF notation follows RFC 5234. Query strings are treated as already URL-decoded
before parsing (percent-decoding step occurs first).

```abnf
query               = pair *("&" pair)

pair                = urlv-pair
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
                    / unknown-pair

; -----------------------------
; shared core params
; -----------------------------
urlv-pair           = "urlv=" int-pos
particle-pair       = "particle=" int-pos
material-pair       = "material=" int-pos
program-pair        = "program=" ("auto" / int-pos)

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
programs-pair       = "programs=" int-pos *("," int-pos)
hidden-programs-pair= "hidden_programs=" int-pos *("," int-pos)
qfocus-pair         = "qfocus=" ("both" / "stp" / "csda")

; -----------------------------
; plot params
; -----------------------------
series-pair         = "series=" series-item *("," series-item)
series-item         = int-pos "." int-pos "." int-pos
stp-unit-pair       = "stp_unit=" ("kev-um" / "mev-cm" / "mev-cm2-g")
xscale-pair         = "xscale=" ("log" / "lin")
yscale-pair         = "yscale=" ("log" / "lin")

; -----------------------------
; lexical rules
; -----------------------------
int-pos             = nz-digit *digit
number              = signless-int / signless-float / signless-sci
signless-int        = 1*digit
signless-float      = 1*digit "." 1*digit
signless-sci        = (signless-int / signless-float) ("e" / "E") ["+" / "-"] 1*digit

unknown-pair        = key "=" value
key                 = 1*(ALPHA / DIGIT / "_" / "-")
value               = *(ALPHA / DIGIT / "." / "/" / ":" / "_" / "-" / ",")

nz-digit            = %x31-39
sign                = "+" / "-"
```

Notes:
- Grammar permits duplicates syntactically; semantics define resolution.
- `unknown-pair` preserves forward compatibility.

---

## 3. Semantic Rules

## 3.1 Parse Pipeline

1. Parse route (`/calculator` or `/plot`).
2. Percent-decode query.
3. Parse ABNF tokens.
4. Apply duplicate resolution.
5. Apply version negotiation.
6. Apply defaults.
7. Apply conditional enablement/precedence.
8. Validate against compatibility matrix and unit rules.
9. Produce normalized canonical state.
10. Emit canonical URL via `replaceState`.

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
- If `mode == advanced`:
  - use `programs`
  - ignore `program`
  - validate `hidden_programs` subset of `programs`
  - default `qfocus=both`

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
- `hidden_programs` must be subset of selected `programs`.

Energy constraints:
- Value parse must succeed.
- Value must be > 0.
- Unit token must be in allowed set.
- Converted energy must be within valid bounds for chosen program/particle.

Plot constraints:
- Each `series` triplet must be valid; invalid triplets are dropped.
- Partial success is allowed.

---

## 4. Canonicalization Algorithm

Canonical parameter order:
1. `urlv`
2. `particle`, `material`, `program` OR `programs`
3. page params
  - calculator: `energies`, `eunit`
  - plot: `series`, `stp_unit`, `xscale`, `yscale`
4. conditional advanced params: `mode`, `hidden_programs`, `qfocus`

Normalization rules:
- Always emit `urlv`.
- Always emit explicit defaulted page-state params.
- Emit comma-separated ID lists without spaces.
- Preserve order of `programs` as display order.
- Emit `hidden_programs` only when non-empty.
- Emit `mode=advanced` only when advanced mode is active.
- Emit `qfocus` only in advanced mode (emit default `both` explicitly for canonical consistency).
- Emit `program=auto` in basic mode unless explicit valid program is selected.

---

## 5. Conformance Test Vectors

### 5.1 Valid Inputs

1. Basic calculator:
- Input: `urlv=1&particle=1&material=276&program=auto&energies=100,200&eunit=MeV`
- Result: valid, canonical unchanged.

2. Advanced calculator:
- Input: `urlv=1&particle=1&material=276&programs=9,2&mode=advanced&qfocus=stp&energies=100&eunit=MeV`
- Result: valid, canonical adds/removes only defaults per algorithm.

3. Plot:
- Input: `urlv=1&particle=1&material=276&program=auto&series=9.1.276,2.1.276&stp_unit=kev-um&xscale=log&yscale=log`
- Result: valid.

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
- Plot series semantics: [`plot.md`](plot.md)
- Entity compatibility rules: [`entity-selection.md`](entity-selection.md)
- Type and ID source of truth: [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md)
