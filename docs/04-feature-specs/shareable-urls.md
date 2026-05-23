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
> - **v1–v6** (April 2026): initial URL contract (`urlv=1`).
> - **v7** (2026-05-23): rewritten for v2 schema (`urlv=2`). Supersedes the
>   separately-maintained `url-schema.md` (now deleted). Key v1→v2 changes:
>   `eunit=` → `uanchor=`; `qfocus=stp|csda|both` → `qshow=stp|range` (2-state);
>   `imode=csda|stp` → `mode=range|inverse-stp`; `hidden_programs=` removed;
>   `ivalues=` → `lookups=`; new params `runit=`, `sunit=`, `across=`,
>   `istpbranch=`, `tip_seen=`; advanced/basic picker inferred from `programs=`
>   vs `program=` (no longer a URL token).

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

---

## 2. Schema Changes from v1

This table summarizes every calculator-route URL change in v2. Plot-route params
that are unchanged from v1 are listed in §3.8.

| Param | v2 Status | Notes |
|---|---|---|
| `urlv=` | **bumped to 2** | Triggers v1→v2 migration on read (§7.1) |
| `particle=` · `material=` · `program=` · `programs=` | **unchanged** | Same names + semantics as v1 |
| `extdata=` · `mat_*=` · `agg_state=` · `interp_*=` · `mstar_mode=` · `density=` · `ival=` | **unchanged** | Same as `shareable-urls-formal.md` v6 |
| `across=none\|programs\|materials\|particles` | **new** | Was UI state only in v1; now in URL |
| `mode=forward\|range\|inverse-stp` | **new** | Calculator operation mode; replaces `imode=csda\|stp` |
| `hidden=` / `hidden_programs=` | **removed** | Silently dropped on read; visibility from picker selection |
| `qshow=stp\|range` | **replaces `qfocus=`** | 3-state → 2-state; values renamed (see §3.7) |
| `uanchor=mev\|mev-nucl\|mev-u` | **new** | Energy unit anchor; replaces `eunit=` |
| `runit=nm\|um\|mm\|cm\|dm\|m\|km` | **new** | Range unit anchor (Range → mode + CSDA range display) |
| `sunit=kev-um\|mev-cm\|mev-cm2-g` | **new** | STP unit anchor (STP → mode + STP display) |
| `energies=100,10:keV,2:GeV` | **extended** | Per-row `:unit` suffix; used only when `mode=forward` |
| `lookups=` | **renamed** from `ivalues=` | Inverse-mode input list; same `:unit` suffix syntax |
| `istpbranch=hi\|lo\|both` | **new** | Sticky inverse-STP branch column state |
| `tip_seen=inline_unit` | **new (optional)** | Inline-unit tip dismissal flag |

> **Note on mode token naming:** `forward|range|inverse-stp` are the v2 tokens. A
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

| Attribute | Value |
|---|---|
| Type | Positive integer |
| Current value | `2` |
| Default if absent | treat as `1` (legacy link) |

Canonical URLs always emit `urlv=2`. If absent, the parser assumes v1 and applies
migration rules (§7). If the value is unknown future major, show the migration modal
(§7.2).

### 3.3 Entity Parameters (shared, unchanged from v1)

| Param | Type | Default | Notes |
|---|---|---|---|
| `particle` | numeric ID | `1` (proton) | Must exist in compatibility matrix |
| `material` | numeric ID or `"custom"` | `276` (water liquid) | Must be compatible with particle + program |
| `program` | `"auto"` or numeric ID | `"auto"` | Basic mode only; incompatible → fall back to `"auto"` |
| `programs` | comma-separated IDs | — | Advanced mode only; first is the default program |

**Advanced vs basic mode** is no longer a URL token in v2. The parser infers it:

- `program=` present → basic mode (single program)
- `programs=` present → advanced mode (multi-program)

The v1 literal `mode=advanced` / `mode=basic` is accepted on read for migration
but **never emitted** in v2 canonical output. There is no ambiguity with the v2
`mode=` calc-operation tokens because the value sets don't overlap.

### 3.4 `mode` — Calculator Operation Mode

| Attribute | Value |
|---|---|
| Type | `"forward"` \| `"range"` \| `"inverse-stp"` |
| Default | `"forward"` (omitted from canonical URL) |
| v1 equivalent | implicit `"forward"` + `imode=csda\|stp` for inverse modes |

| Token | Input column | Output column | UI tab |
|---|---|---|---|
| `forward` | Energy (user-typed) | STP + CSDA Range | default |
| `range` | CSDA Range (user-typed) | Energy | R→ |
| `inverse-stp` | Stopping Power (user-typed) | Energy | S→ |

The v1 param `imode=csda` maps to `mode=range`; `imode=stp` maps to
`mode=inverse-stp` (see §7.1 migration table).

### 3.5 `energies` — Energy Input List (mode=forward only)

| Attribute | Value |
|---|---|
| Type | Comma-separated `energy-item` list |
| Grammar | `energy-item = number [":" energy-unit-token]` |
| Used when | `mode=forward` (the default); absent in `mode=range` and `mode=inverse-stp` |

Each item is a bare number (inherits `uanchor=`) or a number with an explicit
per-row `:unit` suffix. The colon is RFC 3986 §3.4-safe within a query string.

Valid per-row unit tokens: `eV`, `keV`, `MeV`, `GeV`, `TeV`, `MeV/nucl`,
`keV/nucl`, `GeV/nucl`, `MeV/u`, `keV/u`, `GeV/u`. Unknown → invalid row.

**Worked example — mixed inline units:**

```
?urlv=2&particle=1&material=276&program=auto&energies=100,10:keV,2:GeV,250&uanchor=mev
```

→ Four rows: 100 MeV, 10 keV, 2 GeV, 250 MeV.

### 3.6 `uanchor` — Energy Unit Anchor (replaces v1 `eunit=`)

| Attribute | Value |
|---|---|
| Type | `"mev"` \| `"mev-nucl"` \| `"mev-u"` |
| Default | `"mev"` |
| Always emitted | yes (never omitted) |
| v1 equivalent | `eunit=MeV\|MeV/nucl\|MeV/u` |

Determines how unsuffixed rows in `energies=` are interpreted and sets the
Energy column header. For proton (A=1), `mev` and `mev-nucl` are numerically
identical; `mev-u` differs by ~0.1% — see the `(≠MeV)` badge in #558.

**Worked example — carbon at MeV/nucl:**

```
?urlv=2&particle=6&material=276&program=auto&energies=10,50,200&uanchor=mev-nucl
```

### 3.7 `lookups` — Inverse-Lookup Input List (mode=range or mode=inverse-stp)

| Attribute | Value |
|---|---|
| Type | Comma-separated `lookup-item` list |
| Grammar | `lookup-item = number [":" unit-token]` |
| Used when | `mode=range` or `mode=inverse-stp`; absent in `mode=forward` |
| v1 name | `ivalues=` (renamed to avoid collision with Bethe-Bloch I-value `ival=`) |

Per-row unit depends on mode:
- `mode=range` → length token from `runit=` token set
- `mode=inverse-stp` → STP token from `sunit=` token set

**Worked example — range lookup, mixed length units:**

```
?urlv=2&particle=1&material=276&programs=9&lookups=7.718:cm,45:um,1.5:mm&runit=cm&uanchor=mev&mode=range
```

**Worked example — STP inverse lookup:**

```
?urlv=2&particle=1&material=276&programs=9&lookups=45.76,10.00&sunit=kev-um&uanchor=mev&mode=inverse-stp
```

### 3.8 `runit` — Range Unit Anchor

| Attribute | Value |
|---|---|
| Type | `"nm"` \| `"um"` \| `"mm"` \| `"cm"` \| `"dm"` \| `"m"` \| `"km"` |
| Default | `"cm"` (omitted when default) |
| v1 equivalent | `iunit=` when `imode=csda` |

Sets (1) the CSDA Range column header, (2) the unit for unsuffixed rows in
`lookups=` when `mode=range`. The full SI-prefix span (`nm` through `km`) covers
sub-mm medical physics through km-scale cosmic-ray scenarios.

Per-cell values **auto-scale** to an appropriate prefix regardless of `runit=`
(per #556 `value-formatters.ts`). `runit=` only anchors the **input** and header.

### 3.9 `sunit` — STP Unit Anchor

| Attribute | Value |
|---|---|
| Type | `"kev-um"` \| `"mev-cm"` \| `"mev-cm2-g"` |
| Default | `"kev-um"` (condensed materials); `"mev-cm2-g"` (gases) |
| v1 equivalent | `stp_unit=` (plot) / `iunit=` when `imode=stp` |

| Token | Display label |
|---|---|
| `kev-um` | keV/µm |
| `mev-cm` | MeV/cm |
| `mev-cm2-g` | MeV·cm²/g |

Sets (1) the Stopping Power column header, (2) the unit for unsuffixed rows in
`lookups=` when `mode=inverse-stp`.

### 3.10 `qshow` — Quantity Display Toggle (replaces v1 `qfocus=`)

| Attribute | Value |
|---|---|
| Type | `"stp"` \| `"range"` |
| Default | both quantities visible (param absent) |
| Mode | Advanced only; ignored in basic mode |

| v2 `qshow=` | v1 `qfocus=` | Meaning |
|---|---|---|
| *(absent)* | `both` | Both stopping power + range columns visible |
| `stp` | `stp` | Stopping power columns only |
| `range` | `csda` | Range columns only |

CSV export always includes both quantities regardless of `qshow=`. Unlike v1
(which always emitted `qfocus=both`), v2 omits `qshow=` when the default applies.

### 3.11 `across` — Compare-Across Dimension

| Attribute | Value |
|---|---|
| Type | `"none"` \| `"programs"` \| `"materials"` \| `"particles"` |
| Default | `"none"` (omitted) |
| Mode | Advanced only |

Controls which entity axis drives the multi-column comparison. In v1 this was
stored only in UI state (not the URL).

### 3.12 `istpbranch` — Inverse-STP Branch Visibility

| Attribute | Value |
|---|---|
| Type | `"hi"` \| `"lo"` \| `"both"` |
| Default | `"hi"` (omitted) |
| Mode | Only relevant when `mode=inverse-stp` |

Some STP values have two energy solutions (high-E and low-E branches). The
`both` state is sticky: once the user sees a dual-solution row and the
column opens, `istpbranch=both` keeps it visible on reload.

| Token | Meaning |
|---|---|
| `hi` | High-energy branch only (default) |
| `lo` | Low-energy branch only (reserved; not implemented in #560) |
| `both` | Both branch columns visible |

### 3.13 `tip_seen` — Tip Dismissal Flag (optional)

| Attribute | Value |
|---|---|
| Type | Literal `"inline_unit"` |
| Default | absent (tip not yet seen) |

Cross-device sharing of the "type a unit too — e.g. `10 keV`" dismissal state.
Primary persistence is `localStorage`; the URL param is an optional supplement.

### 3.14 Plot Parameters (unchanged from v1)

| Param | Example | Default | Notes |
|---|---|---|---|
| `series` | `9.1.276,2.6.276` | — | Committed series: `programId.particleId.materialId` triplets |
| `stp_unit` | `kev-um` | `kev-um` (omit) | Plot stopping-power display unit |
| `xscale` | `log` | `log` (omit) | X-axis scale |
| `yscale` | `log` | `log` (omit) | Y-axis scale |

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

### 4.1 Mode = forward (default) — Energy → STP + Range

**Basic mode:**

```
/calculator?urlv=2&particle=1&material=276&program=auto&energies=100,200,500&uanchor=mev
```

**Basic mode, mixed inline units:**

```
/calculator?urlv=2&particle=1&material=276&program=auto&energies=100,10:keV,2:GeV&uanchor=mev
```

**Advanced mode, multi-program, STP column only:**

```
/calculator?urlv=2&particle=1&material=276&programs=9,2&energies=100,200&uanchor=mev&qshow=stp
```

**Carbon-12, MeV/nucl:**

```
/calculator?urlv=2&particle=6&material=276&program=auto&energies=10,100&uanchor=mev-nucl
```

### 4.2 Mode = range — CSDA Range → Energy

```
/calculator?urlv=2&particle=1&material=276&programs=9&lookups=7.718:cm,20:cm&runit=cm&uanchor=mev&mode=range
```

Large-scale (km), alpha in air:

```
/calculator?urlv=2&particle=2&material=3&programs=9&lookups=1.5,3.0&runit=km&uanchor=mev&mode=range
```

### 4.3 Mode = inverse-stp — STP → Energy

Single branch (default hi), master STP unit:

```
/calculator?urlv=2&particle=1&material=276&programs=9&lookups=45.76,10.00&sunit=kev-um&uanchor=mev&mode=inverse-stp
```

Both branches visible (sticky):

```
/calculator?urlv=2&particle=1&material=276&programs=9&lookups=10.0:kev-um,5.0:kev-um&sunit=kev-um&uanchor=mev&mode=inverse-stp&istpbranch=both
```

### 4.4 Compare-Across Programs (advanced)

```
/calculator?urlv=2&particle=1&material=276&programs=9,2,101&energies=100,200&uanchor=mev&across=programs&qshow=range
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

| v1 param | v2 behaviour |
|---|---|
| `particle=` · `material=` · `program=` · `programs=` | Emit unchanged |
| `eunit=MeV` | Map to `uanchor=mev` |
| `eunit=MeV/nucl` | Map to `uanchor=mev-nucl` |
| `eunit=MeV/u` | Map to `uanchor=mev-u` |
| `qfocus=both` | Omit `qshow=` (default — both visible) |
| `qfocus=stp` | Emit `qshow=stp` |
| `qfocus=csda` | Emit `qshow=range` |
| `imode=csda` | Emit `mode=range` |
| `imode=stp` | Emit `mode=inverse-stp` |
| `iunit=` (with `imode=csda`) | Map to `runit=` |
| `iunit=` (with `imode=stp`) | Map to `sunit=` |
| `ivalues=` | Rename to `lookups=` (value syntax unchanged) |
| `mode=advanced` or `mode=basic` | Discard literal; advanced mode inferred from `programs=` |
| `hidden=` or `hidden_programs=` | Silently drop |
| `energies=` without `:unit` suffixes | Load unchanged; unsuffixed rows use migrated `uanchor=` |
| Any unknown param | Silently drop |

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
>  [Copy updated link]  [Dismiss ✕]"

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
  > [Try migration]  [Load defaults]

- **"Try migration"** — applies available migration rules best-effort; proceeds
  even if some params are unrecognised (they are silently dropped). User sees a
  secondary notice: "Some URL parameters could not be interpreted and were ignored."
- **"Load defaults"** — discards all URL params; loads the default calculator state
  (`urlv=2&particle=1&material=276&program=auto&energies=100&uanchor=mev`).
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
   - `lookups=` + `mode=range`: length tokens (§14.3)
   - `lookups=` + `mode=inverse-stp`: STP tokens (§14.2)
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
- `uanchor=` is always emitted (no default-omit rule).
- `program=` XOR `programs=` — never both.
- `energies=` only when `mode=forward`; `lookups=` only when `mode=range` or
  `mode=inverse-stp`.
- `qshow=` omitted when both quantities are visible.
- `mode=` omitted when `"forward"` (the default).

### 8.4 Precedence Rules

| Conflict | Resolution |
|---|---|
| `urlv` missing | Assume `1`; apply §7.1 migration |
| `urlv > CURRENT_URL_MAJOR` | Blocking modal (§7.2) |
| `urlv < 1` or non-integer | Blocking modal, "Load defaults" only |
| Both `program=` and `programs=` present | Use `programs=`; ignore `program=` |
| `programs=` with all-invalid IDs | Fall back to `program=auto` |
| `hidden_programs=` | Silently drop (v1 migration) |
| Unknown `mode=` token | Fall back to `"forward"` |
| Invalid energy unit suffix | Invalid row; show validation message |
| Both `eunit=` and per-row `:unit` in v1 URL | Per-row takes precedence; `eunit=` is fallback |

---

## 9. Shareability & Compatibility

### 9.1 Deterministic Links

Given the same URL on two browsers or two machines, both show the same data rows,
stopping powers, CSDA ranges, plots, and colors. No `localStorage` state affects
visible output. WASM results are deterministic (no algorithm-selection randomness).

### 9.2 URL Versioning

| Constant | Value |
|---|---|
| `CURRENT_URL_MAJOR` | `2` |
| `MIN_SUPPORTED_URL_MAJOR` | `1` |

On load:

1. Read `urlv`.
2. If missing → assume `1`.
3. If `urlv === 2` → parse normally.
4. If `urlv === 1` → apply §7.1 migration, then show §7.2 banner.
5. If `urlv > 2` → §7.2 blocking modal.
6. If `urlv < 1` or invalid → §7.2 blocking modal, "Load defaults" only.

### 9.3 URL Length Guidance

| Scenario | Typical length |
|---|---|
| Basic calculator, 1–5 energies | ~80 bytes |
| Advanced, 6 programs, 10 energies | ~200 bytes |
| Plot, 3–5 series | ~150 bytes |

Keep under 1500 bytes for maximum email/communicator compatibility. If the user
enters very many rows (>20 energies), warn that the URL may not copy correctly in
some contexts.

---

## 10. Share Button

### 10.1 Placement

Present in the **upper-right corner** of the toolbar on both Calculator and Plot
pages. Appearance is consistent across both pages.

### 10.2 Button States

| State | Appearance | Condition |
|---|---|---|
| **Ready** | Default label "Copy link", link icon | No recent copy |
| **Copied** | Success color, label "Copied" | Just after a successful clipboard write |
| **Updated** | Accent color, label "Copy updated link" | URL changed while in Copied state |

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

| State | `aria-label` |
|---|---|
| Ready | `"Copy link to this page"` |
| Copied | `"Link copied to clipboard"` |
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

1. Load default calculator state → URL: `/calculator?urlv=2&particle=1&material=276&program=auto&energies=100&uanchor=mev`
2. Add 200 MeV row → URL updates via replaceState.
3. Copy URL → open in new window → identical state.

**Calculator range mode:**

1. Switch to Range → tab → URL gains `&mode=range`.
2. Enter `7.72 cm` → URL: `...&lookups=7.72&runit=cm&uanchor=mev&mode=range`.
3. Open URL in new window → Range mode active, same lookup value.

**Plot round-trip:**

1. Add series: ICRU 90 + Proton + Water → series=9.1.276.
2. Change stp_unit to MeV/cm → URL: `/plot?urlv=2&particle=1&material=276&program=auto&series=9.1.276&stp_unit=mev-cm`.
3. Open in new window → same series, same unit.

### 12.2 v1 URL Migration Tests

| v1 URL | Expected v2 behaviour |
|---|---|
| `?urlv=1&particle=1&material=276&eunit=MeV/nucl&energies=100` | Parse → migrate to `uanchor=mev-nucl`; show v1 banner |
| `?urlv=1&qfocus=csda` | Migrate to `qshow=range` |
| `?urlv=1&imode=csda&ivalues=7.72:cm&iunit=cm` | Migrate to `mode=range&lookups=7.72:cm&runit=cm` |
| `?urlv=1&hidden_programs=2&programs=9,2` | Drop `hidden_programs=`; show all columns |
| No `urlv` param | Treat as v1; apply migration; show v1 banner |

### 12.3 Invalid URL Recovery

**Nonexistent particle:**
```
/calculator?urlv=2&particle=999&energies=100&uanchor=mev
```
→ Fallback to `particle=1`; canonical URL rewritten.

**Incompatible program:**
```
/calculator?urlv=2&particle=1&material=276&program=50&energies=100&uanchor=mev
```
→ `program=auto`; toast "Program not available; using auto-select."

**Invalid energy row:**
```
/calculator?urlv=2&particle=1&material=276&energies=abc,100,xyz&uanchor=mev
```
→ Rows 1 and 3 excluded; validation summary "2 of 3 values invalid".

---

## 13. Cross-Spec Consistency Checklist

- [ ] `uanchor=` replaces `eunit=` in canonical output; migration reads `eunit=` (#555).
- [ ] `qshow=stp|range` replaces `qfocus=`; state shapes in `multi-program.svelte.ts` updated (#561).
- [ ] `mode=forward|range|inverse-stp` replaces `imode=csda|stp`; route handling updated (#558).
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

| Token | Resolves to | Example |
|---|---|---|
| `mev` (uanchor) | MeV | `uanchor=mev` |
| `mev-nucl` (uanchor) | MeV/nucl | `uanchor=mev-nucl` |
| `mev-u` (uanchor) | MeV/u | `uanchor=mev-u` |
| `MeV` (inline `:unit`) | MeV | `energies=100:MeV` |
| `keV` (inline) | keV (×0.001 MeV) | `energies=100:keV` |
| `GeV` (inline) | GeV (×1000 MeV) | `energies=100:GeV` |
| `MeV/nucl` (inline) | MeV/nucl | `energies=10:MeV/nucl` |
| `keV/nucl`, `GeV/nucl` | respective prefix variants | |
| `MeV/u`, `keV/u`, `GeV/u` | per-atomic-mass-unit variants | |
| `eV`, `TeV` | extremes | |

**Note:** `uanchor=` uses lowercase hyphenated tokens (`mev`, `mev-nucl`, `mev-u`).
Inline `:unit` tokens in `energies=` use the display-form notation (`MeV`,
`MeV/nucl`, etc.). These are two distinct token sets.

### 14.2 Stopping Power Tokens (`sunit=` and `stp_unit=`)

| Token | Display |
|---|---|
| `kev-um` | keV/µm |
| `mev-cm` | MeV/cm |
| `mev-cm2-g` | MeV·cm²/g |

### 14.3 Range Unit Tokens (`runit=`)

| Token | Display |
|---|---|
| `nm` | nm |
| `um` | µm |
| `mm` | mm |
| `cm` | cm (default) |
| `dm` | dm |
| `m` | m |
| `km` | km |

### 14.4 Calculator Mode Tokens

| Token | Meaning |
|---|---|
| `forward` | Energy → STP + Range (default; omitted in canonical URL) |
| `range` | CSDA Range → Energy |
| `inverse-stp` | Stopping Power → Energy |

### 14.5 Axis Scale Tokens (Plot)

| Token | Meaning |
|---|---|
| `log` | Logarithmic (default; omitted) |
| `lin` | Linear |
