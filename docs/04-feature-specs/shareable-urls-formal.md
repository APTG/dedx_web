# Feature: Shareable URLs — Formal Contract (ABNF + Semantic Rules)

> **Status:** v10 (2026-07-13) — issue #840: `calc=`, `lookups=`, `runit=`,
> `sunit=`, and `istpbranch=` are no longer advanced-mode-only (§3.5, §4 items
> 8/12/14) — the Energy→/Range→/STP→ tab selector is shared state between
> basic and advanced mode. Added an implementation-gap note (§3.5): the
> shipped `calculator-url.ts` still uses the retired v1 names `imode=`/
> `iunit=` for two of these tokens rather than the v3-canonical `calc=`/
> `runit=`/`sunit=`; reconciling that is tracked separately from #840. New
> conformance vector 3a (§5.1).
>
> **Status:** v9 (2026-06-01) — v3 URL schema (`urlv=3`): the list-item
> separator changed from `,` to `~` (issue #672) because messenger/email
> auto-linkifiers truncate links at the first comma. v2 links are still accepted
> on read (the decoders read both separators) and upgraded to canonical v3 on
> load; v1 remains retired (no longer migrated, see §3.4). Parser uses the §6
> layered architecture (Peggy grammar → AST → resolver → canonical writer) with
> span-accurate diagnostics (§3.9).
>
> **Cross-check:** If this file disagrees with `shareable-urls.md`, this formal contract wins.
>
> This document is the machine-oriented companion to
> [`shareable-urls.md`](shareable-urls.md). It defines:
>
> - ABNF grammar for query-string syntax (v2 + deprecated v1 accepted for migration)
> - Semantic validation / default / precedence rules
> - Canonicalization algorithm
> - Conformance test vectors
>
> **v1–v6** (April 2026): initial formal grammar for v1 schema (`urlv=1`).
>
> **v7** (2026-05-23): rewritten for v2 schema (`urlv=2`). Grammar extended with
> `uanchor=`, `runit=`, `sunit=`, `lookups=`, `qshow=`, `across=`, `istpbranch=`,
> `tip_seen=`; `mode=` kept as explicit picker mode (`basic|advanced`);
> `calc=` added for calculator operation (`forward|range|inverse-stp`);
> `length-unit-token` extended with `dm` and `km`; deprecated v1 params marked with
> `;(deprecated)` — still parsed for migration, never emitted in canonical v2 output.
>
> **v9** (2026-06-01): v3 schema (`urlv=3`). The list-item separator is now `~`
> (RFC 3986 _unreserved_) instead of `,`; see `list-sep`. Decoders accept `~`
> **and** the legacy `,` so pre-#672 links keep working; canonical output emits
> `~` only. No other token changed, so `urlv=2` stays within the supported range
> (`MIN_SUPPORTED_URL_MAJOR = 2`).
>
> **Normative relationship:**
>
> - If this file and `shareable-urls.md` conflict on syntax, this file wins.
> - If they conflict on UX behavior (warnings/messages), `shareable-urls.md` wins.

---

## 1. Scope

This grammar covers URL query strings for:

- Calculator page (basic and advanced mode)
- Plot page

It does not encode the route path itself (`/calculator`, `/plot`).

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
                    / picker-mode-pair
                    / particle-pair
                    / particles-pair
                    / material-pair
                    / materials-pair
                    / program-pair
                    / programs-pair
                    / across-pair
                    / energies-pair
                    / lookups-pair
                    / uanchor-pair
                    / runit-pair
                    / sunit-pair
                    / calc-pair
                    / qshow-pair
                    / istpbranch-pair
                    / tip-seen-pair
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
                    / mat-name-pair
                    / mat-density-pair
                    / mat-elements-pair
                    / mat-ival-pair
                    / mat-phase-pair
                    / matsrc-pair
                    ; Deprecated v1 pairs — still parsed for migration:
                    / eunit-pair
                    / qfocus-pair
                    / imode-pair
                    / ivalues-pair
                    / iunit-pair
                    / hidden-programs-pair
                    / unknown-pair

; -----------------------------
; shared core params
; -----------------------------
urlv-pair           = "urlv=" int-pos
extdata-pair        = "extdata=" ext-label ":" url-value
                    ; label/url separator is the first literal ':' in the value
particle-pair       = "particle=" int-pos
particles-pair      = "particles=" entity-id *(list-sep entity-id)   ; advanced mode, across=particles only
material-pair       = "material=" (int-pos / "custom")
materials-pair      = "materials=" entity-id *(list-sep entity-id)   ; advanced mode, across=materials only
program-pair        = "program=" ("auto" / int-pos)
programs-pair       = "programs=" entity-id *(list-sep entity-id)   ; advanced mode, across=programs only

; -----------------------------
; v2 calculator params
; -----------------------------

; Picker mode (v2)
picker-mode-pair    = "mode=" picker-mode-token
picker-mode-token   = "basic" / "advanced"

; Calculator operation mode (v2)
calc-pair           = "calc=" calc-mode-token
calc-mode-token     = "forward" / "range" / "inverse-stp"
                    ; "forward" = Energy → STP + Range (default; omitted in canonical)
                    ; "range"   = CSDA Range → Energy
                    ; "inverse-stp" = STP → Energy

; Compare-across dimension
across-pair         = "across=" across-token
across-token        = "none" / "programs" / "materials" / "particles"
                    ; "none" is the default; omitted in canonical output

; Energy input list (calc=forward only)
energies-pair       = "energies=" energies
energies            = energy-item *(list-sep energy-item)
energy-item         = number [":" energy-unit-token]

; Energy unit anchor (replaces v1 eunit=)
uanchor-pair        = "uanchor=" uanchor-token
uanchor-token       = "MeV" / "MeV/nucl" / "MeV/u"
                    ; physics-style mixed case (CASE-SENSITIVE — lowercase "mev"
                    ; would mean millielectronvolt and is rejected); always
                    ; emitted in canonical URL. See `shareable-urls.md` §1.3
                    ; (Case Sensitivity Policy).

; Inverse-lookup input list (calc=range or calc=inverse-stp only)
lookups-pair        = "lookups=" lookups-list
lookups-list        = lookup-item *(list-sep lookup-item)
lookup-item         = number [":" lookup-unit-token]
lookup-unit-token   = length-unit-token / stp-unit-token
                    ; calc=range → length-unit-token; calc=inverse-stp → stp-unit-token

; Range unit anchor (for calc=range and CSDA Range column header)
runit-pair          = "runit=" length-unit-token
length-unit-token   = "nm" / "um" / "mm" / "cm" / "dm" / "m" / "km"
                    ; "cm" is the default; omitted in canonical output

; STP unit anchor (for calc=inverse-stp and Stopping Power column header)
sunit-pair          = "sunit=" stp-unit-token
stp-unit-token      = "kev-um" / "mev-cm" / "mev-cm2-g"
                    ; default: "kev-um" (condensed) / "mev-cm2-g" (gas)

; Quantity display toggle (replaces v1 qfocus=; advanced mode only)
qshow-pair          = "qshow=" ("stp" / "range")
                    ; absent = both visible (default); omitted in canonical when both shown

; Inverse-STP branch visibility sticky flag
istpbranch-pair     = "istpbranch=" ("hi" / "lo" / "both")
                    ; "hi" is the default; omitted in canonical

; Tip dismissal
tip-seen-pair       = "tip_seen=" "inline_unit"

; energy-unit-token used in energies= per-row suffix (display form).
; Full cross product of prefix × suffix: 5 prefixes (eV, keV, MeV, GeV, TeV) ×
; 3 suffixes (none, /nucl, /u) = 15 tokens. CASE-SENSITIVE — see §1.3 of
; `shareable-urls.md`.
energy-unit-token   = "eV"      / "keV"      / "MeV"      / "GeV"      / "TeV"
                    / "eV/nucl" / "keV/nucl" / "MeV/nucl" / "GeV/nucl" / "TeV/nucl"
                    / "eV/u"    / "keV/u"    / "MeV/u"    / "GeV/u"    / "TeV/u"

; -----------------------------
; plot params
; -----------------------------
series-pair         = "series=" series-item *(list-sep series-item)
series-item         = entity-id "." entity-id "." entity-id
                    ; components are programId.particleId.materialId
stp-unit-pair       = "stp_unit=" stp-unit-token
xscale-pair         = "xscale=" ("log" / "lin")
yscale-pair         = "yscale=" ("log" / "lin")

; -----------------------------
; advanced options params (omitted at default values)
; -----------------------------
agg-state-pair      = "agg_state=" agg-state-token
agg-state-token     = "gas" / "condensed"

interp-scale-pair   = "interp_scale=" interp-scale-token
interp-scale-token  = "lin-lin"
                    ; only non-default emitted; omitted when "log-log"

interp-method-pair  = "interp_method=" interp-method-token
interp-method-token = "spline"
                    ; omitted when "linear"

mstar-mode-pair     = "mstar_mode=" mstar-mode-token
mstar-mode-token    = "a" / "b" / "c" / "d" / "g" / "h"
                    ; omitted when "b" (default)

density-pair        = "density=" number
ival-pair           = "ival=" number

; -----------------------------
; custom compound params (advanced mode only; only when material=custom)
; -----------------------------
mat-name-pair       = "mat_name=" value
mat-density-pair    = "mat_density=" number
mat-elements-pair   = "mat_elements=" mat-element *(list-sep mat-element)
mat-element         = int-pos ":" number
mat-ival-pair       = "mat_ival=" number
mat-phase-pair      = "mat_phase=" ("gas" / "condensed")
matsrc-pair         = "matsrc=" ("transient" / "saved")   ;(omitted when "saved")

; -----------------------------
; DEPRECATED v1 params (accepted on read for migration; never emitted in v2)
; -----------------------------
eunit-pair          = "eunit=" v1-energy-unit-token         ;(deprecated → uanchor=)
v1-energy-unit-token= energy-unit-token
                    ; v1 accepted the same token set as the v2 per-row suffix;
                    ; on migration the value is mapped to the corresponding
                    ; uanchor= token. Prefixed values (keV/GeV/eV/TeV) were
                    ; never valid v1 master anchors but are still parsed for
                    ; lenient migration; they map to uanchor=MeV (the base).

qfocus-pair         = "qfocus=" ("both" / "stp" / "csda")  ;(deprecated → qshow=)

imode-pair          = "imode=" ("stp" / "csda")             ;(deprecated → mode=)

ivalues-pair        = "ivalues=" ivalues-list                ;(deprecated → lookups=)
ivalues-list        = ivalue-item *(list-sep ivalue-item)
ivalue-item         = number [":" ivalue-unit-token]
ivalue-unit-token   = stp-unit-token / length-unit-token

iunit-pair          = "iunit=" ivalue-unit-token            ;(deprecated → runit= / sunit=)

hidden-programs-pair= "hidden_programs=" entity-id *(list-sep entity-id)  ;(deprecated; silently dropped)

; mode=basic|advanced is both the v1 picker-mode token and the v2 picker-mode
; token. It is preserved during migration and emitted by canonical v2 output.

; -----------------------------
; entity ID
; -----------------------------
entity-id           = int-pos / ext-ref
ext-ref             = "ext:" ext-label ":" entity-local-id
ext-label           = 1*(ALPHA / DIGIT / "_" / "-")
entity-local-id     = 1*(ALPHA / DIGIT / "_" / "-")

; -----------------------------
; list-item separator (issue #672)
; -----------------------------
list-sep            = "~" / ","
                    ; "~" is canonical from v3 (RFC 3986 unreserved; never
                    ; truncated by messenger/email auto-linkifiers). The legacy
                    ; "," is accepted on read so pre-#672 links keep parsing, but
                    ; is NEVER emitted in canonical v3 output. The per-item ":"
                    ; suffix (e.g. 500:keV, 7.72:cm) and the series "." triplet
                    ; separator are unchanged — linkifiers keep both.

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

url-value           = 1*(%x21-25 / %x27-39 / %x3B-3C / %x3E-FF)
                    ; printable ASCII excluding space, '&', '=', ':'
                    ; external URLs must be percent-encoded

nz-digit            = %x31-39
```

Notes:

- Grammar permits duplicates syntactically; semantics define resolution.
- `unknown-pair` preserves forward compatibility.
- `extdata-pair` may appear multiple times (one per external source).
- `ext-ref` uses the stable label assigned in `extdata-pair`.
- Deprecated pairs are syntactically accepted and mapped to v2 equivalents during the migration pass (§3.1 step 5b).

---

## 3. Semantic Rules

### 3.1 Parse Pipeline

1. Parse route (`/calculator` or `/plot`).
2. Split raw query on `&` into pairs, ignoring empty segments.
3. For each pair, split on the first raw `=` into key/value; a bare key → empty value.
4. Percent-decode each key/value component individually (or via `URLSearchParams`).
5. Version detection (see `url-version.ts`):
   a. Read `urlv`. If **missing**, treat leniently as the current schema
   (legacy links predating versioning) and proceed.
   b. If `MIN_SUPPORTED_URL_MAJOR (2) ≤ urlv ≤ CURRENT_URL_MAJOR (3)` → proceed to
   step 6 (native parse). v2 and v3 differ only in the list-item separator
   (`,` → `~`, issue #672) and the decoders read both, so a v2 link hydrates
   identically and is rewritten to canonical v3 on `replaceState`.
   c. If `urlv === 1` → **unsupported**. v1 is no longer migrated (§3.4); show the
   unsupported-link banner with "Load defaults" and halt. **No state is hydrated
   from the link** — entity selection, energy rows, advanced mode and series are
   left at their defaults (rejected, not migrated); "Load defaults" then proceeds
   from those defaults.
   d. If `urlv > CURRENT_URL_MAJOR (3)` → unsupported-link banner; halt with no
   hydration (as 5c).
   e. If `urlv < 1` or non-integer → unsupported-link banner, Load defaults only;
   halt with no hydration (as 5c).
6. For each `extdata` value, split on the first literal `:` to extract label and
   percent-encoded URL. Labels must be unique; duplicates → unknown-pair.
7. Parse ABNF tokens.
8. Apply duplicate resolution (§3.2).
9. Resolve external data sources; merge external entities into compatibility matrix.
10. Apply defaults (§3.6).
11. Apply conditional enablement / precedence (§3.5).
12. Validate against compatibility matrix and unit rules (§3.7, §3.8).
13. Produce normalized canonical state.
14. Emit canonical URL via `replaceState`.

> Steps 6–14 run only when step 5a/5b proceed. An unsupported version (5c–5e)
> halts here: no hydration occurs and the canonical URL is emitted from defaults.

### 3.2 Duplicate Parameter Resolution

If the same key appears multiple times, use the **last occurrence**.

### 3.3 Unknown Parameters

Unknown parameters are silently ignored and never emitted in canonical output.

### 3.4 v1 → v2 Migration Mapping (RETIRED)

> **Retired (v8, 2026-05-29).** v1 links are no longer migrated. An explicit
> `urlv=1` (or any major below `MIN_SUPPORTED_URL_MAJOR = 2`) is rejected with the
> unsupported-link banner. The migration table below is kept for historical
> reference only; no code path applies it. The `migrateUrl` seam in
> `url-version.ts` is the identity for the supported majors: the v2 → v3 change
> (issue #672) needs no token rewriting because the decoders read both list
> separators, so loading a v2 link yields the same state and `replaceState`
> emits the canonical v3 (`~`) form.

Historical mapping (no longer applied):

| Deprecated v1 key + value       | v2 equivalent                                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eunit=MeV`                     | `uanchor=MeV`                                                                                                                                                              |
| `eunit=MeV/nucl`                | `uanchor=MeV/nucl`                                                                                                                                                         |
| `eunit=MeV/u`                   | `uanchor=MeV/u`                                                                                                                                                            |
| `eunit=keV`                     | `uanchor=MeV` (keV is a per-row suffix, not an anchor)                                                                                                                     |
| `eunit=GeV`                     | `uanchor=MeV` (same)                                                                                                                                                       |
| `eunit=keV/nucl`                | `uanchor=MeV/nucl` (prefix belongs in per-row suffixes; anchor stays MeV/nucl)                                                                                             |
| `eunit=GeV/nucl`                | `uanchor=MeV/nucl` (same)                                                                                                                                                  |
| `eunit=keV/u`                   | `uanchor=MeV/u` (prefix belongs in per-row suffixes; anchor stays MeV/u)                                                                                                   |
| `eunit=GeV/u`                   | `uanchor=MeV/u` (same)                                                                                                                                                     |
| `qfocus=both`                   | omit `qshow=` (default)                                                                                                                                                    |
| `qfocus=stp`                    | `qshow=stp`                                                                                                                                                                |
| `qfocus=csda`                   | `qshow=range`                                                                                                                                                              |
| `imode=csda`                    | `calc=range`                                                                                                                                                               |
| `imode=stp`                     | `calc=inverse-stp`                                                                                                                                                         |
| `iunit=` (with `imode=csda`)    | `runit={value}`                                                                                                                                                            |
| `iunit=` (with `imode=stp`)     | `sunit={value}`                                                                                                                                                            |
| `ivalues=`                      | `lookups=` (value unchanged)                                                                                                                                               |
| `mode=advanced` or `mode=basic` | preserve as explicit v2 picker mode                                                                                                                                        |
| `mode` absent                   | `mode=basic`                                                                                                                                                               |
| `mode=advanced` + `programs=`   | keep existing `program=` if valid; otherwise emit `program=` anchor from first valid `programs=` entry; emit `across=programs` unless a valid `across=` is already present |
| `hidden=` or `hidden_programs=` | silently drop                                                                                                                                                              |

After mapping, all subsequent processing uses the v2 param names.

### 3.5 Conditional Enablement and Precedence

**Advanced vs basic mode** is read from the explicit `mode=` picker token:

- `mode=basic` (or absent) → **basic mode**
- `mode=advanced` → **advanced mode**
- Singular/plural entity params never infer picker mode.

When basic mode:

- Ignore `particles=`, `materials=`, `programs=`, `across=`, `qshow=`, and
  custom compound params.
- Advanced Options params (`agg_state`, etc.) are silently dropped.
- Use singular anchors: `particle=`, `material=`, `program=`.
- **`calc=`, `lookups=`, `runit=`, `sunit=`, and `istpbranch=` are honored in
  basic mode too (issue #840).** The Energy→/Range→/STP→ tab selector and its
  row(s) are shared state between basic and advanced mode — a basic-mode
  `calc=range` link opens the Range→ tab (in its simplified basic-mode
  layout), and switching to advanced mode from there stays on the same tab.
  Only the per-entity comparison params above (`across=`, plural entity
  lists, `qshow=`) remain advanced-only, since multi-entity/multi-program
  comparison itself is advanced-only.

> **Implementation note (issue #840):** as of this writing, the shipped
> `calculator-url.ts` does not yet emit/read `calc=`, `runit=`, or `sunit=`
> for the inverse-lookup fields — it still uses the retired v1 names
> `imode=`/`iunit=` directly (only `ivalues=` → `lookups=` was migrated). The
> mode-gating rule above is the correct behavior in both the v3-canonical
> form (`calc=`/`runit=`/`sunit=`) and the as-shipped form (`imode=`/`iunit=`)
> — only the token names differ. Reconciling the as-shipped names with this
> formal contract is tracked separately, not as part of #840.

When advanced mode:

- Use singular anchors: `particle=`, `material=`, `program=`.
- Apply the plural list that matches `across=`:
  - `across=programs` → validate and emit `programs=`.
  - `across=materials` → validate and emit `materials=`.
  - `across=particles` → validate and emit `particles=`.
  - `across=none` or absent → ignore all plural lists.
- If the matching plural list is absent or all invalid, fall back to
  `across=none` and omit plural lists.
- `qshow=` parsed and applied.
- `calc=range` and `calc=inverse-stp` activate the respective inverse tab.
- Advanced Options and custom compound params are parsed and applied.

Energy/lookup precedence:

- In `energies=`, per-row `:unit` suffix overrides `uanchor=` for that row.
- In `lookups=`, per-row `:unit` suffix overrides `runit=` (calc=range) or `sunit=`
  (calc=inverse-stp) for that row.

### 3.6 Defaults

Global:

- `urlv=3` (canonical output always emits this; `urlv=2` accepted on read)
- `mode=basic` (canonical calculator output always emits explicit picker mode)
- `particle=1`
- `material=276`
- `program=auto`

Calculator v2:

- `uanchor=MeV` (always emitted; no default-omit rule)
- `calc=forward` (omitted in canonical URL)
- `runit=cm` (omitted in canonical URL)
- `sunit=kev-um` condensed / `mev-cm2-g` gas (omitted when equal to default)
- `qshow=` absent = both quantities visible (omitted in canonical URL)
- `istpbranch=hi` (omitted in canonical URL)
- `across=none` (omitted in canonical URL)
- `energies=100` if absent/empty (`calc=forward` only)

Advanced Options (omitted when at default):

- `agg_state` absent = no override
- `interp_scale` absent = `"log-log"`
- `interp_method` absent = `"linear"`
- `mstar_mode` absent = `"b"`
- `density` absent = no override
- `ival` absent = no override

Inverse-lookup (v2):

- `calc=forward` absent = Forward tab active (no lookups column)
- `lookups=` absent = tab opens with default pre-filled row

Plot:

- `stp_unit=kev-um` (omitted when default)
- `xscale=log` (omitted when default)
- `yscale=log` (omitted when default)
- `series` optional

### 3.7 Validation Constraints

Entity:

- IDs must exist in compatibility matrix.
- The active plural list (`particles`, `materials`, or `programs`) must be
  non-empty after validation; otherwise canonicalization falls back to
  `across=none` and omits plural lists.

Energy / lookup:

- Value parse must succeed; value must be > 0.
- Energy-unit token must be in the energy-unit-token set.
- Lookup-unit token must match the active mode's unit type.
- Converted energy must be within valid bounds for chosen program/particle.

Plot:

- Each `series` triplet must be valid; invalid triplets are silently dropped.
- Partial success is allowed.

Inverse-lookup constraints (applied when `calc=range` or `calc=inverse-stp`):

- `lookups=` items: number-parse failures → silently drop that row.
- Unknown per-row unit token → row invalid (same as unrecognized user suffix).
- Per-row suffix type must match active mode; mismatched → row invalid.
- `runit=` / `sunit=` invalid token → use default.

### 3.8 Custom Compound Constraints

Applied only when `material=custom`. All `mat_*` params are silently ignored
when this condition is false.

- `mat_name`: must be non-empty after percent-decoding. Missing → fall back to material 276; warning banner.
- `mat_density`: must parse as finite positive number. Missing or invalid → fall back to material 276; warning banner.
- `mat_elements`: must have at least one valid token. Individual token errors: Z outside [1,118] → silently drop; atom count ≤ 0 → silently drop; duplicate Z → sum counts. All invalid → fall back to material 276; warning banner.
- `mat_ival`: must be > 0 and ≤ 10 000. Out-of-range → silently ignored.
- `mat_phase`: must be `"gas"` or `"condensed"`. Unknown → silently ignored (defaults to condensed).
- `matsrc`: provenance hint, `"transient"` or `"saved"`. Unknown/absent → treated as `"saved"`. `"transient"` only changes the receiver's banner copy (no effect on the calculation). On validation failure the decoder still retains the best-effort `mat_*` fields so the editor can pre-fill and highlight the failed inputs.

Advanced Options constraints (applied when advanced mode; silently ignored in basic mode):

- `agg_state`: `"gas"` or `"condensed"`. If value = material built-in phase → no override (same as absent). Invalid → silently ignored.
- `interp_scale`: `"lin-lin"` only. Other values → silently ignored (default `"log-log"`).
- `interp_method`: `"spline"` only. Other values → silently ignored (default `"linear"`).
- `mstar_mode`: one of `"a"` `"b"` `"c"` `"d"` `"g"` `"h"`. Invalid → silently ignored (default `"b"`).
- `density`: finite positive number. Zero, negative, non-numeric → silently ignored.
- `ival`: > 0 and ≤ 10 000. Invalid → silently ignored.

### 3.9 Diagnostics

Both the syntactic layer (`parseQuery`) and the semantic layer (`resolveState`)
emit `Diagnostic` records so the UI can pinpoint problems. Each carries a
`severity` (`fatal | error | warning | info`), a stable `code`, a human message,
an optional source `span` (character offsets into the query string), and the
related `param`. Because every AST node retains its source span, diagnostics can
underline the exact offending characters (caret rendering).

- **fatal** — the query could not be tokenized (rare; `unknown-pair` absorbs most
  junk) or the version is unsupported. The calculation is blocked; the user is
  offered "Load defaults".
- **error / warning** — a specific value is invalid (e.g. out-of-range density, an
  unknown energy unit, an invalid custom compound). The offending part is dropped;
  the rest proceeds (partial success per §3.7).
- **info** — an unknown or mode-gated param was ignored.

Diagnostics are side-effect free data; the banner/notification is driven entirely
by the returned list (§6), never from within the parser.

---

## 4. Canonicalization Algorithm (v3)

> **List items** are joined with the canonical `~` separator (issue #672) in all
> list-valued params (`particles`, `materials`, `programs`, `energies`,
> `lookups`, `series`, `mat_elements`). A bare `,` is never emitted. The
> per-item `:unit` suffix and the `series` `.` triplet separator are kept literal
> (both survive auto-linkification).

Canonical parameter order for `/calculator`:

1. `urlv` (always `3`)
2. `extdata` — one per source, label-declaration order; omitted when none.
3. `mode` — `basic` or `advanced` (always emitted for calculator)
4. `particle`, `material`, `program` — singular anchors
5. Matching plural entity list — `particles`, `materials`, or `programs`; emitted only in advanced mode when `across` matches.
6. `across` — advanced mode only; omitted when `"none"` (default)
7. `energies` — emitted only when `calc=forward`; omitted otherwise
8. `lookups` — emitted only when `calc=range` or `calc=inverse-stp` (either mode, issue #840); omitted otherwise
9. `uanchor` — always emitted
10. `runit` — omitted when `"cm"` (default)
11. `sunit` — omitted when equal to default for material phase
12. `calc` — emitted in either mode (issue #840); omitted when `"forward"` (default)
13. `qshow` — advanced mode only; omitted when both quantities visible (default = absence)
14. `istpbranch` — emitted in either mode (issue #840); omitted when `"hi"` (default)
15. `tip_seen` — omitted unless tip dismissed
16. Advanced Options params — each omitted when at default; sub-order:
    `agg_state`, `interp_scale`, `interp_method`, `mstar_mode`, `density`, `ival`
17. Custom compound params — emitted only when `material=custom`; sub-order:
    `mat_name`, `mat_density`, `mat_elements`, [mat_ival], [mat_phase if gas]

Canonical parameter order for `/plot`:

1. `urlv`
2. `extdata`
3. `particle`, `material`
4. `program`
5. `series` — omitted when empty
6. `stp_unit` — omitted when `"kev-um"` (default)
7. `xscale` — omitted when `"log"` (default)
8. `yscale` — omitted when `"log"` (default)

Normalization rules:

- Never emit deprecated v1 param names (`eunit=`, `qfocus=`, `imode=`, `ivalues=`, `iunit=`, `hidden_programs=`).
- `uanchor=` is always emitted (even when `"MeV"`, the default); it is the anchor for energy interpretation.
- `mode=basic|advanced` is always emitted for calculator URLs; never infer it from entity params.
- Plural entity lists are emitted only in `mode=advanced` and only when they match `across=`.
- In `series`, always emit resolved `int-pos` or `ext-ref` triplets; never `auto`.
- List-valued params join items with `~` (issue #672) and have no spaces; a bare `,` is never emitted.
- In `lookups=`, per-value unit suffixes use canonical token form.
- In `mat_elements=`, elements in ascending Z order; atom counts via `Number.prototype.toString()`.
- `mat_name` percent-encoded via `encodeURIComponent`.
- Never emit `mat_*` params in basic mode or when `material` is a built-in integer ID.

---

## 5. Conformance Test Vectors

> **List separator (issue #672).** Canonical output joins list items with `~`
> and never emits a bare `,`. The `Input:` lines below keep the legacy `,`
> on purpose — they exercise the backward-compatible read path (`urlv=2` links
> shared before #672). Each `Canonical:` line shows the v3 form: list items use
> `~` and `urlv=3`. Where a vector says "Canonical: unchanged", read it as "same
> params, list items re-joined with `~`, `urlv=3`".

### 5.1 Valid v2/v3 Inputs

1. Basic calculator, forward mode, default params:
   - Input: `urlv=2&mode=basic&particle=1&material=276&program=auto&energies=100,200&uanchor=MeV`
   - Canonical: unchanged.

2. Advanced calculator, forward mode, STP-only display:
   - Input: `urlv=2&mode=advanced&particle=1&material=276&program=9&programs=9,2&energies=100&uanchor=MeV&across=programs&qshow=stp`
   - Canonical: unchanged.

3. Advanced calculator, range mode (input has redundant `runit=cm` default):
   - Input: `urlv=2&mode=advanced&particle=1&material=276&program=9&lookups=7.718:cm,45:um,1.5:mm&runit=cm&uanchor=MeV&calc=range`
   - Canonical: `urlv=3&mode=advanced&particle=1&material=276&program=9&lookups=7.718:cm~45:um~1.5:mm&uanchor=MeV&calc=range`
   - Note: `runit=cm` equals the default → omitted in canonical output. `across=` is absent intentionally: this exercises `mode=advanced` with the default `across=none` and no comparison list.

3a. Basic calculator, range mode (issue #840 — `calc=range` is no longer
advanced-only; `mode=` is omitted since basic is the default): - Input: `urlv=3&particle=1&material=276&program=9&lookups=7.718:cm&uanchor=MeV&calc=range` - Canonical: unchanged. - Note: the basic-mode Range→ card shows a single row with no `runit=`/
per-row "Unit" column; this vector only exercises URL round-tripping.
**As shipped**, the equivalent live URL uses the retired v1 names
instead of `lookups=`/`calc=` for two of these three tokens — see the
implementation note in §3.5 — i.e. today's real query string is
`...&energies=100&eunit=MeV&imode=csda&lookups=7.718:cm&iunit=cm`
(no `mode=` param since basic is the default in both schemes).

4. Advanced calculator, inverse-STP mode, both branches (input has redundant `sunit=kev-um` default):
   - Input: `urlv=2&mode=advanced&particle=1&material=276&program=9&lookups=10.0:kev-um,5.0:kev-um&sunit=kev-um&uanchor=MeV&calc=inverse-stp&istpbranch=both`
   - Canonical: `urlv=3&mode=advanced&particle=1&material=276&program=9&lookups=10.0:kev-um~5.0:kev-um&uanchor=MeV&calc=inverse-stp&istpbranch=both`
   - Note: `sunit=kev-um` equals the default for condensed material → omitted; `istpbranch=both` is non-default → emitted. `across=` is absent intentionally: this exercises `mode=advanced` with the default `across=none` and no comparison list.

5. Compare-across programs, range display:
   - Input: `urlv=2&mode=advanced&particle=1&material=276&program=9&programs=9,2,101&energies=100,200&uanchor=MeV&across=programs&qshow=range`
   - Canonical: unchanged.

6. Compare-across materials:
   - Input: `urlv=2&mode=advanced&particle=1&material=276&materials=276,3&program=9&energies=100,200&uanchor=MeV&across=materials`
   - Canonical: unchanged.

7. Compare-across particles:
   - Input: `urlv=2&mode=advanced&particle=1&particles=1,2,6&material=276&program=9&energies=100,200&uanchor=MeV&across=particles`
   - Canonical: unchanged.

8. Plot, multiple series, MeV·cm²/g, linear X:
   - Input: `urlv=2&particle=1&material=276&program=auto&series=9.1.276,2.1.276&stp_unit=mev-cm2-g&xscale=lin`
   - Canonical: unchanged.

9. Advanced Options — density + agg_state override:
   - Input: `urlv=2&mode=advanced&particle=1&material=3&program=9&programs=9,2&energies=100&uanchor=MeV&across=programs&agg_state=condensed&density=8.99e-5`
   - Canonical: unchanged.

10. Advanced Options — default values omitted:

- Input: `urlv=2&mode=advanced&particle=1&material=276&program=9&energies=100&uanchor=MeV&interp_scale=log-log&mstar_mode=b`
- Canonical: `urlv=3&mode=advanced&particle=1&material=276&program=9&energies=100&uanchor=MeV`

11. Custom compound — PMMA, condensed, no iValue:

- Input: `urlv=2&mode=advanced&particle=1&material=custom&program=9&energies=100&uanchor=MeV&mat_name=PMMA&mat_density=1.2&mat_elements=1:8,6:5,8:2`
- Canonical: unchanged (`mat_phase` omitted because condensed is default; `mat_ival` absent).

12. Carbon-12, MeV/nucl anchor:
    - Input: `urlv=2&mode=basic&particle=6&material=276&program=auto&energies=10,100&uanchor=MeV/nucl`
    - Canonical: unchanged.

### 5.2 v1 → v3 Migration Vectors (v1 retired — historical)

These vectors arrive with `urlv=1` (or no `urlv`) and would map to v3 canonical form (v1 is retired since v8 — these are historical). The migration banner (§7.2 of `shareable-urls.md`) is shown after migration.

1. v1 basic forward mode:
   - Input: `urlv=1&particle=1&material=276&program=auto&energies=100,200&eunit=MeV`
   - canonical (v3): `urlv=3&mode=basic&particle=1&material=276&program=auto&energies=100~200&uanchor=MeV`

2. v1 advanced mode, qfocus=csda:
   - Input: `urlv=1&particle=1&material=276&programs=9,2&energies=100&eunit=MeV&mode=advanced&qfocus=csda`
   - canonical (v3): `urlv=3&mode=advanced&particle=1&material=276&program=9&programs=9~2&energies=100&uanchor=MeV&across=programs&qshow=range`
   - Note: `mode=advanced` is preserved explicitly; v1 `programs=` seeds `program=9` and `across=programs`.

3. v1 advanced mode, qfocus=both (default — omit):
   - Input: `urlv=1&particle=1&material=276&programs=9,2&energies=100&eunit=MeV&mode=advanced&qfocus=both`
   - canonical (v3): `urlv=3&mode=advanced&particle=1&material=276&program=9&programs=9~2&energies=100&uanchor=MeV&across=programs`
   - Note: `qfocus=both` → `qshow=` absent (default).

4. v1 range tab (imode=csda), mixed units, iunit=cm (default):
   - Input: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&imode=csda&ivalues=7.718:cm,45:um,1.5:mm&iunit=cm`
   - canonical (v3): `urlv=3&mode=advanced&particle=1&material=276&program=9&lookups=7.718:cm~45:um~1.5:mm&uanchor=MeV&calc=range`
   - Note: `imode=csda` → `calc=range`; `ivalues=` → `lookups=`; `iunit=cm` → `runit=cm` (default → omitted).

5. v1 inverse-STP tab, non-gas material, iunit=kev-um (default):
   - Input: `urlv=1&particle=1&material=276&programs=9&energies=100&eunit=MeV&mode=advanced&qfocus=both&imode=stp&ivalues=45.76,10.00&iunit=kev-um`
   - canonical (v3): `urlv=3&mode=advanced&particle=1&material=276&program=9&lookups=45.76~10.00&uanchor=MeV&calc=inverse-stp`
   - Note: `sunit=kev-um` default → omitted.

6. v1 advanced mode — hidden_programs silently dropped:
   - Input: `urlv=1&particle=1&material=276&programs=9,2,101&energies=100&eunit=MeV&mode=advanced&hidden_programs=2&qfocus=both`
   - canonical (v3): `urlv=3&mode=advanced&particle=1&material=276&program=9&programs=9~2~101&energies=100&uanchor=MeV&across=programs`

7. No urlv (legacy):
   - Input: `particle=1&material=276&program=auto`
   - Treated as v1; canonical (v3): `urlv=3&mode=basic&particle=1&material=276&program=auto&energies=100&uanchor=MeV`
   - Note: `energies=` default pre-fill applies.

8. v1 eunit=MeV/nucl:
   - Input: `urlv=1&particle=6&material=276&program=auto&energies=10,100&eunit=MeV/nucl`
   - canonical (v3): `urlv=3&mode=basic&particle=6&material=276&program=auto&energies=10~100&uanchor=MeV/nucl`

### 5.3 Invalid / Recovery

1. Future version (unsupported):
   - Input: `urlv=99&particle=1&material=276`
   - Result: blocking modal ("URL format not supported"); no silent calc.

2. Invalid energy token:
   - Input: `urlv=2&mode=basic&particle=1&material=276&energies=100:foo&uanchor=MeV`
   - Result: row invalid; excluded from calculation; validation message shown.

3. Advanced params in basic mode:
   - Input: `urlv=2&mode=basic&particle=1&material=276&program=auto&energies=100&uanchor=MeV&qshow=stp`
   - Result: `qshow=` ignored (basic mode); canonical strips it.
   - Canonical: `urlv=3&mode=basic&particle=1&material=276&program=auto&energies=100&uanchor=MeV`

4. Advanced Options in basic mode — silently dropped:
   - Input: `urlv=2&mode=basic&particle=1&material=276&program=auto&energies=100&uanchor=MeV&density=1.2`
   - Canonical: `urlv=3&mode=basic&particle=1&material=276&program=auto&energies=100&uanchor=MeV`

5. `lookups=` without `calc=range` or `calc=inverse-stp` — silently ignored:
   - Input: `urlv=2&mode=advanced&particle=1&material=276&program=9&energies=100&uanchor=MeV&lookups=7.718`
   - Canonical: `urlv=3&mode=advanced&particle=1&material=276&program=9&energies=100&uanchor=MeV`

6. Custom compound — PMMA, condensed (phase omitted), with iValue; element order corrected:
   - Input: `urlv=2&mode=advanced&particle=1&material=custom&program=9&energies=100&uanchor=MeV&mat_name=PMMA&mat_density=1.2&mat_elements=8:2,1:8,6:5&mat_ival=74.0`
   - Canonical: `urlv=3&mode=advanced&particle=1&material=custom&program=9&energies=100&uanchor=MeV&mat_name=PMMA&mat_density=1.2&mat_elements=1:8~6:5~8:2&mat_ival=74`
   - Note: elements re-ordered by ascending Z; `mat_ival=74` (trailing .0 dropped).

7. Custom compound — mat_name missing → fall back to material 276:
   - Input: `urlv=2&mode=advanced&particle=1&material=custom&program=9&energies=100&uanchor=MeV&mat_density=1.2&mat_elements=1:8,6:5,8:2`
   - Result: `mat_name` absent → fall back to default material (276); warning banner.
   - Canonical: `urlv=3&mode=advanced&particle=1&material=276&program=9&energies=100&uanchor=MeV`

8. Custom compound — mat\_\* in basic mode — silently dropped:
   - Input: `urlv=2&mode=basic&particle=1&material=custom&program=auto&energies=100&uanchor=MeV&mat_name=PMMA&mat_density=1.2&mat_elements=1:8,6:5,8:2`
   - Canonical: `urlv=3&mode=basic&particle=1&material=276&program=auto&energies=100&uanchor=MeV`
   - Note: no advanced mode → `material=custom` and `mat_*` dropped; material defaults to 276.

9. `runit=km`, alpha in air, advanced range mode:
   - Input: `urlv=2&mode=advanced&particle=2&material=3&program=9&lookups=1.5,3.0&runit=km&uanchor=MeV&calc=range`
   - Canonical: unchanged (`runit=km` is non-default → emitted).

---

## 6. Implementation Guidance

Architecture (implemented):

- `parseQuery(raw: string | URLSearchParams): QueryNode` — Peggy grammar
  (`url-grammar.peggy`) → AST (`url-ast.ts`). Pure syntax; every node carries a
  source span. See `url-parse.ts`.
- `resolveCalculatorState(ast) / resolvePlotState(ast)` — semantic pass: last-wins
  duplicate resolution, defaults, mode gating, validation. Returns typed state and
  appends `Diagnostic`s (`url-resolve` logic lives in `calculator-url.ts` /
  `plot-url.ts`; shared helpers in `url-shared.ts`). See §3.9.
- `migrateUrl(fromMajor, toMajor, tokens)` — version seam in `url-version.ts`;
  identity for the current major (v1 is rejected, not migrated — §3.4).
- canonical URL writers (`*UrlQueryString`) emit the §4 ordered form.

Validation is deterministic and side-effect free. The unsupported-link banner is
driven by `negotiateVersion`; per-value problems are driven by the diagnostics
list (§3.9), never from within the parser.

---

## 7. Cross-References

- Primary product behavior: [`shareable-urls.md`](shareable-urls.md)
- v2 design decisions: [`../decisions/006-url-schema-v2.md`](../decisions/006-url-schema-v2.md)
- Multi-program semantics: [`multi-program.md`](multi-program.md)
- Energy units and conversion: [`unit-handling.md`](unit-handling.md)
- Custom compounds (`mat_*` params): [`custom-compounds.md`](custom-compounds.md)
- Plot series semantics: [`plot.md`](plot.md)
- Entity compatibility rules: [`entity-selection.md`](entity-selection.md)
- Type and ID source of truth: [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md)
- Advanced Options semantics: [`advanced-options.md`](advanced-options.md)
- Inverse-lookup modes: [`inverse-lookups.md`](inverse-lookups.md)
