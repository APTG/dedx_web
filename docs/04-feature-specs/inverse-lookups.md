# Feature: Inverse Lookups

> **Status:** Draft v1 (10 April 2026)
>
> This spec covers the two inverse lookup modes available on the Calculator
> page: **Inverse STP** (energy from stopping power) and **Inverse CSDA**
> (energy from CSDA range). Both are advanced features, visible only when
> the app-wide Advanced mode is active.
>
> **Related specs:**
> - Calculator page (forward lookup, unified table, entity selection): [`calculator.md`](calculator.md)
> - Unit handling (energy units, SI prefixes, inline detection, output units): [`unit-handling.md`](unit-handling.md)
> - WASM API contract (service methods, result types): [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md) §§2.3, 3
> - Advanced Options panel (overrides, placement, gating): [`advanced-options.md`](advanced-options.md)
> - Shareable URLs (canonical ordering): [`shareable-urls.md`](shareable-urls.md) §7.3
> - Formal URL grammar: [`shareable-urls-formal.md`](shareable-urls-formal.md)

---

## User Story

**As a** radiation physicist,
**I want to** enter a stopping power or CSDA range value and immediately
see the energy that produces it,
**so that** I can work backwards from a measured quantity to the incident
particle energy without iterating manually.

**As a** researcher using tabulated range data,
**I want to** type a range value in the same units my data uses (mm, cm,
µm) and get the corresponding energy,
**so that** I do not have to convert units by hand before or after the lookup.

---

## 1. Feature Gate — Advanced Mode Only

Inverse lookups are an **advanced feature**. They are hidden in Basic mode
to keep the standard Calculator page uncluttered for the majority of users
who only need forward (energy → stopping power / range) lookups.

### Visibility Rule

| App mode | Tab bar on Calculator page |
|----------|---------------------------|
| **Basic** (default) | `[ Forward ]` — only the Forward tab is shown |
| **Advanced** | `[ Forward ]  [ Inverse STP ]  [ Inverse CSDA ]` — all three tabs shown |

The Advanced mode toggle is the app-wide Basic/Advanced control in the
top-right action bar, as defined in
[`../01-project-vision.md`](../01-project-vision.md) §4.4.

When the user enables Advanced mode, the two inverse tabs appear in the
tab bar with no further interaction required. When the user disables
Advanced mode while an Inverse tab is active, the view switches back to
the Forward tab automatically.

> **Rationale:** Hiding (not locking) the inverse tabs in Basic mode
> ensures they are completely invisible to casual users. There is no
> "locked" icon and no upsell prompt — the feature simply does not exist
> in the standard experience.

---

## 2. Tab Layout

The three tabs share the same entity selection row (Particle, Material,
Program comboboxes + energy unit selector) at the top of the Calculator
page. Switching tabs only replaces the table area below.

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Particle: [Proton (H) ▾]   Material: [Water (liquid) ▾] 💧liquid         │
│  Program:  [Auto → ICRU 90 ▾]           Energy: (•) MeV                   │
├────────────────────────────────────────────────────────────────────────────┤
│  ▶ Advanced Options                              ← Advanced mode only      │
├────────────────────────────────────────────────────────────────────────────┤
│  [ Forward ]  [ Inverse STP ]  [ Inverse CSDA ]  ← Advanced mode only     │
├────────────────────────────────────────────────────────────────────────────┤
│  (active tab content)                                                      │
└────────────────────────────────────────────────────────────────────────────┘
```

The Advanced Options accordion is positioned between the entity row and the
tab switcher, per [`advanced-options.md`](advanced-options.md) §1 ("below
entity selection row, above primary content"). The tab switcher is the top
of the primary content area and is therefore below the accordion. Both the
accordion and the tab switcher are only visible in Advanced mode.

---

## 3. Shared Context

### Entity Selection

The same `EntitySelectionState` (Particle, Material, Program) that drives
the Forward tab is used by both Inverse tabs. Changing a selector on any
tab immediately affects all three. A lookup only runs when
`EntitySelectionState.isComplete === true`.

### Advanced Options

When Advanced mode is active and Advanced Options are set (see
[`advanced-options.md`](advanced-options.md)), the same `AdvancedOptions`
object — all six overrides: `aggregateState`, `interpolationScale`,
`interpolationMethod`, `mstarMode`, `densityOverride`, `iValueOverride` —
is passed to the inverse WASM calls (`getInverseStp`, `getInverseCsda`) in
the same way it is passed to `calculate()` on the Forward tab. This ensures
that forward and inverse results are consistent when overrides are active.

The same program-specific restrictions apply: `mstarMode` is only
meaningful when the selected program is MSTAR; it is ignored otherwise.

### Energy Unit Selector

The master energy unit selector (MeV / MeV/nucl / MeV/u) in the entity
row controls the **output** energy unit displayed in the inverse result
columns. See [§6](#6-energy-output-auto-scaling) for the auto-scaling
rules that are applied on top of the selected unit.

---

## 4. Inverse STP Tab

### 4.1 Purpose

Given one or more **stopping power** values, find the particle energy that
produces each value in the current material. Because stopping power is
non-monotonic (it rises and then falls with increasing energy, peaking at
the Bragg peak), each input value maps to **two distinct energies** — one
on the low-energy branch (ascending side of the Bragg peak) and one on the
high-energy branch (descending side). Both are returned simultaneously.

WASM call: [`LibdedxService.getInverseStp()`](../06-wasm-api-contract.md#3-service-interface)
with `side = 0` (low) and `side = 1` (high) — called twice per batch of
input values. Result type: [`InverseStpResult`](../06-wasm-api-contract.md#23-calculation-results)
(energies in MeV/nucl).

### 4.2 Table Columns

| # | Column | Header | Editable? | Content |
|---|--------|--------|-----------|---------|
| 1 | **Typed Value** | "Stopping Power ({unit})" | **Yes** | User types a stopping power value. No inline suffix detection — unit is set via the unit dropdown (see §4.3). |
| 2 | **Unit** | "Unit" | Via dropdown | Unit dropdown for the input value. Default mirrors the forward Calculator output unit for the current material (see §4.3). |
| 3 | **E low** | "E low ({unit})" | No | Energy on the low-energy branch (below the Bragg peak), auto-scaled (see §6). `—` when no solution exists. |
| 4 | **E high** | "E high ({unit})" | No | Energy on the high-energy branch (above the Bragg peak), auto-scaled (see §6). `—` when no solution exists. |

The header labels for **E low** and **E high** include the active display
unit after auto-scaling is applied to the first valid row; if rows
auto-scale to different units, both columns use the unit string `"(auto)"`.

> **Note:** Unlike the CSDA tab, the STP input column does **not** use
> inline suffix detection. Stopping power unit names (keV/µm, MeV·cm²/g,
> MeV/cm) are not suited to casual inline typing. A dropdown is clearer
> and less error-prone.

### 4.3 Input Unit

The input unit dropdown offers three options: **keV/µm**, **MeV/cm**,
**MeV·cm²/g**.

Default selection mirrors the forward Calculator's stopping power output
unit for the currently selected material:

| Material phase | Default input unit |
|----------------|--------------------|
| Solid or liquid (`isGasByDefault = false`) | **keV/µm** |
| Gas (`isGasByDefault = true`) | **MeV·cm²/g** |

This default is chosen so that values from the Forward tab's Stopping
Power column can be copied and pasted directly into the Inverse STP
input without manual unit conversion.

When the user changes the material and the phase changes (gas ↔ non-gas),
the input unit dropdown resets to the new default. Existing typed values
are **not modified** — they are reinterpreted in the new unit (the same
behaviour as the forward energy unit selector on particle change).

Before calling `getInverseStp()`, values are converted to
**MeV·cm²/g** (the WASM native input unit) using the stopping power
conversion formulas from [`unit-handling.md`](unit-handling.md) §5.2 and
the material density from `LibdedxService.getDensity(materialId)`.

### 4.4 Row Validation

| Condition | Row status | Display |
|-----------|-----------|---------|
| Valid positive number | ✅ Valid | E low and E high columns populated |
| Empty row | ⏭️ Skipped | No results; row kept for input |
| Non-numeric text | ❌ Invalid | Row highlighted; tooltip: "Enter a numeric value" |
| Negative number or zero | ❌ Invalid | Row highlighted: "Stopping power must be positive" |
| Value exceeds Bragg peak maximum | ⚠️ No solution | Both E low and E high cells show `—` (no highlight) |

When the queried stopping power exceeds the Bragg peak maximum for the
current particle/material/program combination, no solution exists on
either branch. The C library returns an error for both `side = 0` and
`side = 1`. The row is not highlighted — the `—` result is a valid
(if physically extreme) response, not a user error.

### 4.5 Wireframe (Advanced mode, non-gas material)

```
  Branch note: two energies are shown per row because the same stopping
  power occurs at two different energies — one below and one above the
  Bragg peak.

  ┌────────────────────┬────────┬──────────────┬──────────────┐
  │ Stopping Power     │ Unit   │ E low        │ E high       │
  │ (keV/µm)           │        │ (auto)       │ (auto)       │
  ├────────────────────┼────────┼──────────────┼──────────────┤
  │ 45.76              │keV/µm▾ │ 100.0 MeV    │ 312.4 MeV    │
  │ 10.00              │keV/µm▾ │ 287.1 MeV    │ 891.0 MeV    │
  │ 999.99             │keV/µm▾ │ —            │ —            │
  │ ░░░░░░             │        │              │              │
  └────────────────────┴────────┴──────────────┴──────────────┘
  Valid range: 0.001–10000 MeV/nucl (ICRU 90, Proton)     [Export CSV ↓]
```

---

## 5. Inverse CSDA Tab

### 5.1 Purpose

Given one or more **CSDA range** values, find the particle energy that
produces each range in the current material. CSDA range is strictly
monotonic in energy, so the inverse is **always unique** — there is no
branch-selection problem.

WASM call: [`LibdedxService.getInverseCsda()`](../06-wasm-api-contract.md#3-service-interface).
Result type: [`InverseCsdaResult`](../06-wasm-api-contract.md#23-calculation-results)
(energies in MeV/nucl).

### 5.2 Table Columns

| # | Column | Header | Editable? | Content |
|---|--------|--------|-----------|---------|
| 1 | **Typed Value** | "CSDA Range" | **Yes** | User types a range value with an optional length suffix (e.g., `7.718 cm`, `45 µm`). Inline suffix detection applies (see §5.3). |
| 2 | **Normalized** | "→ g/cm²" | No | The typed value converted to g/cm² (the WASM input unit). 4 significant figures. Scientific notation for very small/large values. |
| 3 | **Unit** | "Unit" | Via dropdown | Per-row unit dropdown in per-row mode; shows the master unit in master mode. |
| 4 | **Energy** | "→ Energy (auto)" | No | Resulting energy, auto-scaled to the best SI prefix (see §6). |

### 5.3 Input Unit — Inline Suffix Detection

The CSDA range input uses **inline suffix detection** analogous to the
energy input on the Forward tab (see [`unit-handling.md`](unit-handling.md)
§3). The user may type values with trailing length unit suffixes, and the
parser detects them per-row after the 300ms debounce.

#### Supported Length Suffixes

| Suffix (case-insensitive) | Resolved base unit | SI multiplier to cm |
|---------------------------|--------------------|---------------------|
| `nm` | cm | ×1e-7 |
| `µm` or `um` | cm | ×1e-4 |
| `mm` | cm | ×1e-1 |
| `cm` | cm | ×1 |
| `m` | cm | ×100 |

The base unit for internal calculations is **cm** (before density
conversion to g/cm²). SI-prefixed variants are parsed from typed text and
normalised to cm.

#### Master and Per-Row Mode

The same master/per-row mode model as the energy input applies:

| Mode | Condition | Master selector state |
|------|-----------|-----------------------|
| **Master mode** (default) | No row has an explicit suffix | Active — all rows use the master unit |
| **Per-row mode** | At least one row has a typed suffix | Greyed out / disabled — each row has its own unit dropdown |

The master unit defaults to **cm**. The dropdown options are the five
base length units: nm, µm, mm, cm, m (SI-prefixed variants are typed
suffixes only, not dropdown options).

#### Internal Conversion

Before calling `getInverseCsda()`, each row's value is converted to
**g/cm²** (the WASM native input unit):

```
range_gcm2 = range_cm / ρ
```

where ρ = `LibdedxService.getDensity(materialId)` in g/cm³.
Conversion is invalid (row marked invalid) when ρ is missing or ρ ≤ 0.

### 5.4 Row Validation

| Condition | Row status | Display |
|-----------|-----------|---------|
| Valid positive number (with or without suffix) | ✅ Valid | Energy column populated |
| Empty row | ⏭️ Skipped | Row kept for input |
| Non-numeric text | ❌ Invalid | Row highlighted: "Enter a numeric value" |
| Unrecognized suffix (e.g., `1.5 furlongs`) | ❌ Invalid | Row highlighted: "Unrecognized unit 'furlongs'" |
| Negative or zero | ❌ Invalid | Row highlighted: "Range must be positive" |
| Value exceeds tabulated CSDA maximum | ⚠️ Out of range | Row highlighted with valid range hint |
| Density unavailable (ρ = 0 or missing) | ❌ Invalid | Row highlighted: "Density not available for this material" |

### 5.5 Wireframe (Advanced mode)

```
  ┌─────────────────────┬──────────┬──────┬─────────────────┐
  │ CSDA Range          │ → g/cm²  │ Unit │ → Energy (auto) │
  ├─────────────────────┼──────────┼──────┼─────────────────┤
  │ 7.718 cm            │ 0.7718   │ cm   │ 100.0 MeV       │
  │ 45 µm               │ 4.500e-6 │ µm   │ 1.234 keV       │
  │ 1.5 mm              │ 0.01500  │ mm   │ 12.34 MeV       │
  │ 0.2                 │ 0.02000  │ cm   │ 14.81 MeV       │
  │ ░░░░░               │          │      │                 │
  └─────────────────────┴──────────┴──────┴─────────────────┘
  Valid range: 0.001–10000 MeV/nucl (ICRU 90, Proton)  [Export CSV ↓]
```

Row 4 (`0.2` with no suffix) uses the master unit (cm).

---

## 6. Energy Output Auto-Scaling

Both inverse tabs output energies in the user's selected master energy
unit (MeV / MeV/nucl / MeV/u). The displayed value is then **auto-scaled**
to the most human-readable SI prefix, using the same 1–9999 display-number
rule as CSDA range length auto-scaling
([`unit-handling.md`](unit-handling.md) §6).

### Prefix Ladder (applied after unit conversion)

Thresholds are applied to the numeric value **after** conversion from
MeV/nucl (WASM output) to the active display unit (MeV, MeV/nucl, or
MeV/u). Since all three units are in the MeV magnitude family, the same
cutoffs apply regardless of which unit is selected.

| Value range (in active display unit) | Display prefix | Example |
|--------------------------------------|---------------|---------|
| ≥ 1000 | GeV | 1.200 GeV/nucl |
| ≥ 1 | MeV | 100.0 MeV |
| ≥ 0.001 | keV | 1.000 keV |
| < 0.001 | eV | 500.0 eV/nucl |

The rule: choose the prefix such that the displayed numeric value falls
in the range **1.000 – 9999**.

### Interaction With Energy Unit Selector

The master energy unit selector (MeV / MeV/nucl / MeV/u) determines
**which physical quantity** is displayed. Auto-scaling then determines
**which SI prefix** is used. For example, if the master unit is MeV/nucl
and the raw result is 0.0005 MeV/nucl, the display is `500 eV/nucl`.

When the master unit is MeV (proton or electron), the per-nucleon
distinction does not apply and only eV / keV / MeV / GeV are used.

### Column Header Label

Because different rows may auto-scale to different prefixes, the column
header does not hard-code a unit. Instead:
- If **all valid rows** in the column auto-scale to the same prefix, the
  header shows that unit: e.g., `→ Energy (MeV)`.
- If rows use **mixed prefixes**, the header shows `→ Energy (auto)` and
  each cell includes its unit inline (e.g., `100.0 MeV`, `500 eV`).

### Number Formatting

- 4 significant figures.
- Scientific notation is **not used** — auto-scaling replaces it.
- No thousands/grouping separators.

---

## 7. Shared Table Behaviour

Both inverse tabs use the same table interaction model as the Forward tab:

| Behaviour | Detail |
|-----------|--------|
| Always-empty-bottom-row | One empty row always appears at the bottom; typing in it creates a new empty row below. |
| Row deletion | Clearing a row's typed value removes the row after a short delay (or on blur), unless it is the only or last empty row. |
| Paste from clipboard | Pasting multi-line text (e.g., a column from Excel) into any input cell creates one row per line. |
| Tab / Enter | Moves focus to the next row's input cell; at the last row, focuses the empty bottom row. |
| Debounce | Calculation fires 300ms after the last input event (same as Forward tab). |
| Pre-filled row | On first switch to an inverse tab, a single representative row is pre-filled: `45.76` keV/µm for Inverse STP, `7.718 cm` for Inverse CSDA (matching the Forward tab's default 100 MeV proton/water result). |
| Entity selection incomplete | Message above the table: "Select a particle and material to calculate." No WASM calls are made. |

### Recalculation Triggers

The result columns recalculate when **any** of these change:

| Trigger | Debounced? |
|---------|-----------|
| Row input (typed value) | Yes (300ms) |
| Input unit change (master or per-row) | No (immediate) |
| Particle change | No (immediate) |
| Material change | No (immediate) — may also change default STP input unit |
| Program change | No (immediate) |
| Advanced Options change | No (immediate) |

---

## 8. Export

Each inverse tab has its own **"Export CSV"** button, appearing below the
table when results are present. The format follows the same conventions as
the Forward tab export (UTF-8 with BOM, comma delimiter, 4 significant
figures).

**Inverse STP columns:**
`Typed Value`, `Unit`, `E low ({unit})`, `E high ({unit})`

**Inverse CSDA columns:**
`Typed Value`, `→ g/cm²`, `Unit`, `→ Energy ({unit})`

`{unit}` in the headers is the auto-scaled unit applied to the first
valid row (or `auto` if rows use mixed prefixes).

**Filenames:**
- `dedx_inverse_stp_{particle}_{material}_{program}.csv`
- `dedx_inverse_csda_{particle}_{material}_{program}.csv`

---

## 9. URL State Encoding

Inverse lookup state is encoded in the Calculator URL as an extension of
the existing forward-lookup parameters. The shared parameters (`particle`,
`material`, `program`, `energies`, `eunit`) continue to encode the Forward
tab state. When an inverse tab is active, additional parameters are added.

| Parameter | Values | Notes |
|-----------|--------|-------|
| `imode` | `stp` or `csda` | Indicates which inverse tab is active. Absent → Forward tab active. |
| `ivalues` | Comma-separated values | Input values for the active inverse tab. Per-value unit suffix uses the same colon syntax as `energies`: e.g., `7.718:cm,45:µm,0.2`. |
| `iunit` | e.g., `keV/µm` | Master input unit for the active inverse tab. Used for `ivalues` entries without a per-value suffix. |

### Examples

```
# Inverse STP, two values, master unit keV/µm:
?particle=1&material=276&imode=stp&ivalues=45.76,10.00&iunit=keV%2F%C2%B5m

# Inverse CSDA, mixed units:
?particle=1&material=276&imode=csda&ivalues=7.718:cm,45:µm,1.5:mm&iunit=cm
```

### Load Behaviour

On page load with `imode` present:
1. If Advanced mode is **off**, `imode` is ignored and the Forward tab
   loads normally. (Inverse tabs are hidden in Basic mode.)
2. If Advanced mode is **on**, the indicated inverse tab is activated.
3. `ivalues` is expanded into table rows; per-value unit suffixes activate
   per-row mode.
4. Inline suffix detection does **not** fire on URL-populated input (units
   are already explicit in the URL encoding).
5. If any parameter is invalid, it is ignored and the tab loads with its
   default pre-filled row.

> Full URL encoding rules and percent-encoding requirements are in
> [`shareable-urls.md`](shareable-urls.md). Inverse-lookup params form
> **step 8** of the canonical ordering defined in
> [`shareable-urls.md` §7.3](shareable-urls.md#73-canonical-url-form),
> after the Advanced Options params (step 7): `imode`, then `ivalues`,
> then `iunit`. Each is omitted when absent (i.e., when the Forward tab
> is active). Silently dropped in Basic mode.

---

## 10. Error Handling

### WASM / Library Errors

Errors from `getInverseStp()` or `getInverseCsda()` (C-level
`LibdedxError`) are handled per-row where possible:

- **No-solution error** (STP above Bragg peak): show `—` in the affected
  energy cell(s). Not highlighted — this is a physically valid outcome.
- **Out-of-range error** (value outside the tabulated energy bounds):
  highlight the row with a valid-range hint below the table.
- **Unexpected C error**: show an error message below the table with a
  "Show details" toggle revealing the error code (same pattern as the
  Forward tab, per [project vision §9](../01-project-vision.md#9-error-philosophy)).

### Density Unavailable

If `LibdedxService.getDensity(materialId)` returns `null`, `0`, or a
negative value, any row that requires a density-dependent unit conversion
(Inverse STP: keV/µm → MeV·cm²/g; Inverse CSDA: cm → g/cm²) is
marked invalid: "Density not available for this material."

---

## Dependencies

- **[`LibdedxService.getInverseStp()`](../06-wasm-api-contract.md#3-service-interface)** — requires stateful workspace API.
  Called twice per batch (once with `side = 0`, once with `side = 1`).
  Returns [`InverseStpResult`](../06-wasm-api-contract.md#23-calculation-results) with energies in MeV/nucl.
- **[`LibdedxService.getInverseCsda()`](../06-wasm-api-contract.md#3-service-interface)** — requires stateful workspace API.
  Returns [`InverseCsdaResult`](../06-wasm-api-contract.md#23-calculation-results) with energies in MeV/nucl.
- **[`LibdedxService.getDensity(materialId)`](../06-wasm-api-contract.md#3-service-interface)** — for STP unit
  conversion (keV/µm ↔ MeV·cm²/g) and CSDA unit conversion (cm → g/cm²).
  See [`unit-handling.md`](unit-handling.md) §§5.2, 5.4.
- **[`LibdedxService.convertEnergy()`](../06-wasm-api-contract.md#3-service-interface)** — for output energy unit
  conversion (MeV/nucl → MeV / MeV/nucl / MeV/u per master selector).
  See [`unit-handling.md`](unit-handling.md) §4.
- **[`MaterialEntity.isGasByDefault`](../06-wasm-api-contract.md#22-entities)** — determines default STP input unit
  (keV/µm for non-gas, MeV·cm²/g for gas). See [`unit-handling.md`](unit-handling.md) §5.1.
- **[`AdvancedOptions`](../06-wasm-api-contract.md#26-advanced-options)** type — passed unchanged to both inverse calls.
  See [`advanced-options.md`](advanced-options.md).
- **`EntitySelectionState`** — shared with the Forward tab.
  See [`calculator.md`](calculator.md) §1.

---

## Acceptance Criteria

### Feature Gate

- [ ] In Basic mode, the Inverse STP and Inverse CSDA tabs are **not visible**. The tab bar shows only "Forward".
- [ ] Enabling Advanced mode makes both inverse tabs appear in the tab bar immediately.
- [ ] Disabling Advanced mode while an inverse tab is active switches the view to the Forward tab.
- [ ] URL parameter `imode` is ignored (tabs not activated) when Advanced mode is off on load.

### Tab Switching

- [ ] Switching tabs preserves the entity selection (Particle, Material, Program).
- [ ] Switching tabs preserves the master energy unit selector state.
- [ ] Each tab maintains its own input rows independently (switching Forward → Inverse STP → Forward does not clear the Forward rows).

### Inverse STP — Input

- [ ] Default input unit is keV/µm for non-gas materials and MeV·cm²/g for gas materials.
- [ ] Changing material from non-gas to gas resets the input unit to MeV·cm²/g; typed values are reinterpreted (not cleared).
- [ ] Input unit dropdown offers: keV/µm, MeV/cm, MeV·cm²/g.
- [ ] Values are converted to MeV·cm²/g before calling `getInverseStp()`.

### Inverse STP — Results

- [ ] Two energy columns are shown: E low (low-energy branch) and E high (high-energy branch).
- [ ] `getInverseStp()` is called twice per batch: once with `side = 0` and once with `side = 1`.
- [ ] When `side = 0` returns an error (no low-energy solution), E low shows `—`.
- [ ] When `side = 1` returns an error (no high-energy solution), E high shows `—`.
- [ ] A stopping power value above the Bragg peak maximum shows `—` in both columns with no row highlight.
- [ ] Negative or zero input is rejected with an inline validation message.

### Inverse CSDA — Input

- [ ] Inline suffix detection parses nm, µm (and um), mm, cm, m (case-insensitive) per-row after 300ms debounce.
- [ ] A plain number without suffix uses the master unit (default: cm).
- [ ] Mixed suffixes across rows activate per-row mode; the master selector is greyed out.
- [ ] Removing all suffixes reverts to master mode.
- [ ] An unrecognized suffix (e.g., `1.5 furlongs`) marks the row invalid: "Unrecognized unit 'furlongs'".
- [ ] Each row's value is converted to g/cm² via `range_gcm2 = range_cm / ρ` before calling `getInverseCsda()`.
- [ ] If ρ is missing or ≤ 0, the row is marked invalid: "Density not available for this material."

### Inverse CSDA — Results

- [ ] A single energy column is shown (no branch selection — CSDA range is monotonic).
- [ ] Negative or zero input is rejected with a validation message.

### Energy Output Auto-Scaling (both tabs)

- [ ] Output energy is displayed in the master energy unit (MeV / MeV/nucl / MeV/u) with SI prefix auto-scaling.
- [ ] Prefix thresholds: ≥ 1000 MeV → GeV; ≥ 1 MeV → MeV; ≥ 0.001 MeV → keV; < 0.001 MeV → eV.
- [ ] Displayed numbers fall in the range 1.000–9999 (4 significant figures, no scientific notation).
- [ ] Column header shows the common unit if all rows use the same prefix, or `(auto)` if rows mix prefixes.
- [ ] Numeric fixture: 0.001 MeV/nucl → `1.000 keV`; 1200 MeV/nucl → `1.200 GeV`.

### URL State

- [ ] `imode=stp` activates the Inverse STP tab on load (Advanced mode must be on).
- [ ] `imode=csda` activates the Inverse CSDA tab on load (Advanced mode must be on).
- [ ] `ivalues` entries without a per-value suffix use the `iunit` master unit.
- [ ] `ivalues` entries with a colon suffix (e.g., `7.718:cm`) apply that unit per-row.
- [ ] URL is updated when the active tab, input values, or input unit changes.
- [ ] Inline suffix detection does not fire on URL-populated rows.

### Advanced Options

- [ ] When Advanced Options are set, the same `AdvancedOptions` object is passed to `getInverseStp()` and `getInverseCsda()`.
- [ ] `densityOverride` (when set) is used for both input unit conversion and the WASM call config.
- [ ] `mstarMode` is only applied when the selected program is MSTAR.

### Shared Table Behaviour

- [ ] Always-empty-bottom-row is present; typing creates a new empty row below.
- [ ] Multi-line paste into any input cell creates one row per pasted line.
- [ ] Tab / Enter moves focus to the next row; at the last row, focuses the empty bottom row.
- [ ] Calculation debounces 300ms after the last input event.
- [ ] On first switch to Inverse STP tab: pre-filled with `45.76` keV/µm.
- [ ] On first switch to Inverse CSDA tab: pre-filled with `7.718 cm`.

### Export

- [ ] "Export CSV" button appears below the table when at least one valid result is present.
- [ ] Inverse STP CSV columns: `Typed Value`, `Unit`, `E low ({unit})`, `E high ({unit})`.
- [ ] Inverse CSDA CSV columns: `Typed Value`, `→ g/cm²`, `Unit`, `→ Energy ({unit})`.
- [ ] Filenames follow the `dedx_inverse_{stp|csda}_{particle}_{material}_{program}.csv` pattern.

---

## Open Questions

1. **AdvancedOptions pass-through to inverse WASM calls:** The
   [`getInverseStp()`](../06-wasm-api-contract.md#3-service-interface) and
   [`getInverseCsda()`](../06-wasm-api-contract.md#3-service-interface)
   signatures in [`06-wasm-api-contract.md` §3](../06-wasm-api-contract.md#3-service-interface)
   do not include an `options?` parameter (unlike `calculate()`). The C
   stateful API applies config settings before evaluation, so the options
   must be set on the workspace before calling the inverse function.
   Confirm that the service implementation handles this correctly, or
   update the service interface to accept `options?` explicitly.

2. **Bragg peak maximum query:** The UI should ideally warn when an STP
   input value is above the Bragg peak. The C library returns an error
   rather than exposing the peak value directly. Consider adding a
   `getBraggPeakStp()` helper (or deriving it from the tabulated data) so
   the valid STP input range can be shown below the table, analogous to
   the energy range display on the Forward tab.
