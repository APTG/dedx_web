# Feature: Advanced Options Panel

> **Status:** Draft v2 (10 April 2026)
>
> **v1** (10 April 2026): Initial draft — aggregate state override,
> interpolation mode, MSTAR mode, density override, I-value override.
> Accordion placement, visibility gating, per-field validation,
> reactivity rules, unit-coupling effects, URL encoding, and persistence.
>
> **v2** (10 April 2026): Reorganized inputs with density first (primary
> use case). Aggregate state redesigned: removed "Default" option, now a
> two-option Gas/Condensed toggle with a read-only "Built-in: …" label
> above. Density: added scientific notation input support, auto-formatted
> placeholder (sci notation below 0.01), gas-specific tooltip, and removed
> lower bound (ρ > 0 only). Density override value surfaced in accordion
> header for visual prominence. Added `plot.md` to related specs. Updated
> wireframes, validation tables, AC, and localStorage schema accordingly.
>
> This spec closes the open loops deferred from:
> - [`unit-handling.md`](unit-handling.md) §8 Q3 (aggregate state → display unit)
> - [`external-data.md`](external-data.md) §8.2 and §13 Q2 (interpolation coupling)
> - [`calculator.md`](calculator.md) §4 (Advanced Options future section)
>
> **Related specs:**
> - WASM API contract (`AdvancedOptions` interface): [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md) §2.6
> - Unit handling (density formulas, default unit rules): [`unit-handling.md`](unit-handling.md) §5
> - App-wide Basic/Advanced toggle: [`multi-program.md`](multi-program.md) §2
> - External data interpolation coupling: [`external-data.md`](external-data.md) §8.2
> - URL canonical ordering: [`shareable-urls.md`](shareable-urls.md) §7.3
> - Formal URL grammar (to be updated as follow-on): [`shareable-urls-formal.md`](shareable-urls-formal.md)
> - Plot page (Advanced Options panel placement): [`plot.md`](plot.md)

---

## User Stories

**As a** researcher with a non-standard material sample whose density
differs from the library's built-in value (e.g., a compressed gas or a
custom alloy),
**I want to** enter my measured density and have it applied consistently
to both the WASM stopping-power calculation and the keV/µm display
conversion,
**so that** the linear stopping power I read off the page corresponds to
the actual sample I am working with.

**As a** nuclear physicist working with gaseous targets at a specific
pressure or temperature,
**I want to** force a gas material into condensed state (or vice versa)
and see the stopping power recalculate accordingly,
**so that** I can compare gas-phase and condensed-phase I-values without
switching to a different material entry.

**As a** researcher validating libdedx against tabulated data,
**I want to** switch from the default log-log interpolation to linear
interpolation and see all curves update simultaneously,
**so that** I can reproduce published results that were calculated with
linear interpolation.

**As a** user of the MSTAR program,
**I want to** select from MSTAR's calculation modes (A–H),
**so that** I can reproduce specific results from H. Paul's MSTAR tables.

---

## Panel Overview

The Advanced Options panel is an **accordion** (collapsible section) that
appears on **every page** hosting calculations: Calculator, Plot, and any
future calculation pages. It is positioned below the entity selection row
and above the primary content area (energy table on Calculator, series
controls on Plot — see [`plot.md`](plot.md)).

The accordion is **only visible when the app-wide Advanced mode toggle is
active** (see [`multi-program.md`](multi-program.md) §2). In Basic mode
the accordion is entirely absent from the DOM — it does not render as
collapsed, it is not rendered at all.

| Property | Detail |
|----------|--------|
| Visibility | Advanced mode only (gated by app-wide toggle) |
| Default state | Collapsed |
| Persistence | Open/collapsed state stored in `localStorage` (key: `advancedOptions.open`) |
| Position | Below entity selection row, above primary content |
| Header label | "Advanced Options" |
| Active-override indicator | See [Output § Active-Override Indicator](#active-override-indicator) |

The inputs are ordered by importance: material property overrides (density,
I-value, aggregate state) come first, then calculation-method overrides
(interpolation, MSTAR mode).

---

## Inputs

### 1. Density Override

Controls the `densityOverride` field of `AdvancedOptions`. This is the
**primary use case** of the Advanced Options panel. When set, the
overridden density replaces `LibdedxService.getDensity(materialId)` for
**both** the WASM calculation and display-unit conversion (keV/µm and
range-to-cm formulas).

| Property | Detail |
|----------|--------|
| Type | Numeric text input |
| Unit label | "g/cm³" (right of input) |
| Placeholder | Built-in density from `getDensity(materialId)`. Auto-formatted: values ≥ 0.01 shown as decimal (e.g. `1.205`); values < 0.01 shown in scientific notation (e.g. `8.99e-5`). Updated when material changes. If `getDensity` returns `undefined`, shows "—". |
| Input format | Accepts both decimal (`0.00009`) and scientific notation (`9e-5`). Value is kept exactly as typed. |
| Label tooltip | For gas materials (`isGasByDefault = true`), the "Density" label shows an info icon ⓘ with tooltip: "For gas materials, density depends on pressure and temperature. The built-in value is at standard conditions." |
| Validation | `ρ > 0`. Any positive number is accepted; no upper bound enforced. See [Behavior §5](#5-input-validation). |
| Debounce | 300 ms before recalculation is triggered |
| Clear action | Clearing the field removes the override and reverts to built-in density |
| Reset on material switch | Field is cleared; override removed |

**Effect on display units:** When a density override is active:
- The keV/µm conversion uses: `S_kevum = S_mass × ρ_override / 10`
- The range-to-cm conversion uses: `range_cm = range_gcm2 / ρ_override`

This ensures internal consistency between the WASM-computed stopping power
and the displayed linear unit values. See [Behavior §4](#4-density-override--unit-conversion-scope).

**Gas density context:** Gas materials have very small densities — for
example, hydrogen gas ≈ 8.99×10⁻⁵ g/cm³, air ≈ 1.205×10⁻³ g/cm³. The
field handles such values via scientific notation input and auto-formatted
placeholder. The ⓘ tooltip only appears for gas materials to avoid
cluttering the UI for solids and liquids.

**URL encoding:** `density=1.205` or `density=0.0000899` (JavaScript
default number serialization). Omitted when not set.

---

### 2. I-Value Override

Controls the `iValueOverride` field of `AdvancedOptions`. When set,
replaces the built-in mean excitation potential from
`LibdedxService.getIValue(materialId)` in the WASM calculation.

| Property | Detail |
|----------|--------|
| Type | Numeric text input |
| Unit label | "eV" (right of input) |
| Placeholder | Built-in I-value from `getIValue(materialId)`, formatted to 4 significant figures (e.g. `75.00`). Updated when material changes. |
| Validation | `0 < I ≤ 10 000 eV`. See [Behavior §5](#5-input-validation). |
| Debounce | 300 ms before recalculation is triggered |
| Clear action | Clearing the field removes the override and reverts to built-in I-value |
| Reset on material switch | Field is cleared; override removed |

**Note:** The I-value override is passed only to WASM. It does not affect
unit conversion (the keV/µm formula does not depend on I-value).

**URL encoding:** `ival=75.0` (numeric, eV). Omitted when not set.

---

### 3. Aggregate State Override

Controls the `aggregateState` field of `AdvancedOptions`. This overrides
the target material's built-in phase for the WASM calculation.

The control is a **two-option toggle** (Gas / Condensed). There is no
"Default" option. Instead, a read-only label above the toggle always
shows the material's built-in phase, so the user can see at a glance
what is the library default and whether they have overridden it.

| Property | Detail |
|----------|--------|
| Type | Two-option segmented toggle |
| Options | **Gas**, **Condensed** |
| Built-in label | Read-only line above the toggle: "Built-in: Gas" or "Built-in: Condensed". Updates when material changes. |
| Initial selection | The option matching the material's built-in phase (`isGasByDefault`) is pre-selected. |
| Override active | When the selected option **differs** from the built-in phase. |
| No override | When the selected option **matches** the built-in phase (equivalent to `aggregateState = "default"`). |

**Semantics:** Selecting the built-in option is semantically equivalent to
"Default" — the `aggregateState` field in `AdvancedOptions` is set to
`"default"` (or omitted), and no override is applied. Selecting the
non-built-in option sets `aggregateState` to `"gas"` or `"condensed"`.

**Example layout (gas material):**

```
Aggregate state:
  Built-in: Gas
  [ Gas ]  [ Condensed ]
  ^selected (no override)
```

**Example layout (condensed material, override active):**

```
Aggregate state:
  Built-in: Condensed
  [ Gas ]  [ Condensed ]
  ^selected (override: gas)
```

**Unit coupling:** Changing the effective phase updates the default
stopping-power display unit. See [Behavior §3](#3-aggregate-state--display-unit-coupling).

| Effective phase | Default display unit |
|-----------------|---------------------|
| Gas | MeV·cm²/g |
| Condensed | keV/µm |

**URL encoding:** `agg_state=gas` or `agg_state=condensed`. Omitted when
the selected option matches the built-in (no override).

---

### 4. Interpolation Mode

Controls the `interpolation` field of `AdvancedOptions`. This is a
**session-level** setting — it applies uniformly to all data sources:
both WASM calculations and JS-side external-data interpolation. See
[`external-data.md`](external-data.md) §8.2.

| Property | Detail |
|----------|--------|
| Type | Segmented control with 2 options |
| Options | **Log-log** (default), **Linear** |
| Default | **Log-log** |
| Scope | Global — applies to all programs, all series, and external data simultaneously |

**Retroactive on Plot:** Changing interpolation mode on the Plot page
**redraws all existing committed series**. This is the only Advanced
Option that is retroactive; all others are forward-only on the Plot page
(see [Behavior §2](#2-reactivity--recalculation-triggers)).

**In-panel note:** A subtle note below the control reads: "Applies to all
data sources. Mixing interpolation methods across series is not supported."

**URL encoding:** `interp=linear`. Omitted when value is "log-log".

---

### 5. MSTAR Mode

Controls the `mstarMode` field of `AdvancedOptions`. Specific to the
MSTAR program (`programId = DEDX_MSTAR`).

| Property | Detail |
|----------|--------|
| Type | Segmented control with 6 options |
| Options | **A**, **B** (recommended), **C**, **D**, **G**, **H** |
| Default | **B** |
| Non-MSTAR program | Visible but disabled; tooltip: "Only applies to MSTAR" |
| MSTAR active | Enabled |
| Reset on program switch | Resets to **B** when switching away from MSTAR |

**Multi-program mode:** When MSTAR is among multiple active programs,
the control is enabled and applies to MSTAR's calculation only.

**URL encoding:** `mstar_mode=a` (lowercase). Omitted when value is "b".

---

### 6. Reset to Defaults Button

A **"Reset"** button at the bottom of the accordion clears all overrides
simultaneously:

| Option | Reset value |
|--------|-------------|
| Density override | Cleared (empty field) |
| I-value override | Cleared (empty field) |
| Aggregate state | Built-in option re-selected (no override) |
| Interpolation mode | Log-log |
| MSTAR mode | B |

The reset triggers an immediate recalculation. The button is **disabled**
when no overrides are active (all options already at defaults).

---

## Behavior

### 1. Panel Placement per Page

#### Calculator page

The accordion is positioned below the entity selection row and above the
unified input/result table. Density appears first inside the accordion.
When density is overridden, its value is surfaced in the header even when
collapsed (see [Output § Active-Override Indicator](#active-override-indicator)):

```
[ Particle ▾ ]  [ Material ▾ ]  [ Program ▾ ]   (•) MeV

▼ Advanced Options  ρ = 1.1 g/cm³        ← density shown in header
─────────────────────────────────────────────────────────────────
  Density:   [ 1.1_____ ] g/cm³  ⓘ       ← ⓘ only for gas materials
  I-value:   [ ________ ] eV             ← placeholder: 75.00

  ── ── ── ── ── ── ── ── ── ── ── ── ──
  Aggregate state:
    Built-in: Condensed
    [ Gas ]  [ Condensed ]               ← Condensed selected (no override)

  ── ── ── ── ── ── ── ── ── ── ── ── ──
  Interpolation:  [ Log-log ] [ Linear ]
  MSTAR mode:     [ A ] [●B] [ C ] [ D ] [ G ] [ H ]  (disabled)
                                                 [ Reset ]
─────────────────────────────────────────────────────────────────
┌────────────────────────────────────────────────────────────────┐
│ Energy (MeV) │ → MeV/nucl │ Unit │ Stp Power (keV/µm) │ CSDA  │
│ ...                                                           │
└────────────────────────────────────────────────────────────────┘
```

#### Calculator page — gas material with density override

When a gas material is selected, the ⓘ tooltip is active and the
placeholder shows auto-formatted scientific notation:

```
▼ Advanced Options  ρ = 9e-5 g/cm³
─────────────────────────────────────────────────────────────────
  Density:   [ 9e-5____ ] g/cm³  ⓘ       ← typed by user; placeholder was 8.99e-5
  I-value:   [ ________ ] eV

  Aggregate state:
    Built-in: Gas
    [●Gas ]  [ Condensed ]               ← Gas selected (no override)
─────────────────────────────────────────────────────────────────
```

#### Plot page

The accordion appears in the left control panel, below the entity
selection area and above the "Add Series" button (see [`plot.md`](plot.md)):

```
┌──────────────────────────────────────────┐
│  Particle: [ Proton (H) ▾ ]              │
│  Material: [ Air (gas) ▾ ]  💨 gas       │
│  Program:  [ Auto-select ▾ ]             │
│                                          │
│  ▼ Advanced Options  ρ = 1.1e-3 g/cm³   │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│  Density:  [ 1.1e-3__ ] g/cm³  ⓘ        │
│  I-value:  [ ________ ] eV              │
│                                          │
│  Aggregate state:                        │
│    Built-in: Gas                         │
│    [●Gas ]  [ Condensed ]               │
│                                          │
│  Interpolation: [ Log-log ] [ Linear ]   │
│  MSTAR mode: [ A ][●B][ C ][ D ][ G ][ H ]  (disabled) │
│                              [ Reset ]   │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│  [ + Add Series ]                        │
│                                          │
│  Series:                                 │
│  ● Proton / Air / ICRU 90  ⚙            │
└──────────────────────────────────────────┘
```

---

### 2. Reactivity — Recalculation Triggers

| Option changed | Calculator | Plot |
|----------------|-----------|------|
| Density override | Recalculation after 300 ms debounce (valid input only) | Applies to next series added; committed series unchanged |
| I-value override | Recalculation after 300 ms debounce (valid input only) | Applies to next series added; committed series unchanged |
| Aggregate state | Immediate recalculation | Applies to next series added; committed series unchanged |
| Interpolation mode | Immediate recalculation | **Retroactive** — all committed series and preview curve are redrawn |
| MSTAR mode | Immediate recalculation (if MSTAR active) | Applies to next series added; committed series unchanged |
| Reset | Immediate recalculation | Interpolation change redraws all series; other resets apply only to next series |

**Plot series immutability (non-interpolation options):** When a series is
committed to the Plot, the density, I-value, aggregate state, and MSTAR
mode that were active at commit time are frozen in the series metadata.
Changing these options afterwards does not modify committed series.

**Interpolation mode exception:** Interpolation is the single retroactive
option. Scientific validity requires consistent interpolation across all
data sources — see [`external-data.md`](external-data.md) §8.2.

---

### 3. Aggregate State → Display Unit Coupling

When the aggregate state changes (either via toggle or material switch),
the default stopping-power display unit is updated using the **effective**
phase after applying the override:

| Effective phase | Default display unit |
|-----------------|---------------------|
| Gas | MeV·cm²/g |
| Condensed | keV/µm |

This closes the open question from [`unit-handling.md`](unit-handling.md) §8 Q3.

**Mapping:**

| Built-in phase | Toggle selection | Override active? | Display unit |
|----------------|-----------------|-----------------|--------------|
| Gas | Gas (= built-in) | No | MeV·cm²/g |
| Gas | Condensed | Yes | keV/µm |
| Condensed | Condensed (= built-in) | No | keV/µm |
| Condensed | Gas | Yes | MeV·cm²/g |

**Reverting to built-in:** Selecting the toggle option that matches the
built-in phase deactivates the override and reverts the display unit to
the material's natural default.

**User notification:** The stopping-power column header updates
immediately when the effective phase changes. No additional toast is shown.

---

### 4. Density Override → Unit Conversion Scope

When `densityOverride` is set and valid:

1. It is passed to `LibdedxService.calculate()` (or `getPlotData()`) as
   `options.densityOverride`.
2. It **replaces** `LibdedxService.getDensity(materialId)` in all
   display-unit conversion formulas:
   - Stopping power: `S_kevum = S_mass × ρ_override / 10`
   - CSDA range: `range_cm = range_gcm2 / ρ_override`

When cleared, the app reverts to the built-in density from
`getDensity(materialId)` for both WASM and display conversion.

If `getDensity(materialId)` returns `undefined` and no override is set:
- Stopping power falls back to MeV·cm²/g (mass unit; no density needed).
- CSDA range falls back to g/cm² (cannot convert to length without density).
  See [`unit-handling.md`](unit-handling.md) §5.2.

---

### 5. Input Validation

#### Density override

| Condition | State | Inline message |
|-----------|-------|----------------|
| Empty field | No override (valid) | — |
| Positive number (any size) | Valid override | — |
| `0` | Invalid | "Density must be greater than 0" |
| Negative number | Invalid | "Density must be greater than 0" |
| Non-numeric text (e.g., `abc`) | Invalid | "Enter a numeric value" |

Scientific notation (`9e-5`, `1.2E-3`) is valid and treated as a
positive number for validation purposes.

#### I-value override

| Condition | State | Inline message |
|-----------|-------|----------------|
| Empty field | No override (valid) | — |
| Positive number, `I ≤ 10 000 eV` | Valid override | — |
| `0` or negative | Invalid | "I-value must be greater than 0" |
| Number > 10 000 eV | Invalid | "I-value exceeds 10 000 eV (physical maximum)" |
| Non-numeric text | Invalid | "Enter a numeric value" |

**While invalid:** Red outline on the field. No recalculation triggered.
The last valid state (or no override if field was previously empty)
remains active. The "Reset" button is unaffected.

---

### 6. Material Switch — Override Clearing

When the user selects a different material:

- **Density override** — field cleared; override removed.
- **I-value override** — field cleared; override removed.
- **Aggregate state** — toggle resets to the new material's built-in
  phase (override deactivated).
- **Interpolation mode** — not cleared (material-independent).
- **MSTAR mode** — not cleared (material-independent; resets separately
  when program changes away from MSTAR).
- Placeholder text for density and I-value updates to the new material's
  built-in values.
- Recalculation triggers with the new entity selection and cleared overrides.

**Rationale:** Density and I-value are material-specific. Carrying a
water-derived density to an aluminium calculation would silently produce
wrong results.

---

### 7. MSTAR Mode — Program Dependency

| Active program(s) | MSTAR mode state |
|-------------------|-----------------|
| MSTAR only | Enabled |
| MSTAR + others (multi-program) | Enabled; applies to MSTAR only |
| Non-MSTAR only | Disabled; tooltip: "Only applies to MSTAR" |

**On switch away from MSTAR:** Resets to B; becomes disabled.

**On switch to MSTAR:** Becomes enabled; initial selection is B.

---

### 8. Persistence

| Mechanism | Scope |
|-----------|-------|
| URL query parameters | Non-default values only; present in Advanced mode URLs. See [URL State Encoding](#url-state-encoding). |
| `localStorage` | All five option values + accordion open/collapsed state. |

**localStorage keys:**

| Key | Type | Default |
|-----|------|---------|
| `advancedOptions.aggregateState` | `"default"` \| `"gas"` \| `"condensed"` | `"default"` |
| `advancedOptions.interpolation` | `"log-log"` \| `"linear"` | `"log-log"` |
| `advancedOptions.mstarMode` | `"a"` \| `"b"` \| `"c"` \| `"d"` \| `"g"` \| `"h"` | `"b"` |
| `advancedOptions.density` | `number` \| `null` | `null` |
| `advancedOptions.ival` | `number` \| `null` | `null` |
| `advancedOptions.open` | `boolean` | `false` |

`advancedOptions.aggregateState` stores `"default"` when the toggle is
on the built-in option (no override), even though the UI has no "Default"
label. `"gas"` and `"condensed"` are only stored when an actual override
is active.

**Priority:** URL parameters take precedence over localStorage on load.
When a URL param is present, it sets the value and updates localStorage.

**Basic mode:** The five Advanced Options params are not written to the
URL when mode=basic. On switching Basic → Advanced, params are re-added
from localStorage. On switching Advanced → Basic, params are stripped
from the URL but kept in localStorage.

**Material switch:** Clears `advancedOptions.density`, `advancedOptions.ival`,
and `advancedOptions.aggregateState` in localStorage. Interpolation and
MSTAR mode keys are not cleared on material switch.

---

## Output

### Effect on Calculations

All five `AdvancedOptions` fields are forwarded to the WASM API when
non-default:

```typescript
LibdedxService.calculate({
  programId, particleId, materialId, energies,
  options: {
    aggregateState,      // omitted when "default" (toggle on built-in option)
    interpolation,       // omitted when "log-log"
    mstarMode,           // omitted when "b" or non-MSTAR program
    densityOverride,     // omitted when not set
    iValueOverride,      // omitted when not set
  }
})
```

### Effect on Unit Display

- **Density override** → replaces built-in density in keV/µm and
  range-to-cm conversions (primary effect). See [Behavior §4](#4-density-override--unit-conversion-scope).
- **Aggregate state override** → effective phase → default stopping-power
  display unit (keV/µm or MeV·cm²/g). See [Behavior §3](#3-aggregate-state--display-unit-coupling).
- **Interpolation, I-value, MSTAR mode** → affect computed values only;
  no effect on unit display.

### Active-Override Indicator

The accordion header communicates active overrides even when collapsed:

| Active overrides | Header display |
|-----------------|----------------|
| None | `Advanced Options` (no badge) |
| Density only | `Advanced Options  ρ = 1.1 g/cm³` |
| Density + others | `Advanced Options  ρ = 1.1 g/cm³  ●` |
| Others only (no density) | `Advanced Options  ●` |

The density value is surfaced in the header because density is the most
commonly adjusted parameter and users benefit from seeing its active
value at a glance without opening the accordion. The `●` dot indicates
any non-density override is active.

All indicators are cleared when all options return to defaults (via Reset
or material switch).

### Series Metadata (Plot page)

When a series is committed to the Plot, the active non-interpolation
options are frozen in the series metadata:

```typescript
interface SeriesAdvancedOptions {
  aggregateState?: AggregateState;  // if override active (differs from built-in)
  densityOverride?: number;         // if set
  iValueOverride?: number;          // if set
  mstarMode?: MstarMode;            // if not "b" and MSTAR active
}
```

This metadata is used to:
1. Display an override indicator icon (⚙) on the series entry in the
   series list.
2. Show a tooltip: "Calculated with: ρ = 1.1 g/cm³, aggregate state =
   condensed" (listing only the active non-default options).
3. Inform future URL encoding extensions (v2 — see Open Questions).

### URL Encoding for Plot Series with Per-Series Options

In v1, the `series` URL parameter format (`program.particle.material`
triplets) does not support per-series option encoding. On URL load, all
series are reconstructed with the current session-level advanced options.
Per-series option variations from a live session are not preserved across
URL share.

> **Future (v2):** Extend the `series` URL parameter to encode per-series
> advanced options (e.g. `program.particle.material~density:1.1~agg:condensed`).
> Requires updating [`shareable-urls-formal.md`](shareable-urls-formal.md) §3 grammar.

---

## URL State Encoding

Advanced Options state is encoded as query parameters appended **after
`qfocus`** in the canonical URL ordering (extending
[`shareable-urls.md`](shareable-urls.md) §7.3).

### New Parameters

| Parameter | Type | Omit when | Example |
|-----------|------|-----------|---------|
| `agg_state` | `gas` \| `condensed` | selected option = built-in (no override) | `agg_state=condensed` |
| `interp` | `linear` | value = "log-log" | `interp=linear` |
| `mstar_mode` | `a`\|`b`\|`c`\|`d`\|`g`\|`h` | value = "b" | `mstar_mode=c` |
| `density` | positive number | not set | `density=0.0000899` |
| `ival` | positive number | not set | `ival=75.0` |

**Number serialization for `density`:** Use JavaScript's default
`Number.prototype.toString()`. Very small values that JS represents in
scientific notation (< 5×10⁻⁷) will appear as e.g. `density=1e-10`;
values in the typical range appear as decimal (e.g. `density=0.0000899`).

**Omit-when-default rule:** All five parameters are omitted when at
default values, keeping the URL minimal.

**Basic mode:** All five parameters are silently dropped when mode=basic.
They survive in `localStorage` and are restored when Advanced mode is re-enabled.

### Canonical URL Examples

Calculator — advanced mode, gas material density override + condensed
aggregate state override:

```
/calculator?urlv=1&particle=1&material=3&programs=9,2&energies=100,200&eunit=MeV&mode=advanced&qfocus=both&agg_state=condensed&density=0.0000899
```

Calculator — advanced mode, linear interpolation only:

```
/calculator?urlv=1&particle=1&material=276&program=auto&energies=100,200&eunit=MeV&mode=advanced&qfocus=both&interp=linear
```

Calculator — advanced mode, density override for condensed material:

```
/calculator?urlv=1&particle=1&material=276&program=auto&energies=100,200&eunit=MeV&mode=advanced&qfocus=both&density=1.100
```

Plot — advanced mode, MSTAR mode C:

```
/plot?urlv=1&particle=1&material=276&program=101&series=101.1.276&stp_unit=kev-um&xscale=log&yscale=log&mode=advanced&qfocus=both&mstar_mode=c
```

### Updated Canonical Ordering

The full canonical parameter order (with all Advanced Options params):

1. `urlv`
2. `extdata` (one per source, if any)
3. `particle`, `material`
4. `program` (basic) or `programs` (advanced)
5. Page-specific: `energies`, `eunit` (Calculator) — or `series`, `stp_unit`, `xscale`, `yscale` (Plot)
6. `mode=advanced`, `hidden_programs` (omit if empty), `qfocus`
7. **Advanced Options (new):** `agg_state`, `interp`, `mstar_mode`, `density`, `ival`
   (each omitted when at default value)

> The formal ABNF grammar in [`shareable-urls-formal.md`](shareable-urls-formal.md)
> must be updated as a follow-on to include these five parameters.

### Round-trip Stability

On page load with Advanced Options URL params:

1. Parse `agg_state`, `interp`, `mstar_mode`, `density`, `ival`.
2. Validate each value. Invalid values are silently ignored; default is used.
3. For `agg_state`: compare against current material's built-in phase. If
   the param value matches built-in, treat as "no override" (default). If
   it differs, apply the override.
4. Apply all options to the Advanced Options panel state.
5. Update localStorage to match.
6. If `mode` param is absent or `mode=basic`, ignore all five params.
7. Recalculate.

---

## Acceptance Criteria

### AC-1: Panel gating

- [ ] When mode=basic (or mode absent), the Advanced Options accordion is
  not rendered on any page.
- [ ] When mode=advanced, the accordion is rendered (collapsed by default)
  on all calculation pages (Calculator, Plot).

### AC-2: Accordion state and header

- [ ] Clicking the accordion header toggles open/collapsed.
- [ ] Open/collapsed state persists via localStorage.
- [ ] When density override is active and accordion is collapsed, the header
  shows `ρ = {value} g/cm³`.
- [ ] When density + other overrides are active, the header shows
  `ρ = {value} g/cm³  ●`.
- [ ] When only non-density overrides are active, the header shows `●`.
- [ ] When no overrides are active, the header shows no badge and no value.

### AC-3: Aggregate state

- [ ] The control shows a read-only "Built-in: Gas" or "Built-in: Condensed"
  label above the two-option toggle, matching `isGasByDefault(materialId)`.
- [ ] The toggle has exactly two options: Gas and Condensed.
- [ ] On initial render (or after material switch), the toggle pre-selects
  the built-in option.
- [ ] Selecting the non-built-in option for a gas material (→ Condensed):
  recalculation uses `aggregateState: "condensed"`; display unit → keV/µm.
- [ ] Selecting the non-built-in option for a condensed material (→ Gas):
  recalculation uses `aggregateState: "gas"`; display unit → MeV·cm²/g.
- [ ] Selecting the built-in option after an override: override is cleared;
  display unit reverts to material's natural default.
- [ ] The "Built-in: …" label updates when the material changes.

### AC-4: Interpolation mode

- [ ] Switching to "Linear" on the Calculator triggers an immediate
  recalculation.
- [ ] Switching to "Linear" on the Plot page redraws all committed series.
- [ ] Switching back to "Log-log" redraws all series again.
- [ ] External data series use the same interpolation mode as WASM series.

### AC-5: MSTAR mode

- [ ] When non-MSTAR program active: control rendered but disabled; tooltip
  "Only applies to MSTAR".
- [ ] When MSTAR active: control enabled.
- [ ] Switching from MSTAR to non-MSTAR: resets to B, becomes disabled.
- [ ] In multi-program mode with MSTAR: control enabled; applies to MSTAR
  only.

### AC-6: Density override

- [ ] Empty field → no override; placeholder shows built-in density.
- [ ] For gas materials, the "Density" label shows a ⓘ icon; hover tooltip
  reads "For gas materials, density depends on pressure and temperature.
  The built-in value is at standard conditions."
- [ ] For non-gas materials, no ⓘ icon is shown.
- [ ] Built-in density ≥ 0.01 g/cm³ → placeholder in decimal (e.g. `1.205`).
- [ ] Built-in density < 0.01 g/cm³ → placeholder in scientific notation
  (e.g. `8.99e-5`).
- [ ] Decimal input (e.g. `0.00009`) accepted and kept as typed.
- [ ] Scientific notation input (e.g. `9e-5`) accepted and kept as typed.
- [ ] Valid density → recalculation uses the overridden ρ in WASM call and
  in keV/µm and range-to-cm conversion formulas.
- [ ] Entry of `0` → inline error "Density must be greater than 0".
- [ ] Entry of `-1` → inline error "Density must be greater than 0".
- [ ] Entry of `abc` → inline error "Enter a numeric value".
- [ ] While invalid: red outline; no recalculation; last valid state held.
- [ ] Clearing the field → override removed; built-in density resumes.
- [ ] Switching material → field cleared; override removed; placeholder
  updates to new material's density.

### AC-7: I-value override

- [ ] Empty field → no override; placeholder shows built-in I-value.
- [ ] Valid I-value (e.g. `78.0`) → recalculation uses `iValueOverride: 78`.
- [ ] Entry of `0` → "I-value must be greater than 0".
- [ ] Entry of `10001` → "I-value exceeds 10 000 eV (physical maximum)".
- [ ] Switching material → field cleared.

### AC-8: Reset button

- [ ] "Reset" is disabled when all options are at defaults.
- [ ] Clicking "Reset" clears all five options simultaneously.
- [ ] After Reset on Plot: interpolation redraws all series; other options
  affect only future series.
- [ ] After Reset: accordion header shows no badge and no density value.

### AC-9: Material switch

- [ ] Switching material clears density override, I-value override, and
  returns aggregate state toggle to built-in option of the new material.
- [ ] Interpolation and MSTAR mode are not affected by material switch.
- [ ] Placeholder text updates to new material's built-in values.

### AC-10: URL encoding

- [ ] `agg_state=condensed` → aggregate state set to Condensed on load.
- [ ] `agg_state=gas` when material built-in is also gas → treated as no
  override (toggle lands on Gas, no active override).
- [ ] `interp=linear` → interpolation set to Linear.
- [ ] `mstar_mode=c` → MSTAR mode set to C.
- [ ] `density=0.0000899` → density override active at 8.99×10⁻⁵ g/cm³.
- [ ] `ival=75.0` → I-value override at 75 eV.
- [ ] All five params omitted when at default values.
- [ ] All five params stripped from URL when mode=basic.
- [ ] Invalid param values (e.g. `density=-1`) silently ignored; default used.
- [ ] Five params appear after `qfocus` in canonical order.

### AC-11: localStorage persistence

- [ ] Setting density=1.2, navigating away and back → density=1.2 restored.
- [ ] After Reset → localStorage cleared; navigation does not restore
  previous overrides.
- [ ] URL params take precedence over localStorage on load.

### AC-12: Plot series metadata

- [ ] Series committed with active density override shows ⚙ icon in series
  list.
- [ ] Series tooltip lists active non-default options (e.g. "Calculated
  with: ρ = 1.1 g/cm³").
- [ ] Changing density after committing a series does not alter the committed
  series' curve.

---

## Open Questions

1. **Plot series URL encoding for per-series options (v2):** When two
   series on the Plot page were committed with different density overrides,
   the current URL scheme cannot capture this distinction. How should the
   `series` parameter be extended to encode per-series options? Deferred
   to v2 — see [Output § URL Encoding for Plot Series](#url-encoding-for-plot-series-with-per-series-options).

2. **`shareable-urls-formal.md` grammar update:** The ABNF grammar must be
   updated to include the five new parameters (`agg_state`, `interp`,
   `mstar_mode`, `density`, `ival`) and their value sets. Deferred as a
   follow-on to this spec.

3. **MSTAR mode descriptions:** The physical meaning of modes A–H is not
   documented here. Implementation should consult the libdedx source and
   H. Paul's MSTAR documentation to determine whether short descriptions
   are available and useful in the UI.
