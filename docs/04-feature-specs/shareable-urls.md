# Feature: Shareable URLs (URL State Encoding & Restoration)

> **Status:** v7 (2026-05-23) — v2 URL schema (`urlv=2`), calculator-table redesign
>
> **Cross-check:** If this file disagrees with `shareable-urls-formal.md`, the formal contract wins.
>
> This spec defines the canonical URL state contract for the dEdx Web application.
> Every page (Calculator, Plot) encodes its full state in query parameters for
> shareability. The v2 schema corresponds to the calculator-table redesign (#552 / #526).
>
> For the v1 schema history, see git log on this file.
>
> **Revision history (selected):**
>
> - **v1–v6** (April 2026): initial URL contract (`urlv=1`).
> - **v7** (2026-05-23): rewritten for v2 schema (`urlv=2`). Supersedes the
>   separately-maintained `url-schema.md` (now deleted). Key v1→v2 changes:
>   `eunit=` → `uanchor=`; `qfocus=stp|csda|both` → `qshow=stp|range` (2-state);
>   `imode=csda|stp` → `calc=range|inverse-stp`; `hidden_programs=` removed;
>   `ivalues=` → `lookups=`; new params `runit=`, `sunit=`, `across=`,
>   `particles=`, `materials=`, `istpbranch=`, `tip_seen=`; `mode=basic|advanced`
>   is an explicit picker-mode token.

---

## Related Specs

- [`calculator.md`](calculator.md) — landing page: table, inputs, units, export.
- [`multi-program.md`](multi-program.md) — advanced multi-entity comparison.
- [`plot.md`](plot.md) — plot page, series management, axis controls.
- [`unit-handling.md`](unit-handling.md) — unit conversion contract.
- [`entity-selection.md`](entity-selection.md) — particle / material / program selectors.
- [`inverse-lookups.md`](inverse-lookups.md) — inverse-lookup modes (Range → and STP →).
- [`06-wasm-api-contract.md`](../06-wasm-api-contract.md) — entity and result types.
- [`shareable-urls-formal.md`](shareable-urls-formal.md) — normative ABNF grammar + canonicalization algorithm.
- [`decisions/006-url-schema-v2.md`](../decisions/006-url-schema-v2.md) — ADR for v2 design decisions.

---

## 1. Purpose & Design Principles

### 1.1 Purpose

URLs are the primary mechanism for **state sharing** in dEdx Web:

1. **Scientific collaboration:** A researcher sends a link that includes the exact
   particle, material, energy values, and program. The recipient clicks it and sees
   identical results.
2. **Bookmarking & reproducibility:** A physicist bookmarks a calculation URL;
   clicking it 6 months later restores the full state.
3. **Publication:** A URL is embedded in supplementary material. Readers can compare
   curves interactively without installing software.
4. **Sharing via communicators:** A link pasted in email, Slack, or Mattermost opens
   the exact same calculation or plot without setup or file transfer.

### 1.2 Design Principles

- **Deterministic and complete:** The URL encodes all state necessary to reproduce
  exactly the same output. No `localStorage` state affects rendered results.
- **Canonical form:** URLs are normalized to a single canonical representation.
  Equivalent state → identical canonical string.
- **Default values are omitted:** Parameters equal to their defaults are not emitted.
  This keeps shared URLs short.
- **Version-safe:** The `urlv` major integer signals the contract version. Old URLs
  load via migration rules (§7); unknown future versions trigger a modal (§7.2).
- **Compact:** URLs are kept short enough for email, Slack, and communicators.

### 1.3 Case Sensitivity Policy

URL query parameters in this contract are **case-sensitive** for both keys and
values, unless explicitly noted. The casing rules are:

| Token category                                                                                   | Casing convention                                                                                                                 | Examples                                                                                              |
| ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Parameter names (keys)                                                                           | lowercase (with `_` for compound names)                                                                                           | `urlv`, `particle`, `programs`, `tip_seen`, `mat_density`, `stp_unit`                                 |
| Numeric IDs                                                                                      | digits only                                                                                                                       | `particle=1`, `material=276`                                                                          |
| Literal flag values                                                                              | lowercase                                                                                                                         | `program=auto`, `material=custom`, `xscale=log`, `qshow=stp`, `across=programs`                       |
| Mode tokens (`mode=`, `calc=`, `across=`, `qshow=`, `istpbranch=`, `agg_state=`)                 | lowercase                                                                                                                         | `mode=advanced`, `calc=range`, `istpbranch=hi`                                                        |
| **Energy unit tokens** (`uanchor=` value and per-row `:unit` suffix in `energies=` / `lookups=`) | **Physics-standard mixed case** — preserves prefix capitalisation so the token cannot be confused with an SI-prefixed alternative | `MeV`, `keV`, `GeV`, `MeV/nucl`, `MeV/u` (lowercase `mev` ≠ `MeV`; it would denote millielectronvolt) |
| Length unit tokens (`runit=`, length per-row suffix)                                             | lowercase                                                                                                                         | `nm`, `um`, `mm`, `cm`, `dm`, `m`, `km`                                                               |
| Stopping-power unit tokens (`sunit=`, `stp_unit=`)                                               | lowercase kebab                                                                                                                   | `kev-um`, `mev-cm`, `mev-cm2-g`                                                                       |
| MSTAR mode (`mstar_mode=`)                                                                       | lowercase letter                                                                                                                  | `a`, `b`, `c`, `d`, `g`, `h`                                                                          |

**Rationale:** energy units follow the physics convention because the
prefix-letter case carries meaning (`m` = milli, `M` = mega; `k` = kilo,
`K` is undefined). The rest of the token space avoids this ambiguity and uses
lowercase for URL hygiene (consistent with browser/server normalisation patterns).

**Comparison is strict:** unknown casing → invalid token → row/parameter dropped
(falling back to its default). `URLSearchParams` preserves case during parsing;
matching is then done with exact string equality against the allowed token sets.

---

## 2. Schema Changes from v1

This table summarizes every calculator-route URL change in v2. Plot-route params
that are unchanged from v1 are listed in §3.8.

| Param                                                                                     | v2 Status                   | Notes                                                                                        |
| ----------------------------------------------------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------- |
| `urlv=`                                                                                   | **bumped to 2**             | Triggers v1→v2 migration on read (§7.1)                                                      |
| `particle=` · `material=` · `program=`                                                    | **unchanged**               | Single-selection anchors                                                                     |
| `particles=` · `materials=` · `programs=`                                                 | **extended**                | Advanced-only comparison lists; `programs=` existed in v1, `particles=`/`materials=` are new |
| `extdata=` · `mat_*=` · `agg_state=` · `interp_*=` · `mstar_mode=` · `density=` · `ival=` | **unchanged**               | Unchanged from v1; see `shareable-urls-formal.md` for details                                |
| `mode=basic\|advanced`                                                                    | **kept/required**           | Explicit picker mode; no v2 inference from singular/plural entity params                     |
| `across=none\|programs\|materials\|particles`                                             | **new**                     | Was UI state only in v1; now in URL                                                          |
| `calc=forward\|range\|inverse-stp`                                                        | **new**                     | Calculator operation mode; replaces `imode=csda\|stp`                                        |
| `hidden=` / `hidden_programs=`                                                            | **removed**                 | Silently dropped on read; visibility from picker selection                                   |
| `qshow=stp\|range`                                                                        | **replaces `qfocus=`**      | 3-state → 2-state; values renamed (see §3.7)                                                 |
| `uanchor=MeV\|MeV/nucl\|MeV/u`                                                            | **new**                     | Energy unit anchor; replaces `eunit=` (case-sensitive, see §1.3)                             |
| `runit=nm\|um\|mm\|cm\|dm\|m\|km`                                                         | **new**                     | Range unit anchor (Range → mode + CSDA range display)                                        |
| `sunit=kev-um\|mev-cm\|mev-cm2-g`                                                         | **new**                     | STP unit anchor (STP → mode + STP display)                                                   |
| `energies=100,10:keV,2:GeV`                                                               | **extended**                | Per-row `:unit` suffix; used only when `calc=forward`                                        |
| `lookups=`                                                                                | **renamed** from `ivalues=` | Inverse-mode input list; same `:unit` suffix syntax                                          |
| `istpbranch=hi\|lo\|both`                                                                 | **new**                     | Sticky inverse-STP branch column state                                                       |
| `tip_seen=inline_unit`                                                                    | **new (optional)**          | Inline-unit tip dismissal flag                                                               |

> **Note on calc token naming:** `forward|range|inverse-stp` are the v2 tokens. A
> future revision may rename these to shorter UI-aligned tokens (e.g. `e|r|s` to
> match the E→ / R→ / S→ tab labels); see the ADR for the decision log.

---

## 3. Canonical URL Contract

### 3.1 Canonical Form

#### Calculator (v2)

Square brackets denote optional/conditional params (omitted at default):

```
/calculator
  ?urlv=2
  [&extdata={label}:{url}]              ← one per source, declaration order
  &mode={basic|advanced}                ← explicit picker mode
  &particle={id}
  &material={id|"custom"}               ← "custom" only in advanced mode
  &program={id|"auto"}
  [&particles={ids}]                    ← advanced only, required when across=particles
  [&materials={ids}]                    ← advanced only, required when across=materials
  [&programs={ids}]                     ← advanced only, required when across=programs
  [&across={dimension}]                 ← advanced only; omit when "none" (default)
  [&energies={value-list}]              ← only when calc=forward (default)
  [&lookups={value-list}]               ← advanced only, when calc=range or calc=inverse-stp
  &uanchor={token}                      ← always emitted
  [&runit={token}]                      ← omit when "cm" (default)
  [&sunit={token}]                      ← omit when default for material phase
  [&calc={forward|range|inverse-stp}]   ← advanced only; omit when "forward" (default)
  [&qshow={stp|range}]                  ← advanced only; omit when both visible (default)
  [&istpbranch={hi|lo|both}]            ← advanced only; omit when "hi" (default)
  [&tip_seen=inline_unit]               ← omit unless tip dismissed
  [&agg_state=...] [&interp_scale=...] ...  ← advanced options; omit at default
  [&mat_name=...] ...                   ← custom compound params
```

#### Plot (v2, unchanged from v1)

```
/plot
  ?urlv=2
  [&extdata={label}:{url}]
  &particle={id}
  &material={id}
  &program={id|"auto"}
  [&series={triplets}]
  [&stp_unit={token}]                   ← omit when "kev-um" (default)
  [&xscale={log|lin}]                   ← omit when "log" (default)
  [&yscale={log|lin}]                   ← omit when "log" (default)
```

### 3.2 `urlv` — URL Contract Version

| Attribute         | Value                      |
| ----------------- | -------------------------- |
| Type              | Positive integer           |
| Current value     | `2`                        |
| Default if absent | treat as `1` (legacy link) |

Canonical URLs always emit `urlv=2`. If absent, the parser assumes v1 and applies
migration rules (§7). If the value is unknown future major, show the migration modal
(§7.2).

### 3.3 Entity and Picker-Mode Parameters

| Param       | Type                      | Default              | Notes                                                                |
| ----------- | ------------------------- | -------------------- | -------------------------------------------------------------------- |
| `mode`      | `"basic"` \| `"advanced"` | `"basic"`            | Explicit picker mode; canonical calculator URLs always emit it       |
| `particle`  | numeric ID                | `1` (proton)         | Single-particle anchor; required in both modes                       |
| `material`  | numeric ID or `"custom"`  | `276` (water liquid) | Single-material anchor; `"custom"` only in advanced mode             |
| `program`   | `"auto"` or numeric ID    | `"auto"`             | Single-program anchor; incompatible → fall back to `"auto"`          |
| `particles` | comma-separated IDs       | —                    | Advanced mode only; selected comparison list when `across=particles` |
| `materials` | comma-separated IDs       | —                    | Advanced mode only; selected comparison list when `across=materials` |
| `programs`  | comma-separated IDs       | —                    | Advanced mode only; selected comparison list when `across=programs`  |

The picker mode is explicit. The parser must **not** infer advanced/basic from
the presence of singular or plural entity params:

- `mode=basic` → use only `particle=`, `material=`, `program=`, `energies=`,
  and `uanchor=`; silently drop advanced-only params.
- `mode=advanced` → enable compare-across lists, inverse modes, quantity
  display toggles, custom compounds, and Advanced Options.

When `mode=advanced`, `across=` determines which plural list is meaningful:

| `across`         | Required comparison list | Anchor params still emitted          |
| ---------------- | ------------------------ | ------------------------------------ |
| `programs`       | `programs=`              | `particle=`, `material=`, `program=` |
| `materials`      | `materials=`             | `particle=`, `material=`, `program=` |
| `particles`      | `particles=`             | `particle=`, `material=`, `program=` |
| `none` (default) | none                     | `particle=`, `material=`, `program=` |

If a plural list is present in `mode=basic`, or a plural list does not match the
active `across=` dimension, it is ignored and omitted from canonical output.
If `mode=advanced&across=programs` has no valid `programs=` entries (and
similarly for particles/materials), fall back to `across=none` while preserving
the singular anchors.

### 3.4 `calc` — Calculator Operation Mode

| Attribute     | Value                                                               |
| ------------- | ------------------------------------------------------------------- |
| Type          | `"forward"` \| `"range"` \| `"inverse-stp"`                         |
| Default       | `"forward"` (omitted from canonical URL)                            |
| v1 equivalent | implicit `"forward"` + `imode=csda\|stp` for inverse modes          |
| Mode          | Advanced only; basic mode ignores non-forward `calc` and `lookups=` |

| Token         | Input column                | Output column    | UI tab  |
| ------------- | --------------------------- | ---------------- | ------- |
| `forward`     | Energy (user-typed)         | STP + CSDA Range | default |
| `range`       | CSDA Range (user-typed)     | Energy           | R→      |
| `inverse-stp` | Stopping Power (user-typed) | Energy           | S→      |

The v1 param `imode=csda` maps to `calc=range`; `imode=stp` maps to
`calc=inverse-stp` (see §7.1 migration table).

> **Forward-compatibility note (planned, post-#552):** the calculator-results
> redesign anticipates a follow-up that lets each non-forward mode emit **two
> output quantities** in advanced mode. Concretely:
>
> - `calc=range` (CSDA Range → …) will optionally show **both** the energy
>   column and the stopping-power column for the looked-up range.
> - `calc=inverse-stp` (Stopping Power → …) will optionally show **both** the
>   energy column and the CSDA-range column for the looked-up STP.
>
> The output-column selection will be carried in `qshow=` (extended from the
> current `stp|range` 2-state to allow co-display in inverse modes) — exact
> token grammar TBD in the follow-up issue. **No URL-schema-breaking change is
> required by this extension** because `qshow=` already exists and the new
> values will be additive; the `calc=` token set stays the same. This note
> is here so implementers of #555–#561 don't bake in the "inverse modes only
> have one output column" assumption.

### 3.5 `energies` — Energy Input List (calc=forward only)

| Attribute | Value                                                                       |
| --------- | --------------------------------------------------------------------------- |
| Type      | Comma-separated `energy-item` list                                          |
| Grammar   | `energy-item = number [":" energy-unit-token]`                              |
| Used when | `calc=forward` (the default); absent in `calc=range` and `calc=inverse-stp` |

Each item is a bare number (inherits `uanchor=`) or a number with an explicit
per-row `:unit` suffix. The colon is RFC 3986 §3.4-safe within a query string.

Valid per-row unit tokens are the full cross-product of **5 prefixes**
(`eV`, `keV`, `MeV`, `GeV`, `TeV`) × **3 suffixes** (none, `/nucl`, `/u`) =
**15 tokens**:

|       | (none) | `/nucl`    | `/u`    |
| ----- | ------ | ---------- | ------- |
| `eV`  | `eV`   | `eV/nucl`  | `eV/u`  |
| `keV` | `keV`  | `keV/nucl` | `keV/u` |
| `MeV` | `MeV`  | `MeV/nucl` | `MeV/u` |
| `GeV` | `GeV`  | `GeV/nucl` | `GeV/u` |
| `TeV` | `TeV`  | `TeV/nucl` | `TeV/u` |

Tokens are CASE-SENSITIVE (see §1.3). Unknown / wrong-case → invalid row.

**Worked example — mixed inline units:**

```
?urlv=2&mode=basic&particle=1&material=276&program=auto&energies=100,10:keV,2:GeV,250&uanchor=MeV
```

→ Four rows: 100 MeV, 10 keV, 2 GeV, 250 MeV.

### 3.6 `uanchor` — Energy Unit Anchor (replaces v1 `eunit=`)

| Attribute      | Value                                |
| -------------- | ------------------------------------ |
| Type           | `"MeV"` \| `"MeV/nucl"` \| `"MeV/u"` |
| Default        | `"MeV"`                              |
| Always emitted | yes (never omitted)                  |
| v1 equivalent  | `eunit=MeV\|MeV/nucl\|MeV/u`         |

Determines how unsuffixed rows in `energies=` are interpreted and sets the
Energy column header. For proton (A=1), `MeV` and `MeV/nucl` are numerically
identical; `MeV/u` differs by ~0.1% — see the `(≠MeV)` badge in #558.

**Why mixed case?** Lowercase `mev` would mean **millielectronvolt** (a real
but irrelevant unit). The token preserves the physics-standard capitalisation
(`M` for mega, `e` for electron, `V` for Volt). Tokens are CASE-SENSITIVE
(see §1.3); `uanchor=mev` is rejected as invalid.

**Worked example — carbon at MeV/nucl:**

```
?urlv=2&mode=basic&particle=6&material=276&program=auto&energies=10,50,200&uanchor=MeV/nucl
```

### 3.7 `lookups` — Inverse-Lookup Input List (calc=range or calc=inverse-stp)

| Attribute | Value                                                                    |
| --------- | ------------------------------------------------------------------------ |
| Type      | Comma-separated `lookup-item` list                                       |
| Grammar   | `lookup-item = number [":" unit-token]`                                  |
| Used when | `calc=range` or `calc=inverse-stp`; absent in `calc=forward`             |
| v1 name   | `ivalues=` (renamed to avoid collision with Bethe-Bloch I-value `ival=`) |

Per-row unit depends on mode:

- `calc=range` → length token from `runit=` token set
- `calc=inverse-stp` → STP token from `sunit=` token set

**Worked example — range lookup, mixed length units:**

```
?urlv=2&mode=advanced&particle=1&material=276&program=9&lookups=7.718:cm,45:um,1.5:mm&runit=cm&uanchor=MeV&calc=range
```

**Worked example — STP inverse lookup:**

```
?urlv=2&mode=advanced&particle=1&material=276&program=9&lookups=45.76,10.00&sunit=kev-um&uanchor=MeV&calc=inverse-stp
```

### 3.8 `runit` — Range Unit Anchor

| Attribute     | Value                                                             |
| ------------- | ----------------------------------------------------------------- |
| Type          | `"nm"` \| `"um"` \| `"mm"` \| `"cm"` \| `"dm"` \| `"m"` \| `"km"` |
| Default       | `"cm"` (omitted when default)                                     |
| v1 equivalent | `iunit=` when `imode=csda`                                        |

Sets (1) the CSDA Range column header, (2) the unit for unsuffixed rows in
`lookups=` when `calc=range`. The full SI-prefix span (`nm` through `km`) covers
sub-mm medical physics through km-scale cosmic-ray scenarios.

Per-cell values **auto-scale** to an appropriate prefix regardless of `runit=`
(per #556 `value-formatters.ts`). `runit=` only anchors the **input** and header.

### 3.9 `sunit` — STP Unit Anchor

| Attribute     | Value                                                   |
| ------------- | ------------------------------------------------------- |
| Type          | `"kev-um"` \| `"mev-cm"` \| `"mev-cm2-g"`               |
| Default       | `"kev-um"` (condensed materials); `"mev-cm2-g"` (gases) |
| v1 equivalent | `stp_unit=` (plot) / `iunit=` when `imode=stp`          |

| Token       | Display label |
| ----------- | ------------- |
| `kev-um`    | keV/µm        |
| `mev-cm`    | MeV/cm        |
| `mev-cm2-g` | MeV·cm²/g     |

Sets (1) the Stopping Power column header, (2) the unit for unsuffixed rows in
`lookups=` when `calc=inverse-stp`.

### 3.10 `qshow` — Quantity Display Toggle (replaces v1 `qfocus=`)

| Attribute | Value                                  |
| --------- | -------------------------------------- |
| Type      | `"stp"` \| `"range"`                   |
| Default   | both quantities visible (param absent) |
| Mode      | Advanced only; ignored in basic mode   |

| v2 `qshow=` | v1 `qfocus=` | Meaning                                     |
| ----------- | ------------ | ------------------------------------------- |
| _(absent)_  | `both`       | Both stopping power + range columns visible |
| `stp`       | `stp`        | Stopping power columns only                 |
| `range`     | `csda`       | Range columns only                          |

CSV export always includes both quantities regardless of `qshow=`. Unlike v1
(which always emitted `qfocus=both`), v2 omits `qshow=` when the default applies.

### 3.11 `across` — Compare-Across Dimension

| Attribute | Value                                                      |
| --------- | ---------------------------------------------------------- |
| Type      | `"none"` \| `"programs"` \| `"materials"` \| `"particles"` |
| Default   | `"none"` (omitted)                                         |
| Mode      | Advanced only                                              |

Controls which entity axis drives the multi-column comparison. In v1 this was
stored only in UI state (not the URL).

### 3.12 `istpbranch` — Inverse-STP Branch Visibility

| Attribute | Value                                 |
| --------- | ------------------------------------- |
| Type      | `"hi"` \| `"lo"` \| `"both"`          |
| Default   | `"hi"` (omitted)                      |
| Mode      | Only relevant when `calc=inverse-stp` |

Some STP values have two energy solutions (high-E and low-E branches). The
`both` state is sticky: once the user sees a dual-solution row and the
column opens, `istpbranch=both` keeps it visible on reload.

| Token  | Meaning                                                    |
| ------ | ---------------------------------------------------------- |
| `hi`   | High-energy branch only (default)                          |
| `lo`   | Low-energy branch only (reserved; not implemented in #560) |
| `both` | Both branch columns visible                                |

### 3.13 `tip_seen` — Tip Dismissal Flag (optional)

| Attribute | Value                     |
| --------- | ------------------------- |
| Type      | Literal `"inline_unit"`   |
| Default   | absent (tip not yet seen) |

Cross-device sharing of the "type a unit too — e.g. `10 keV`" dismissal state.
Primary persistence is `localStorage`; the URL param is an optional supplement.

### 3.14 Plot Parameters (unchanged from v1)

| Param      | Example           | Default         | Notes                                                        |
| ---------- | ----------------- | --------------- | ------------------------------------------------------------ |
| `series`   | `9.1.276,2.6.276` | —               | Committed series: `programId.particleId.materialId` triplets |
| `stp_unit` | `kev-um`          | `kev-um` (omit) | Plot stopping-power display unit                             |
| `xscale`   | `log`             | `log` (omit)    | X-axis scale                                                 |
| `yscale`   | `log`             | `log` (omit)    | Y-axis scale                                                 |

Auto-select is resolved to a numeric program ID before encoding into `series`.
The literal `"auto"` never appears inside a `series` triplet.

### 3.15 Advanced Options Parameters (reference)

`agg_state=`, `interp_scale=`, `interp_method=`, `mstar_mode=`, `density=`,
`ival=` — unchanged from v1. Source of truth: [`advanced-options.md`](advanced-options.md).
Each is omitted when at its default value.

### 3.16 Custom Compound Parameters (reference)

`mat_name=`, `mat_density=`, `mat_elements=`, `mat_ival=`, `mat_phase=` —
unchanged from v1. Source of truth: [`custom-compounds.md`](custom-compounds.md) §6.
Required when `material=custom`.

---

## 4. Calculator URL: Per-Mode Examples

### 4.1 Calc = forward (default) — Energy → STP + Range

**Basic mode:**

```
/calculator?urlv=2&mode=basic&particle=1&material=276&program=auto&energies=100,200,500&uanchor=MeV
```

**Basic mode, mixed inline units:**

```
/calculator?urlv=2&mode=basic&particle=1&material=276&program=auto&energies=100,10:keV,2:GeV&uanchor=MeV
```

**Advanced mode, multi-program, STP column only:**

```
/calculator?urlv=2&mode=advanced&particle=1&material=276&program=9&programs=9,2&energies=100,200&uanchor=MeV&across=programs&qshow=stp
```

**Carbon-12, MeV/nucl:**

```
/calculator?urlv=2&mode=basic&particle=6&material=276&program=auto&energies=10,100&uanchor=MeV/nucl
```

### 4.2 Calc = range — CSDA Range → Energy

```
/calculator?urlv=2&mode=advanced&particle=1&material=276&program=9&lookups=7.718:cm,20:cm&runit=cm&uanchor=MeV&calc=range
```

Large-scale (km), alpha in air:

```
/calculator?urlv=2&mode=advanced&particle=2&material=3&program=9&lookups=1.5,3.0&runit=km&uanchor=MeV&calc=range
```

### 4.3 Calc = inverse-stp — STP → Energy

Single branch (default hi), master STP unit:

```
/calculator?urlv=2&mode=advanced&particle=1&material=276&program=9&lookups=45.76,10.00&sunit=kev-um&uanchor=MeV&calc=inverse-stp
```

Both branches visible (sticky):

```
/calculator?urlv=2&mode=advanced&particle=1&material=276&program=9&lookups=10.0:kev-um,5.0:kev-um&sunit=kev-um&uanchor=MeV&calc=inverse-stp&istpbranch=both
```

### 4.4 Compare-Across Programs (advanced)

```
/calculator?urlv=2&mode=advanced&particle=1&material=276&program=9&programs=9,2,101&energies=100,200&uanchor=MeV&across=programs&qshow=range
```

### 4.5 Compare-Across Materials and Particles (advanced)

Compare materials with one particle and one program anchor:

```
/calculator?urlv=2&mode=advanced&particle=1&material=276&materials=276,3&program=9&energies=100,200&uanchor=MeV&across=materials
```

Compare particles with one material and one program anchor:

```
/calculator?urlv=2&mode=advanced&particle=1&particles=1,2,6&material=276&program=9&energies=100,200&uanchor=MeV&across=particles
```

---

## 5. Plot URL: Examples

Single series, keV/µm, log-log:

```
/plot?urlv=2&particle=1&material=276&program=auto&series=9.1.276&stp_unit=kev-um
```

Multiple series, MeV·cm²/g, linear X:

```
/plot?urlv=2&particle=1&material=276&program=auto&series=9.1.276,2.1.276,9.6.276&stp_unit=mev-cm2-g&xscale=lin
```

---

## 6. Navigation & History

- **Page switch** (Calculator → Plot or vice versa): `pushState` — creates a
  history entry. Back button returns to prior page + state.
- **State changes on same page** (entity/energy edits): `replaceState` — no new
  history entry, prevents pollution.
- **Deep link (cold load):** URL loaded directly; browser history starts here.

---

## 7. v1 → v2 Migration

### 7.1 Migration Rules

When the parser reads a URL with `urlv=1` or no `urlv`, apply these rules in
order and then write the canonical v2 URL via `replaceState` (bumping `urlv` to
`2`):

| v1 param                               | v2 behaviour                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `mode=advanced` or `mode=basic`        | Emit unchanged as explicit v2 picker mode                                                         |
| `mode` absent                          | Emit `mode=basic` (default)                                                                       |
| `particle=` · `material=` · `program=` | Emit unchanged as singular anchors                                                                |
| `programs=` with `mode=advanced`       | Emit `program=` anchor from the first valid program, keep `programs=`, and emit `across=programs` |
| `programs=` without `mode=advanced`    | Drop (do not infer advanced mode)                                                                 |
| `particles=` · `materials=`            | v2-only; accepted only when `mode=advanced` and `across=` matches                                 |
| `eunit=MeV`                            | Map to `uanchor=MeV`                                                                              |
| `eunit=MeV/nucl`                       | Map to `uanchor=MeV/nucl`                                                                         |
| `eunit=MeV/u`                          | Map to `uanchor=MeV/u`                                                                            |
| `eunit=keV` · `eunit=GeV`              | Map to `uanchor=MeV` (prefix belongs in per-row `:unit` suffixes)                                 |
| `eunit=keV/nucl` · `eunit=GeV/nucl`    | Map to `uanchor=MeV/nucl`                                                                         |
| `eunit=keV/u` · `eunit=GeV/u`          | Map to `uanchor=MeV/u`                                                                            |
| `qfocus=both`                          | Omit `qshow=` (default — both visible)                                                            |
| `qfocus=stp`                           | Emit `qshow=stp`                                                                                  |
| `qfocus=csda`                          | Emit `qshow=range`                                                                                |
| `imode=csda`                           | Emit `calc=range`                                                                                 |
| `imode=stp`                            | Emit `calc=inverse-stp`                                                                           |
| `iunit=` (with `imode=csda`)           | Map to `runit=`                                                                                   |
| `iunit=` (with `imode=stp`)            | Map to `sunit=`                                                                                   |
| `ivalues=`                             | Rename to `lookups=` (value syntax unchanged)                                                     |
| `hidden=` or `hidden_programs=`        | Silently drop                                                                                     |
| `energies=` without `:unit` suffixes   | Load unchanged; unsuffixed rows use migrated `uanchor=`                                           |
| Any unknown param                      | Silently drop                                                                                     |

### 7.2 v1 URL Detection Modal

The v1→v2 migration is **automatic and transparent**: the parser applies the
rules in §7.1 without user interaction. However, the user should be informed
that their URL has changed format so they can copy the updated link.

#### When to show

Show the migration notification when:

- A URL with `urlv=1` or no `urlv` is loaded cold (page load or navigation from
  outside the app).
- Do **not** show when `replaceState` fires from normal in-app editing.

#### Notification UI (v1 load)

A **non-blocking dismissable banner** at the top of the page content area:

> "Your link was in an older format (v1) and has been automatically updated to v2.
> [Copy updated link] [Dismiss ✕]"

- **"Copy updated link"** button copies the current canonical URL (same as Share button action).
- **"Dismiss ✕"** closes the banner without any further action.
- Banner is displayed for as long as it is not dismissed (no auto-timeout).
- After the user dismisses or copies, the banner does not reappear on subsequent
  page loads from the new canonical URL (which has `urlv=2`).

The calculated results are shown immediately — the banner does **not** block the
calculation. Migration never loses data for v1 URLs (all params have defined
migration rules; see §7.1).

#### Blocking modal (future-version URL, urlv > 2)

When `urlv > CURRENT_URL_MAJOR` (a URL from a future app version):

- Show a **blocking modal** (calculation does not start):

  > **"URL format not supported"**
  >
  > This link uses URL format v{n}, but this app supports up to v2.
  > The link was likely created with a newer version of dEdx Web.
  >
  > [Try migration] [Load defaults]

- **"Try migration"** — applies available migration rules best-effort; proceeds
  even if some params are unrecognised (they are silently dropped). User sees a
  secondary notice: "Some URL parameters could not be interpreted and were ignored."
- **"Load defaults"** — discards all URL params; loads the default calculator state
  (`urlv=2&mode=basic&particle=1&material=276&program=auto&energies=100&uanchor=MeV`).
- Do not calculate from unparsed parameters until user chooses a recovery action.

#### Blocking modal (unsupported old version, urlv < 1)

Treat as corrupted URL: show "Load defaults" only, no migration attempt.

---

## 8. Validation & Normalization

### 8.1 Entity Validation

```
if (!matrix.particles.has(particle))              → use default particle=1
if (!matrix.materials.has(material))              → use default material=276
if (!matrix.programs.has(program))                → use program=auto
if incompatible combination after resolution       → use particle=1, material=276, program=auto
```

Silently fall back; do not show an error. If a program is incompatible, show a brief
toast: "Program not available; using auto-select."

### 8.2 Energy/Lookup Parsing

For each item in `energies=` or `lookups=`:

1. Split on `:` (last occurrence) → `(value_str, unit_str_if_any)`.
2. Parse `value_str` as a number (int, decimal, or scientific notation `1e3`).
   Negative or zero → out-of-range.
3. If `unit_str` present, match against the allowed token set for the active mode:
   - `energies=`: energy tokens (§14.1)
   - `lookups=` + `calc=range`: length tokens (§14.3)
   - `lookups=` + `calc=inverse-stp`: STP tokens (§14.2)
   - Unknown token → invalid row (excluded, validation message shown).
4. For `energies=`: normalize to particle's internal energy unit:
   - Ions (A ≥ 1) → MeV/nucl; electron (particle 1001, A=0) → MeV only.
5. Check energy bounds for the program; out-of-range → invalid row.

**Numeric precision:** JavaScript `Number()` (IEEE 754 double). No arbitrary precision required.

### 8.3 Canonical URL Writing

After parsing and applying fallbacks, write the canonical v2 URL via `replaceState`.
This ensures bookmarks and shared links are always in canonical form.

**Canonical rules:**

- Include `urlv=2` first.
- Emit only params that differ from their defaults (§3.1 square-bracket notation).
- Emit `mode=basic|advanced` for every canonical Calculator URL; do not infer it
  from entity params.
- `uanchor=` is always emitted (no default-omit rule).
- Always emit singular anchors (`particle=`, `material=`, `program=`). Emit at
  most one plural comparison list (`particles=`, `materials=`, or `programs=`)
  and only when `mode=advanced&across=` matches it.
- `energies=` only when `calc=forward`; `lookups=` only when `calc=range` or
  `calc=inverse-stp`.
- `qshow=` omitted when both quantities are visible.
- `calc=` omitted when `"forward"` (the default).

### 8.4 Precedence Rules

| Conflict                                    | Resolution                                        |
| ------------------------------------------- | ------------------------------------------------- |
| `urlv` missing                              | Assume `1`; apply §7.1 migration                  |
| `urlv > CURRENT_URL_MAJOR`                  | Blocking modal (§7.2)                             |
| `urlv < 1` or non-integer                   | Blocking modal, "Load defaults" only              |
| `mode=` missing                             | Use `mode=basic`                                  |
| Plural entity list present in `mode=basic`  | Ignore plural list; keep singular anchors         |
| Plural entity list does not match `across=` | Ignore mismatched plural list                     |
| Matching plural list has all-invalid IDs    | Fall back to `across=none`; keep singular anchors |
| `hidden_programs=`                          | Silently drop (v1 migration)                      |
| Unknown `calc=` token                       | Fall back to `"forward"`                          |
| Invalid energy unit suffix                  | Invalid row; show validation message              |
| Both `eunit=` and per-row `:unit` in v1 URL | Per-row takes precedence; `eunit=` is fallback    |

---

## 9. Shareability & Compatibility

### 9.1 Deterministic Links

Given the same URL on two browsers or two machines, both show the same data rows,
stopping powers, CSDA ranges, plots, and colors. No `localStorage` state affects
visible output. WASM results are deterministic (no algorithm-selection randomness).

### 9.2 URL Versioning

| Constant                  | Value |
| ------------------------- | ----- |
| `CURRENT_URL_MAJOR`       | `2`   |
| `MIN_SUPPORTED_URL_MAJOR` | `1`   |

On load:

1. Read `urlv`.
2. If missing → assume `1`.
3. If `urlv === 2` → parse normally.
4. If `urlv === 1` → apply §7.1 migration, then show §7.2 banner.
5. If `urlv > 2` → §7.2 blocking modal.
6. If `urlv < 1` or invalid → §7.2 blocking modal, "Load defaults" only.

### 9.3 URL Length Guidance

| Scenario                          | Typical length |
| --------------------------------- | -------------- |
| Basic calculator, 1–5 energies    | ~80 bytes      |
| Advanced, 6 programs, 10 energies | ~200 bytes     |
| Plot, 3–5 series                  | ~150 bytes     |

Keep under 1500 bytes for maximum email/communicator compatibility. If the user
enters very many rows (>20 energies), warn that the URL may not copy correctly in
some contexts.

---

## 10. Share Button

### 10.1 Placement

Present in the **upper-right corner** of the toolbar on both Calculator and Plot
pages. Appearance is consistent across both pages.

### 10.2 Button States

| State       | Appearance                              | Condition                               |
| ----------- | --------------------------------------- | --------------------------------------- |
| **Ready**   | Default label "Copy link", link icon    | No recent copy                          |
| **Copied**  | Success color, label "Copied"           | Just after a successful clipboard write |
| **Updated** | Accent color, label "Copy updated link" | URL changed while in Copied state       |

Transitions:

```
Ready ──[click → success]──► Copied ──[~2 s]──► Ready
Copied ──[URL changes]──────► Updated ──[click → success]──► Copied
Updated ──[~2 s, no click]──► Ready
```

### 10.3 Clipboard Interaction

1. `await navigator.clipboard.writeText(window.location.href)`
2. On success → Copied state, 2-second revert timer.
3. On failure → fallback: temp `<input>`, select all, `document.execCommand('copy')`.
4. If both fail → inline tooltip: "Press Ctrl+C to copy".

### 10.4 Accessibility

| State   | `aria-label`                     |
| ------- | -------------------------------- |
| Ready   | `"Copy link to this page"`       |
| Copied  | `"Link copied to clipboard"`     |
| Updated | `"Link updated — copy new link"` |

Announce state changes via `aria-live="polite"` on the button region.

---

## 11. Security & Robustness

- **No code execution:** URL params are treated as strings and numbers only. No
  `eval()` or dynamic code execution.
- **XSS prevention:** Energy values and entity names are rendered as text. Entity
  names come from WASM fixed data tables, not from the URL.
- **Injection prevention:** All param names are fixed by this spec; no user-supplied
  keys are evaluated.
- **Safe series parsing:** `series` triplets are split, mapped to numeric IDs, and
  validated against the compatibility matrix. Invalid IDs are silently ignored.
- **Whitespace:** URLs must not contain unencoded spaces. Split on raw `&` and `=`
  before percent-decoding each component.

---

## 12. Acceptance Criteria & Fixtures

All examples assume:

- Proton (particle ID 1); Carbon-12 (ID 6)
- Water liquid (material ID 276)
- ICRU 90 (program ID 9); PSTAR (ID 2); Bethe-Ext00 (ID 101)
- URL contract version `urlv=2`

### 12.1 Round-Trip Tests

**Calculator forward mode:**

1. Load default calculator state → URL: `/calculator?urlv=2&mode=basic&particle=1&material=276&program=auto&energies=100&uanchor=MeV`
2. Add 200 MeV row → URL updates via replaceState.
3. Copy URL → open in new window → identical state.

**Calculator range mode:**

1. Switch to Advanced, then Range → tab → URL gains `mode=advanced` and `&calc=range`.
2. Enter `7.72 cm` → URL: `...&mode=advanced&lookups=7.72&runit=cm&uanchor=MeV&calc=range`.
3. Open URL in new window → Range mode active, same lookup value.

**Plot round-trip:**

1. Add series: ICRU 90 + Proton + Water → series=9.1.276.
2. Change stp_unit to MeV/cm → URL: `/plot?urlv=2&particle=1&material=276&program=auto&series=9.1.276&stp_unit=mev-cm`.
3. Open in new window → same series, same unit.

### 12.2 v1 URL Migration Tests

| v1 URL                                                        | Expected v2 behaviour                                                                                                |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `?urlv=1&particle=1&material=276&eunit=MeV/nucl&energies=100` | Parse → migrate to `mode=basic&uanchor=MeV/nucl`; show v1 banner                                                     |
| `?urlv=1&qfocus=csda`                                         | Migrate to `qshow=range`                                                                                             |
| `?urlv=1&mode=advanced&imode=csda&ivalues=7.72:cm&iunit=cm`   | Migrate to `mode=advanced&calc=range&lookups=7.72:cm&runit=cm`                                                       |
| `?urlv=1&mode=advanced&hidden_programs=2&programs=9,2`        | Preserve `mode=advanced`, derive `program=9&programs=9,2&across=programs`, drop `hidden_programs=`; show all columns |
| No `urlv` param                                               | Treat as v1; apply migration; show v1 banner                                                                         |

### 12.3 Invalid URL Recovery

**Nonexistent particle:**

```
/calculator?urlv=2&mode=basic&particle=999&energies=100&uanchor=MeV
```

→ Fallback to `particle=1`; canonical URL rewritten.

**Incompatible program:**

```
/calculator?urlv=2&mode=basic&particle=1&material=276&program=50&energies=100&uanchor=MeV
```

→ `program=auto`; toast "Program not available; using auto-select."

**Invalid energy row:**

```
/calculator?urlv=2&mode=basic&particle=1&material=276&energies=abc,100,xyz&uanchor=MeV
```

→ Rows 1 and 3 excluded; validation summary "2 of 3 values invalid".

---

## 13. Cross-Spec Consistency Checklist

- [ ] `uanchor=` replaces `eunit=` in canonical output; migration reads `eunit=` (#555).
- [ ] `qshow=stp|range` replaces `qfocus=`; state shapes in `multi-program.svelte.ts` updated (#561).
- [ ] `calc=forward|range|inverse-stp` replaces `imode=csda|stp`; route handling updated (#558).
- [ ] `across=` URL param wired to entity-selection state (#561).
- [ ] `istpbranch=` round-trips through `calculator-url.ts` (#560).
- [ ] `runit=` set `nm|um|mm|cm|dm|m|km` implemented in encoder/decoder (#558).
- [ ] `lookups=` replaces `ivalues=` in encoder/decoder + state field (#555 / #560).
- [ ] `hidden=` / `hidden_programs=` silently dropped (#561 migration).
- [ ] `shareable-urls-formal.md` ABNF grammar updated with v2 params after #561.
- [ ] `calculator.md` energy-unit token table updated to use `uanchor=` tokens.
- [ ] `inverse-lookups.md` §9 cross-referenced to this spec for canonical step ordering.

---

## 14. Token Reference

### 14.1 Energy Unit Tokens (`uanchor=` and inline `:unit` in `energies=`)

#### Master-anchor token set — used as `uanchor=` value (3 tokens)

| Token      | Resolves to | Example            |
| ---------- | ----------- | ------------------ |
| `MeV`      | MeV         | `uanchor=MeV`      |
| `MeV/nucl` | MeV/nucl    | `uanchor=MeV/nucl` |
| `MeV/u`    | MeV/u       | `uanchor=MeV/u`    |

The master anchor is restricted to the three MeV-prefix forms. SI-prefixed
variants (`keV`, `GeV`, etc.) are not valid `uanchor=` values; use them as
per-row `:unit` suffixes inside `energies=` instead.

#### Per-row suffix token set — used in `energies=` / `lookups=` per-row `:unit` (15 tokens)

Full cross-product of **5 prefixes × 3 suffixes**:

|                   | (none — base only) | `/nucl` (per-nucleon) | `/u` (per atomic mass unit) |
| ----------------- | ------------------ | --------------------- | --------------------------- |
| `eV` (×10⁻⁶ MeV)  | `eV`               | `eV/nucl`             | `eV/u`                      |
| `keV` (×10⁻³ MeV) | `keV`              | `keV/nucl`            | `keV/u`                     |
| `MeV` (base)      | `MeV`              | `MeV/nucl`            | `MeV/u`                     |
| `GeV` (×10³ MeV)  | `GeV`              | `GeV/nucl`            | `GeV/u`                     |
| `TeV` (×10⁶ MeV)  | `TeV`              | `TeV/nucl`            | `TeV/u`                     |

All tokens are CASE-SENSITIVE — see §1.3. Examples:
`energies=100:MeV,500:keV,2.5:GeV/nucl`.

**Per-row suffix vs uanchor:** `uanchor=` declares the **master** unit applied
to rows that have no `:unit` suffix. Per-row suffixes override the master for
that row. The two sets overlap on the three MeV forms but the suffix set is
strictly larger.

### 14.2 Stopping Power Tokens (`sunit=` and `stp_unit=`)

| Token       | Display   |
| ----------- | --------- |
| `kev-um`    | keV/µm    |
| `mev-cm`    | MeV/cm    |
| `mev-cm2-g` | MeV·cm²/g |

### 14.3 Range Unit Tokens (`runit=`)

| Token | Display      |
| ----- | ------------ |
| `nm`  | nm           |
| `um`  | µm           |
| `mm`  | mm           |
| `cm`  | cm (default) |
| `dm`  | dm           |
| `m`   | m            |
| `km`  | km           |

### 14.4 Calculator Mode Tokens

| Token         | Meaning                                                  |
| ------------- | -------------------------------------------------------- |
| `forward`     | Energy → STP + Range (default; omitted in canonical URL) |
| `range`       | CSDA Range → Energy                                      |
| `inverse-stp` | Stopping Power → Energy                                  |

### 14.5 Axis Scale Tokens (Plot)

| Token | Meaning                        |
| ----- | ------------------------------ |
| `log` | Logarithmic (default; omitted) |
| `lin` | Linear                         |
