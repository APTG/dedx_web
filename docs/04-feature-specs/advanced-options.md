# Feature: Advanced Options Panel

> **Status:** Draft v1 (10 April 2026)
>
> **v1** (10 April 2026): Initial draft — aggregate state override,
> interpolation mode, MSTAR mode, density override, I-value override.
> Accordion placement, visibility gating, per-field validation,
> reactivity rules, unit-coupling effects, URL encoding, and persistence.
>
> This spec closes the open loops deferred from:
> - [`unit-handling.md`](unit-handling.md) §8 Q3 (aggregate state → display unit)
> - [`external-data.md`](external-data.md) §8.2 and §13 Q2 (interpolation coupling)
> - [`calculator.md`](calculator.md) §4 (Advanced Options future section)
>
> **Related specs:**
> - WASM API contract (AdvancedOptions interface): [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md) §2.6
> - Unit handling (density formulas, default unit rules): [`unit-handling.md`](unit-handling.md) §5
> - App-wide Basic/Advanced toggle: [`multi-program.md`](multi-program.md) §2
> - External data interpolation coupling: [`external-data.md`](external-data.md) §8.2
> - URL canonical ordering: [`shareable-urls.md`](shareable-urls.md) §7.3
> - Formal URL grammar (to be updated as follow-on): [`shareable-urls-formal.md`](shareable-urls-formal.md)

---

## User Stories

**As a** nuclear physicist working with gaseous targets,
**I want to** force a gas material into condensed state and see the
stopping power recalculate accordingly,
**so that** I can compare gas-phase and condensed-phase I-values without
switching to a different material.

**As a** researcher validating libdedx against tabulated data,
**I want to** switch from the default log-log interpolation to linear
interpolation and see all curves update simultaneously,
**so that** I can reproduce published results that were calculated with
linear interpolation.

**As a** user of the MSTAR program,
**I want to** select from MSTAR's calculation modes (A–H),
**so that** I can reproduce specific results from H. Paul's MSTAR tables.

**As a** researcher with a measured density for a material that differs
from libdedx's built-in value,
**I want to** enter a density override and have it applied consistently
to both the WASM calculation and the keV/µm display conversion,
**so that** the stopping power in linear units reflects the actual
material density I am using.

---

## Panel Overview

The Advanced Options panel is an **accordion** (collapsible section) that
appears on **every page** hosting calculations: Calculator, Plot, and any
future calculation pages. It is positioned below the entity selection row
and above the primary content area (energy table on Calculator, series
controls on Plot).

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
| Active-override indicator | When any option differs from its default, the accordion header shows a subtle badge (e.g., a filled dot "●") to indicate active overrides even when collapsed |

---

## Inputs

### 1. Aggregate State Override

Controls the `aggregateState` field of `AdvancedOptions`. This overrides
the target material's built-in phase (gas or condensed) for the WASM
calculation.

| Property | Detail |
|----------|--------|
| Type | Segmented control / select with 3 options |
| Options | **Default**, **Gas**, **Condensed** |
| Default selection | **Default** |
| Default option tooltip | "This material's built-in state is Gas" or "…is Condensed", reflecting `LibdedxService.isGasByDefault(materialId)`. Updates when the material changes. |

**Built-in state in the tooltip:** The "Default" option always has a
tooltip that reveals the material's built-in aggregate state so the user
can see what they are overriding. The tooltip text is:

- `isGasByDefault = true` → `"Built-in state: Gas"`
- `isGasByDefault = false` → `"Built-in state: Condensed"`

**Unit coupling:** Overriding the aggregate state updates the default
stopping-power display unit (see [Behavior §3](#3-aggregate-state--display-unit-coupling)):

| Built-in phase | Override | Default display unit changes to |
|----------------|----------|---------------------------------|
| Gas | Condensed | keV/µm |
| Condensed | Gas | MeV·cm²/g |
| Gas | Gas | No change (already MeV·cm²/g) |
| Condensed | Condensed | No change (already keV/µm) |
| Any | Default | Reverts to unit driven by built-in phase |

**URL encoding:** `agg_state=gas` or `agg_state=condensed`. Omitted when
value is "Default".

---

### 2. Interpolation Mode

Controls the `interpolation` field of `AdvancedOptions`. This is a
**session-level** setting — it applies uniformly to all data sources:
both WASM calculations and JS-side external-data interpolation. See
[`external-data.md`](external-data.md) §8.2.

| Property | Detail |
|----------|--------|
| Type | Segmented control / select with 2 options |
| Options | **Log-log** (default), **Linear** |
| Default | **Log-log** |
| Scope | Global — applies to all programs, all series, and external data simultaneously |

**Retroactive on Plot:** Because this is a session-level setting, changing
it on the Plot page **redraws all existing committed series** using the
new interpolation mode. This is the only Advanced Option that is
retroactive; all other options are forward-only on the Plot page (see
[Behavior §2](#2-reactivity--recalculation-triggers)).

**Scientific rationale (in-panel note):** A subtle note below the control
reads: "Applies to all data sources. Mixing interpolation methods across
series is not supported."

**URL encoding:** `interp=linear`. Omitted when value is "log-log"
(default).

---

### 3. MSTAR Mode

Controls the `mstarMode` field of `AdvancedOptions`. This option is
specific to the MSTAR program (`programId = DEDX_MSTAR`).

| Property | Detail |
|----------|--------|
| Type | Segmented control / select with 6 options |
| Options | **A**, **B** (recommended), **C**, **D**, **G**, **H** |
| Default | **B** |
| State when non-MSTAR program active | Visible but disabled, with tooltip: "Only applies to MSTAR" |
| State when MSTAR is selected | Enabled |
| Reset on program switch | When the user switches away from MSTAR, the selection resets to **B** |

**Multi-program mode:** When multiple programs are active and MSTAR is
among them, the MSTAR mode control is enabled. It applies to the MSTAR
program's calculation only; non-MSTAR programs ignore it.

**URL encoding:** `mstar_mode=a` (lowercase). Omitted when value is "b"
(default).

---

### 4. Density Override

Controls the `densityOverride` field of `AdvancedOptions`. When set,
replaces the built-in density from `LibdedxService.getDensity(materialId)`
for **both** the WASM calculation and display-unit conversion (keV/µm and
range-to-cm formulas).

| Property | Detail |
|----------|--------|
| Type | Numeric text input |
| Unit label | "g/cm³" (right of input) |
| Placeholder | Built-in density value from `getDensity(materialId)`, formatted to 4 significant figures. E.g., `1.205`. Updated when material changes. If `getDensity` returns `undefined`, placeholder shows "—". |
| Validation | Must be a positive number. Valid range: `0 < ρ ≤ 25 g/cm³`. See [Behavior §5](#5-input-validation). |
| Debounce | 300 ms before recalculation is triggered |
| Clear action | Clearing the field (empty input) removes the override and reverts to the built-in density |
| Reset on material switch | Field is cleared; override removed |

**Effect on display units:** When a density override is active:
- The keV/µm conversion uses the overridden density: `S_kevum = S_mass × ρ_override / 10`
- The range-to-cm conversion uses: `range_cm = range_gcm2 / ρ_override`

This ensures internal consistency between the WASM-computed stopping
power and the displayed linear unit values.

**URL encoding:** `density=1.205` (numeric, g/cm³). Omitted when not set.

---

### 5. I-Value Override

Controls the `iValueOverride` field of `AdvancedOptions`. When set,
replaces the built-in mean excitation potential from
`LibdedxService.getIValue(materialId)` in the WASM calculation.

| Property | Detail |
|----------|--------|
| Type | Numeric text input |
| Unit label | "eV" (right of input) |
| Placeholder | Built-in I-value from `getIValue(materialId)`, formatted to 4 significant figures. E.g., `75.00`. Updated when material changes. |
| Validation | Must be a positive number. Valid range: `0 < I ≤ 10 000 eV`. See [Behavior §5](#5-input-validation). |
| Debounce | 300 ms before recalculation is triggered |
| Clear action | Clearing the field removes the override and reverts to the built-in I-value |
| Reset on material switch | Field is cleared; override removed |

**Note:** The I-value override is passed only to WASM. It does not affect
unit conversion (the keV/µm formula does not depend on I-value).

**URL encoding:** `ival=75.0` (numeric, eV). Omitted when not set.

---

### 6. Reset to Defaults Button

A **"Reset"** button at the bottom of the accordion resets all five
options simultaneously to their defaults:

| Option | Reset value |
|--------|-------------|
| Aggregate state | Default |
| Interpolation mode | Log-log |
| MSTAR mode | B |
| Density override | Cleared (empty field) |
| I-value override | Cleared (empty field) |

The reset triggers an immediate recalculation. If no options were active
(all already at defaults), the button is **disabled**.

---

## Behavior

### 1. Panel Placement per Page

#### Calculator page

The accordion appears below the entity selection row and above the unified
input/result table:

```
[ Particle ▾ ]  [ Material ▾ ]  [ Program ▾ ]   (•) MeV
                                                          
▶ Advanced Options  ●   ← accordion header; ● = active override badge
─────────────────────────────────────────────────────────
  Aggregate state:  [ Default ▾ ]
  Interpolation:    [ Log-log  ▾ ]
  MSTAR mode:       [ B (recommended) ▾ ]   (disabled — not MSTAR)
  Density:          [ _______ ] g/cm³   ← placeholder: 1.205
  I-value:          [ _______ ] eV      ← placeholder: 75.00
                                            [ Reset ]
─────────────────────────────────────────────────────────
┌────────────────────────────────────────────────────────┐
│ Energy (MeV) │ → MeV/nucl │ Unit │ Stp Power │ CSDA   │
│ ...          │            │      │           │         │
└────────────────────────────────────────────────────────┘
```

#### Plot page

The accordion appears in the left control panel, below the entity
selection area and above the "Add Series" button:

```
┌─────────────────────────────────────────┐
│  Particle: [ Proton (H) ▾ ]             │
│  Material: [ Water (liquid) ▾ ]         │
│  Program:  [ Auto-select ▾ ]            │
│                                         │
│  ▶ Advanced Options  ●                  │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   │
│  Aggregate state: [ Default ▾ ]         │
│  Interpolation:   [ Log-log ▾ ]         │
│  MSTAR mode:      [ B ▾ ]  (disabled)  │
│  Density:         [______] g/cm³        │
│  I-value:         [______] eV           │
│                           [ Reset ]     │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   │
│  [ + Add Series ]                       │
│                                         │
│  Series:                                │
│  ● Proton / Water / ICRU 90             │
└─────────────────────────────────────────┘
```

---

### 2. Reactivity — Recalculation Triggers

| Option changed | Calculator | Plot |
|----------------|-----------|------|
| Aggregate state | Immediate recalculation | Applies to next series added; committed series unchanged |
| Interpolation mode | Immediate recalculation | **Retroactive** — all committed series and the preview curve are redrawn |
| MSTAR mode | Immediate recalculation (if MSTAR active) | Applies to next series added; committed series unchanged |
| Density override | Recalculation after 300 ms debounce (only when field is valid) | Applies to next series added; committed series unchanged |
| I-value override | Recalculation after 300 ms debounce (only when field is valid) | Applies to next series added; committed series unchanged |
| Reset | Immediate recalculation | Interpolation change redraws all series; other resets apply only to next series |

**Plot series immutability (non-interpolation options):** When a series is
committed to the Plot, the aggregate state, density, I-value, and MSTAR
mode that were active at commit time are frozen in the series metadata.
Changing these options after the series is committed does not modify the
committed series' curve data. The panel state represents the options that
will be applied to the **next** series added.

**Interpolation mode exception:** Because scientific validity requires
consistent interpolation across all data sources (WASM and external data),
interpolation is the single exception — it is a session-level setting that
retroactively updates all series. See [`external-data.md`](external-data.md) §8.2.

---

### 3. Aggregate State → Display Unit Coupling

When the aggregate state override changes, the default stopping-power
display unit is updated using the **effective** phase (after applying the
override):

| Effective phase | Default display unit |
|-----------------|---------------------|
| Gas (built-in or overridden) | MeV·cm²/g |
| Condensed (built-in or overridden) | keV/µm |

This closes the open question from [`unit-handling.md`](unit-handling.md) §8 Q3.

**Direction of change:**
- If the user overrides a gas material to "Condensed", the default display
  unit switches from MeV·cm²/g to keV/µm.
- If the user overrides a condensed material to "Gas", the default display
  unit switches from keV/µm to MeV·cm²/g.
- If the user returns the selector to "Default", the default display unit
  reverts to the unit driven by the material's built-in phase
  (`isGasByDefault`).

**User notification:** When the default display unit changes due to an
aggregate state override, the stopping power column header updates
immediately. No additional toast or warning is shown — the header change
is the notification.

---

### 4. Density Override → Unit Conversion Scope

When `densityOverride` is set and valid:

1. It is passed to `LibdedxService.calculate()` (or `getPlotData()`) as
   `options.densityOverride`.
2. It **replaces** `LibdedxService.getDensity(materialId)` in all
   display-unit conversion formulas on the same page:
   - Stopping power: `S_kevum = S_mass × ρ_override / 10`
   - CSDA range: `range_cm = range_gcm2 / ρ_override`

When `densityOverride` is cleared, the app reverts to the built-in density
from `getDensity(materialId)` for both the WASM call and display conversion.

If `getDensity(materialId)` returns `undefined` (no built-in density) and
no override is set:
- Stopping power display falls back to MeV·cm²/g (the mass unit that
  does not require density).
- CSDA range falls back to g/cm² display (cannot convert to length).
  See [`unit-handling.md`](unit-handling.md) §5.2.

---

### 5. Input Validation

Density and I-value override inputs are validated on each change event
(after debounce).

#### Density override

| Condition | State | Inline message |
|-----------|-------|----------------|
| Empty field | No override (valid) | — |
| Positive number, ρ ≤ 25 g/cm³ | Valid override | — |
| Negative number or zero | Invalid | "Density must be greater than 0" |
| Number > 25 g/cm³ | Invalid | "Density exceeds 25 g/cm³ (physical maximum)" |
| Non-numeric text | Invalid | "Enter a numeric value" |

#### I-value override

| Condition | State | Inline message |
|-----------|-------|----------------|
| Empty field | No override (valid) | — |
| Positive number, I ≤ 10 000 eV | Valid override | — |
| Negative number or zero | Invalid | "I-value must be greater than 0" |
| Number > 10 000 eV | Invalid | "I-value exceeds 10 000 eV (physical maximum)" |
| Non-numeric text | Invalid | "Enter a numeric value" |

**While invalid:** The input field shows a red outline. No recalculation
is triggered. The current valid value (or no override if the field was
previously empty) remains in effect. The "Reset" button is not affected.

---

### 6. Material Switch — Override Clearing

When the user selects a different material:

- All five overrides are **cleared simultaneously**.
- The aggregate state selector returns to "Default".
- The interpolation mode is **not** cleared (it is independent of material).
- The MSTAR mode is **not** cleared (it is independent of material, though
  it will reset to B if the program is also changed away from MSTAR).
- The density and I-value input fields are cleared. Placeholder text
  updates to the new material's built-in values.
- Recalculation triggers with the new entity selection and cleared overrides.

**Rationale:** Density and I-value overrides are specific to a material.
Carrying a water-derived density override to an aluminium calculation would
silently produce incorrect results. Clearing on material switch prevents
this class of error.

---

### 7. MSTAR Mode — Program Dependency

The MSTAR mode control is **always rendered** in the panel (it is not
conditionally removed). Its enabled/disabled state reflects whether the
currently active program (or any active program in multi-program mode) is
MSTAR:

| Active program(s) | MSTAR mode control state |
|-------------------|--------------------------|
| MSTAR only | Enabled |
| MSTAR + others (multi-program) | Enabled (applies to MSTAR's calculation) |
| Non-MSTAR only | Disabled (tooltip: "Only applies to MSTAR") |

**On program switch away from MSTAR:** The MSTAR mode selection resets to
**B** (the recommended default). The control becomes disabled.

**On program switch to MSTAR:** The control becomes enabled. The initial
selection is **B** regardless of any prior selection (per the reset
rule above).

---

### 8. Persistence

| Mechanism | What is stored |
|-----------|----------------|
| URL query parameters | All five option values (non-default values only; see [URL State Encoding](#url-state-encoding)) |
| `localStorage` | All five option values (key prefix: `advancedOptions.*`). Also: accordion open/collapsed state. |

**localStorage keys:**

| Key | Type | Default |
|-----|------|---------|
| `advancedOptions.aggregateState` | `"default"` \| `"gas"` \| `"condensed"` | `"default"` |
| `advancedOptions.interpolation` | `"log-log"` \| `"linear"` | `"log-log"` |
| `advancedOptions.mstarMode` | `"a"` \| `"b"` \| `"c"` \| `"d"` \| `"g"` \| `"h"` | `"b"` |
| `advancedOptions.density` | `number` \| `null` | `null` |
| `advancedOptions.ival` | `number` \| `null` | `null` |
| `advancedOptions.open` | `boolean` | `false` |

**Priority:** URL parameters take precedence over localStorage. If a URL
parameter is present, it overrides the localStorage value and updates
localStorage to match.

**Basic mode:** Advanced Options params are not written to the URL when
`mode=basic` (or mode param is absent). On switching from Advanced to
Basic mode, the five params are stripped from the URL. The values remain
in localStorage and are restored when the user switches back to Advanced
mode.

**Material switch:** Clearing overrides on material switch also clears the
corresponding localStorage keys (`advancedOptions.density`,
`advancedOptions.ival`, `advancedOptions.aggregateState`). Interpolation
and MSTAR mode localStorage values are not cleared on material switch.

---

## Output

### Effect on Calculations

All five `AdvancedOptions` fields are forwarded to the WASM API:

```typescript
LibdedxService.calculate({
  programId, particleId, materialId, energies,
  options: {
    aggregateState,      // if not "default"
    interpolation,       // if not "log-log"
    mstarMode,           // if MSTAR program
    densityOverride,     // if set and valid
    iValueOverride,      // if set and valid
  }
})
```

Fields at their default values may be omitted from the `options` object
(the WASM contract treats `undefined` as "use default").

### Effect on Unit Display

- **Aggregate state override** → effective phase → default stopping-power
  display unit (keV/µm or MeV·cm²/g). See §3.
- **Density override** → replaces built-in density in keV/µm and range-to-cm
  conversions. See §4.
- **Interpolation and I-value overrides** → affect computed values only;
  no effect on unit display.
- **MSTAR mode** → affects computed values only; no effect on unit display.

### Active-Override Indicator

When any option differs from its default, the accordion header shows a
filled dot badge "●" to the right of the "Advanced Options" label. This
is visible even when the accordion is collapsed, alerting the user that
non-default calculation parameters are active.

The badge is removed when all options return to their defaults (manually
or via Reset).

### Series Metadata (Plot page)

When a series is committed to the Plot, the active advanced options
(excluding interpolation, which is session-level) are stored in the
series metadata:

```typescript
interface SeriesAdvancedOptions {
  aggregateState?: AggregateState;  // if not "default"
  densityOverride?: number;         // if set
  iValueOverride?: number;          // if set
  mstarMode?: MstarMode;            // if not "b" and MSTAR active
}
```

This metadata is used for:
1. Displaying an override indicator (e.g., a small icon) on the series
   entry in the series list to show it was calculated with non-default
   options.
2. Tooltip on the series item: "Calculated with: density=1.2 g/cm³,
   aggregate state=condensed".
3. URL encoding of committed series (see below).

### URL Encoding for Plot Series with Per-Series Options

When advanced options (other than interpolation) differ per series on the
Plot page, the URL must encode per-series options. In v1, the `series`
URL parameter format (`program.particle.material` triplets) does **not**
support per-series option encoding.

**v1 behaviour:** On URL load, all series are reconstructed with the
current session-level advanced options (from the URL params or defaults).
Per-series option variations from a live session are **not** preserved
across URL share. The URL always reflects the current Advanced Options
panel state.

> **Future (v2):** Extend the `series` URL parameter to encode per-series
> advanced options (e.g., `program.particle.material~agg:condensed~density:1.2`).
> This requires updating `shareable-urls-formal.md` §3 grammar.

---

## URL State Encoding

Advanced Options state is encoded as query parameters appended **after
`qfocus`** in the canonical URL ordering (extending
[`shareable-urls.md`](shareable-urls.md) §7.3).

### New Parameters

| Parameter | Type | Omit when | Example |
|-----------|------|-----------|---------|
| `agg_state` | `gas` \| `condensed` | value = "default" | `agg_state=gas` |
| `interp` | `linear` | value = "log-log" | `interp=linear` |
| `mstar_mode` | `a`\|`b`\|`c`\|`d`\|`g`\|`h` | value = "b" | `mstar_mode=c` |
| `density` | positive number | not set | `density=1.205` |
| `ival` | positive number | not set | `ival=75.0` |

**Omit-when-default rule:** All five parameters are omitted from the URL
when they hold their default values. This keeps the URL minimal and
prevents false "advanced options active" signals.

**Basic mode:** All five parameters are silently dropped when encoding the
URL in Basic mode (`mode` param absent or `mode=basic`). They survive in
`localStorage` and are re-added to the URL when Advanced mode is restored.

### Canonical URL Examples

Calculator — advanced mode, condensed override + density override:

```
/calculator?urlv=1&particle=1&material=276&programs=9,2&energies=100,200&eunit=MeV&mode=advanced&qfocus=both&agg_state=condensed&density=1.100
```

Calculator — advanced mode, linear interpolation only:

```
/calculator?urlv=1&particle=1&material=276&program=auto&energies=100,200&eunit=MeV&mode=advanced&qfocus=both&interp=linear
```

Plot — advanced mode, MSTAR mode C:

```
/plot?urlv=1&particle=1&material=276&program=101&series=101.1.276&stp_unit=kev-um&xscale=log&yscale=log&mode=advanced&qfocus=both&mstar_mode=c
```

### Updated Canonical Ordering

The full canonical parameter order for the Calculator (with all Advanced
Options params):

1. `urlv`
2. `extdata` (one per source, if any)
3. `particle`, `material`
4. `program` (basic) or `programs` (advanced)
5. `energies`, `eunit` (Calculator) — or `series`, `stp_unit`, `xscale`, `yscale` (Plot)
6. `mode=advanced`, `hidden_programs` (if non-empty), `qfocus`
7. **Advanced Options (new):** `agg_state`, `interp`, `mstar_mode`, `density`, `ival`
   (each omitted if at default value)

> The formal ABNF grammar in [`shareable-urls-formal.md`](shareable-urls-formal.md)
> must be updated as a follow-on to include these five parameters.

### Round-trip Stability

On page load with Advanced Options URL params:

1. Parse `agg_state`, `interp`, `mstar_mode`, `density`, `ival`.
2. Validate each value (type and range). Invalid values are silently
   ignored and the default is used instead.
3. Apply options to the Advanced Options panel state.
4. Update localStorage to match.
5. If `mode` param is absent or `mode=basic`, ignore all five params (they
   are not decoded in Basic mode).
6. Recalculate.

---

## Acceptance Criteria

### AC-1: Panel gating

- [ ] When mode=basic (or mode param absent), the Advanced Options accordion
  is not rendered on any page.
- [ ] When mode=advanced, the accordion is rendered (collapsed by default)
  on all calculation pages (Calculator, Plot).

### AC-2: Accordion state

- [ ] Clicking the accordion header toggles it open/collapsed.
- [ ] The open/collapsed state persists across page navigation via localStorage.
- [ ] The active-override badge (●) appears in the header whenever any of
  the five options differs from its default, even when the accordion is collapsed.
- [ ] The badge is absent when all options are at their defaults.

### AC-3: Aggregate state

- [ ] The selector has exactly three options: Default, Gas, Condensed.
- [ ] The "Default" option shows a tooltip with "Built-in state: Gas" or
  "Built-in state: Condensed" matching `isGasByDefault(materialId)`.
- [ ] Selecting "Condensed" for a gas material: recalculation uses
  `aggregateState: "condensed"` and the stopping-power display unit
  switches to keV/µm.
- [ ] Selecting "Gas" for a condensed material: recalculation uses
  `aggregateState: "gas"` and the stopping-power display unit switches to
  MeV·cm²/g.
- [ ] Returning to "Default" reverts the display unit to the material's
  built-in phase default.

### AC-4: Interpolation mode

- [ ] Switching from "Log-log" to "Linear" on the Calculator triggers an
  immediate recalculation.
- [ ] Switching on the Plot page redraws all committed series (retroactive).
- [ ] Switching back to "Log-log" from "Linear" on the Plot page redraws all
  series again.
- [ ] External data series use the same interpolation mode as WASM series.

### AC-5: MSTAR mode

- [ ] When the active program is not MSTAR, the MSTAR mode control is
  rendered but disabled, with tooltip "Only applies to MSTAR".
- [ ] When the active program is MSTAR, the control is enabled.
- [ ] Switching from MSTAR to a non-MSTAR program resets MSTAR mode to B
  and disables the control.
- [ ] In multi-program mode with MSTAR in the list, the control is enabled
  and applies to MSTAR's calculation only.

### AC-6: Density override

- [ ] Empty density field → no override; placeholder shows built-in density.
- [ ] Valid density (e.g., 1.1) → recalculation uses `densityOverride: 1.1`;
  stopping power displayed in keV/µm uses `ρ=1.1` in the conversion formula.
- [ ] CSDA range displayed in length units uses `ρ=1.1` in range_cm formula.
- [ ] Entry of 0 shows inline error "Density must be greater than 0".
- [ ] Entry of −1 shows inline error "Density must be greater than 0".
- [ ] Entry of 26 shows inline error "Density exceeds 25 g/cm³ (physical maximum)".
- [ ] Entry of non-numeric text shows "Enter a numeric value".
- [ ] While invalid, no recalculation fires.
- [ ] Clearing the field removes the override and reverts to built-in density.
- [ ] Switching material clears the field and reverts the override.

### AC-7: I-value override

- [ ] Empty field → no override; placeholder shows built-in I-value.
- [ ] Valid I-value (e.g., 78.0) → recalculation uses `iValueOverride: 78.0`.
- [ ] Entry of 0 shows "I-value must be greater than 0".
- [ ] Entry of 10001 shows "I-value exceeds 10 000 eV (physical maximum)".
- [ ] Switching material clears the field.

### AC-8: Reset button

- [ ] "Reset" button is disabled when all five options are at their defaults.
- [ ] Clicking "Reset" resets all five options to defaults simultaneously.
- [ ] After Reset on the Plot page, interpolation change redraws all series;
  other options affect only future series.

### AC-9: Material switch

- [ ] Switching material clears density override, I-value override, and
  aggregate state selector (returns to Default).
- [ ] Interpolation mode and MSTAR mode are not cleared on material switch.
- [ ] Placeholder text updates to the new material's built-in density and
  I-value after switch.

### AC-10: URL encoding

- [ ] `agg_state=condensed` in the URL sets aggregate state to Condensed on load.
- [ ] `interp=linear` in the URL sets interpolation to Linear on load.
- [ ] `mstar_mode=c` in the URL sets MSTAR mode to C on load.
- [ ] `density=1.205` in the URL sets density override to 1.205 on load.
- [ ] `ival=75.0` in the URL sets I-value override to 75 eV on load.
- [ ] All five params are omitted from the URL when at default values.
- [ ] All five params are stripped from the URL when mode=basic.
- [ ] Invalid param values (e.g., `density=-1`) are silently ignored; default
  is used instead.
- [ ] The five params appear after `qfocus` in the canonical URL order.

### AC-11: localStorage persistence

- [ ] After setting density=1.2, navigating away and back restores density=1.2.
- [ ] After Reset, localStorage values are cleared and navigation does not
  restore the previous overrides.
- [ ] URL params take precedence over localStorage on load.

### AC-12: Plot series metadata

- [ ] A series committed with `agg_state=condensed` shows an override
  indicator in the series list.
- [ ] The series tooltip includes "Calculated with: aggregate
  state=condensed" (or the active non-default options).
- [ ] Changing aggregate state after committing a series does not alter
  the committed series' curve data.

---

## Open Questions

1. **Plot series URL encoding for per-series options (v2):** When two
   series on the Plot page were committed with different density overrides,
   the current URL scheme cannot capture this distinction. How should the
   `series` parameter be extended to encode per-series options? Deferred to
   v2 — see the note in [Output §URL Encoding for Plot Series](#url-encoding-for-plot-series-with-per-series-options).

2. **`shareable-urls-formal.md` grammar update:** The ABNF grammar must be
   updated to include the five new parameters (`agg_state`, `interp`,
   `mstar_mode`, `density`, `ival`) and their value sets. Deferred as a
   follow-on to this spec.

3. **MSTAR mode descriptions:** The physical meaning of modes A–H is not
   specified here. Implementation should consult the libdedx source and
   H. Paul's MSTAR documentation to determine whether short descriptions
   (beyond "A", "B", …) are available and useful in the UI.
