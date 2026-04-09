# Feature: Shareable URLs — Formal Contract (ABNF + Semantic Rules)

> **Status:** Final v3 (9 April 2026)
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
                    / unknown-pair

; -----------------------------
; shared core params
; -----------------------------
urlv-pair           = "urlv=" int-pos
extdata-pair        = "extdata=" ext-label ":" url-value
                    ; ext-label is the stable source label assigned by the user.
                    ; url-value is the percent-encoded URL of the .webdedx.parquet
                    ; file. The first literal ':' in the raw parameter value is
                    ; unambiguously the label/URL separator (url-value excludes ':').
particle-pair       = "particle=" int-pos
material-pair       = "material=" int-pos
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
- `hidden_programs` must be a subset of selected `programs`. Both lists accept `entity-id` (built-in `int-pos` or `ext-ref`); mixed built-in and external programs are allowed in both lists.

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
- Input: `urlv=1&extdata=srim:https%3A%2F%2Fexample.com%2Fsrim.webdedx.parquet&particle=1&material=276&program=auto&series=ext%3Asrim%3Asrim-2013.ext%3Asrim%3Ap.ext%3Asrim%3Awater,9.1.276&stp_unit=kev-um&xscale=log&yscale=log`
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
