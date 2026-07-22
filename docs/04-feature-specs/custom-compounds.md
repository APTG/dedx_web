# Feature: Custom Compounds

> **Status:** Final v4 (2026-05-08)
>
> **⚠ URL examples in this spec use the v1 schema (`urlv=1`).** The canonical v2
> URL contract (`urlv=2`) is in [`shareable-urls.md`](shareable-urls.md) §3.
> The `mat_*=` params and the `material=custom` sentinel are **unchanged** in v2.
> Only the surrounding scaffolding in examples differs: advanced mode is explicit
> as `mode=advanced` (not inferred from `programs=`); `eunit=` → `uanchor=`; `qfocus=both`
> is omitted as the default.
>
> **v1** (13 April 2026): Initial draft — compound library (localStorage),
> compound editor (formula mode + weight-fraction mode), entity-selection
> integration, WASM `calculateCustomCompound()` wiring, Advanced Options
> interaction rules, URL encoding contract (`material=custom` + `mat_*`
> params, step 9 in canonicalization), round-trip URL guarantee, export
> metadata, validation rules, and acceptance checklist. Revised same day:
> PMMA user story (density 1.20 g/cm³); LiF pellets user story (5 MeV
> alpha, pellet vs bulk density); Bragg additivity program filter (greyed
> out + tooltip); URL params renamed `ccomp_*` → `mat_*`; inverse lookup
> methods via `dedx_extra.{h,c}` C wrappers; PDF composition table
> (Element, Z, Atom count, Weight %); `shareable-urls-formal.md` updated
> to v6; `06-wasm-api-contract.md` updated with 4 new service methods.
>
> **Finalized** (14 April 2026): Consistency pass — PDF MATERIAL row
> format aligned to `export.md` convention (`ρ =` separator). Promoted
> Draft v1 → Final v1. All design questions resolved; one Stage 3
> implementation note retained (MSTAR runtime verification).
>
> **v2** (2026-05-06): Added Reactive Triggers Matrix (§ Reactive Triggers
> Matrix), Acceptance Scenarios with DOM observables and data-testid anchors
> (§ Acceptance Scenarios), Cross-Page Parity Checklist (§ Cross-Page Parity
> Checklist), and data-testid appendix — mandatory additions for Stage 6.9+
> per the spec template introduced in PR #432.
>
> **v3** (2026-05-07): Added clickable Table of Contents. Extended §2.4
> with explicit Basic-mode gating for the **Plot page** (custom compounds
> absent from Plot entity panel in Basic mode). Updated Reactive Triggers
> Matrix column headers to mark Plot columns as Advanced-mode only, with
> an explanatory note. Added input-validation upper bounds: density ≤ 25
> g/cm³ (§4.2), atom count ≤ 1000 per element in formula mode (§4.4).
> Updated AC-3 and AC-4 checklists accordingly. Replaced Scenario 1
> (H₂O smoke test) with a LiF-pellet smoke test (from the LiF user story);
> Custom Water remains as Scenario 2; added Scenario 6 (custom compound
> created on Calculator page is available on Plot page). Added
> `plot-compound-group` data-testid to appendix.
>
> **v4** (2026-05-08): Added Stage 6.10 preflight hardening addendum with:
> (1) implementation-gate acceptance scenarios for create/edit/duplicate/delete/
> select/use/reload/missing-reference flows with DOM observables, (2) explicit
> TypeScript-facing storage/reference model and stable ID policy, (3) validation
> matrix examples and canonicalization rules, (4) strict frontend-vs-WASM
> boundary contract and out-of-scope rules, (5) persistence/migration contract
> including schema versioning and missing-reference recovery, and (6) test-plan
> expectations for smoke vs regression coverage.
>
> **Related specs:**
>
> - WASM API contract (`CustomCompound` type, `calculateCustomCompound()`):
>   [`../06-wasm-api-contract.md`](../06-wasm-api-contract.md) §2.5, §3
> - Entity selection (compact combobox + full panel modes):
>   [`entity-selection.md`](entity-selection.md)
> - Advanced Options (density/I-value/aggregate-state overrides):
>   [`advanced-options.md`](advanced-options.md)
> - Shareable URLs (formal ABNF, canonicalization):
>   [`shareable-urls-formal.md`](shareable-urls-formal.md)
> - Calculator page (where custom compounds appear in basic use):
>   [`calculator.md`](calculator.md)
> - Plot page: [`plot.md`](plot.md)
> - Export (CSV/PDF metadata): [`export.md`](export.md)

---

## Table of Contents

- [User Stories](#user-stories)
- [Feature Overview](#feature-overview)
- [1. Compound Library](#1-compound-library)
  - [1.1 Storage](#11-storage)
  - [1.2 Library limits](#12-library-limits)
  - [1.3 Persistence](#13-persistence)
- [2. Custom Compounds in Entity Selection](#2-custom-compounds-in-entity-selection)
  - [2.1 Calculator page (compact combobox mode)](#21-calculator-page-compact-combobox-mode)
  - [2.2 Plot page (full panel mode)](#22-plot-page-full-panel-mode)
  - [2.3 Visual distinction](#23-visual-distinction)
  - [2.4 Visibility gating](#24-visibility-gating)
- [3. Compound Editor](#3-compound-editor)
  - [3.1 Field summary](#31-field-summary)
  - [3.2 Element rows — Formula mode](#32-element-rows--formula-mode)
  - [3.3 Element rows — Weight fraction mode](#33-element-rows--weight-fraction-mode)
  - [3.4 Dialog actions](#34-dialog-actions)
- [4. Validation Rules](#4-validation-rules)
  - [4.1 Name](#41-name)
  - [4.2 Density](#42-density)
  - [4.3 I-Value (optional)](#43-i-value-optional)
  - [4.4 Elements — both modes](#44-elements--both-modes)
  - [4.5 Weight fractions only](#45-weight-fractions-only)
  - [4.6 Validation interaction model (#767)](#46-validation-interaction-model-767)
- [5. WASM Integration](#5-wasm-integration)
  - [5.1 Calculate call](#51-calculate-call)
  - [5.2 Program compatibility and Bragg additivity filtering](#52-program-compatibility-and-bragg-additivity-filtering)
  - [5.3 Interaction with the Advanced Options panel](#53-interaction-with-the-advanced-options-panel)
  - [5.5 Inverse lookups and plot data for custom compounds](#55-inverse-lookups-and-plot-data-for-custom-compounds)
  - [5.6 Default display unit](#56-default-display-unit)
- [6. URL Encoding](#6-url-encoding)
  - [6.1 ABNF extension](#61-abnf-extension)
  - [6.2 Canonicalization — step 9](#62-canonicalization--step-9)
  - [6.3 Conditional enablement](#63-conditional-enablement)
  - [6.4 Round-trip URL guarantee](#64-round-trip-url-guarantee)
  - [6.5 Parse validation](#65-parse-validation)
  - [6.6 Example URLs](#66-example-urls)
- [7. localStorage Schema](#7-localstorage-schema)
- [8. Export Behavior](#8-export-behavior)
  - [8.1 CSV export](#81-csv-export)
  - [8.2 PDF export (advanced mode metadata block)](#82-pdf-export-advanced-mode-metadata-block)
- [9. Edge Cases](#9-edge-cases)
- [Open Questions](#open-questions)
- [Acceptance Checklist](#acceptance-checklist)
- [Reactive Triggers Matrix](#reactive-triggers-matrix)
- [Acceptance Scenarios](#acceptance-scenarios)
- [Cross-Page Parity Checklist](#cross-page-parity-checklist)
- [Stage 6.10 Preflight Addendum (Implementation Gate)](#stage-610-preflight-addendum-implementation-gate)
- [Appendix: data-testid Reference](#appendix-data-testid-reference)

---

## User Stories

**As a** researcher who uses PMMA as a tissue phantom in proton-beam
dosimetry,
**I want to** define PMMA (C₅H₈O₂) with my measured sample density of
1.20 g/cm³ (slightly higher than the catalogue value of 1.19 g/cm³ due to
machining and material batch variation) as a custom compound and calculate
its stopping power,
**so that** the range predictions match my specific phantom rather than the
library default, enabling accurate dose verification.

**As a** radiation protection researcher working with LiF-based
thermoluminescent dosimeters,
**I want to** enter LiF (Li: Z=3, F: Z=9) with my pellet density of
2.20 g/cm³ — lower than the bulk crystal value of 2.635 g/cm³ because the
pellets are cold-pressed — and calculate the CSDA range of 5 MeV alpha
particles in this material,
**so that** I know how deep the alpha particles penetrate into the pellet
and can verify that they stop well within the active volume.

**As a** shielding engineer working with a proprietary borated
polyethylene compound,
**I want to** enter the weight fractions of hydrogen, carbon, and boron in
my material and immediately get stopping powers,
**so that** I can evaluate the material's effectiveness without waiting for
it to appear in a standard database.

**As a** student exploring Bragg additivity,
**I want to** create a simple custom water compound (H₂O) and compare its
stopping power with the built-in liquid water entry,
**so that** I can verify how well Bragg's additivity rule reproduces
tabulated data.

---

## Feature Overview

Custom compounds are an **Advanced-mode** feature — the full UI is only
visible when the app-wide Advanced mode toggle is active (see
[`multi-program.md`](multi-program.md) §2).

The feature lets users define an arbitrary compound material by specifying:

1. A display name
2. The elemental composition: element Z + atom count per formula unit
   (or weight fractions that are converted to atom counts)
3. The material density in g/cm³
4. An optional mean excitation potential (I-value) in eV
5. The aggregate phase (Gas / Condensed) for display-unit defaulting

Defined compounds are stored in `localStorage` across sessions and appear
in the material selector alongside built-in materials. When a custom
compound is selected, `calculateCustomCompound()` is called instead of
`calculate()`.

---

## 1. Compound Library

### 1.1 Storage

Custom compounds are stored under the `localStorage` key `customCompounds`
as a JSON envelope with schema version:

```typescript
interface StoredCustomCompoundV1 {
  /** Stable opaque identifier. New records use cc_ + uuidv7. */
  id: string;
  /** Display name shown in the material selector (non-empty, ≤ 80 chars). */
  name: string;
  /** Normalized duplicate-detection key: trim+lowercase(name). */
  normalizedName: string;
  /**
   * Elemental composition.
   * atomCount is the number of atoms of this element per formula unit.
   * May be fractional (e.g. when derived from weight fractions).
   */
  elements: Array<{ atomicNumber: number; atomCount: number }>;
  /** Material density in g/cm³. Required, positive, and ≤ 25 g/cm³. */
  density: number;
  /**
   * Optional mean excitation potential in eV.
   * If absent, the WASM layer applies Bragg additivity.
   */
  iValue?: number;
  /**
   * Aggregate phase. Controls the default display unit.
   * "condensed" (default) → keV/µm default unit.
   * "gas" → MeV·cm²/g default unit.
   */
  phase: "gas" | "condensed";
  /** ISO 8601 creation timestamp. */
  createdAt: string;
  /** ISO 8601 last-edit timestamp. */
  updatedAt: string;
}

interface CustomCompoundStoreEnvelopeV1 {
  schemaVersion: 1;
  compounds: StoredCustomCompoundV1[];
}
```

### 1.2 Library limits

The library has a **soft limit of 50 compounds**. No hard enforcement
is applied, but:

- At 45+ compounds the editor shows an inline notice:
  "You have X compounds saved. Consider deleting unused ones."
- The notice does not block saving.

### 1.3 Persistence

Compounds survive page reload, navigation between Calculator and Plot
pages, and browser restart. The library is cleared only when the user
explicitly deletes compounds or clears site storage.

---

## 2. Custom Compounds in Entity Selection

Custom compounds are surfaced wherever the built-in material list appears.

### 2.1 Calculator page (compact combobox mode)

The material combobox has a **"Custom Compounds" group** at the bottom of
the dropdown, below the built-in compound list.

| Element          | Detail                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Group header     | "Custom Compounds" — always visible in Advanced mode regardless of the active text filter   |
| Compound entry   | Name (bold) + density in g/cm³ (secondary text) + edit icon (✏) + delete icon (🗑)           |
| Text filter      | Filters custom compound entries by name (same filter input as built-in materials)           |
| "+ Add compound" | Button at the bottom of the custom-compounds group; opens the compound editor in "new" mode |

Example:

```
┌─ Material ─────────────────────────────────────────────┐
│  Elements                                               │
│    [H] Hydrogen                                         │
│    ...                                                  │
│  Compounds                                              │
│    [W] Liquid Water                                     │
│    ...                                                  │
│  Custom Compounds                                       │
│    [★] PMMA  —  1.19 g/cm³  ✏  🗑                      │
│    [★] BoroPolyEthylene  —  0.95 g/cm³  ✏  🗑          │
│    + Add compound                                       │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Plot page (full panel mode)

The materials sidebar panel gains a **"Custom" sub-list** below the
existing "Compounds" sub-list. The same name + density display applies.

### 2.3 Visual distinction

Custom compound entries are visually distinguished from built-in materials
in both modes:

- A **"custom" badge** (small label tag) is shown on each entry.
- The badge color uses the accent color.

Custom compounds are **never greyed out** for any particle/program
combination. Compatibility is assumed; runtime errors are handled after
the fact (see §5.2).

### 2.4 Visibility gating

When the app is in **Basic mode**, custom compounds are **not rendered**
(absent from the DOM, not merely hidden) on **both** the Calculator and
Plot pages:

- **Calculator page**: The "Custom Compounds" group and "+ Add compound"
  button are absent from the material combobox DOM.
- **Plot page**: The "Custom" sub-list is absent from the materials sidebar
  panel DOM. Custom compounds cannot be added as plot series in Basic mode.

If a custom compound was the active material when the user switches to
Basic mode:

- On the **Calculator page**, the active material falls back to the default
  (liquid water, ID 276). The custom compound selection is preserved in
  memory and restored when Advanced mode is re-enabled.
- On the **Plot page**, any series using a custom compound are removed from
  the series list. They are **not** automatically restored on Advanced mode
  re-entry (series removal is irreversible within a session).

URL in Basic mode never contains `material=custom` and never contains
`mat_*` params.

---

## 3. Compound Editor

The compound editor is a **modal dialog** triggered by:

- "+ Add compound" → opens in **new** mode (blank form)
- ✏ edit icon on a saved compound → opens in **edit** mode (pre-filled)

### 3.1 Field summary

| Field        | Type                          | Required | Constraints                                           |
| ------------ | ----------------------------- | -------- | ----------------------------------------------------- |
| Name         | Text input                    | Yes      | Non-empty, ≤ 80 characters                            |
| Density      | Numeric input + "g/cm³" label | Yes      | > 0 and ≤ 25; accepts decimal and scientific notation |
| I-Value      | Numeric input + "eV" label    | No       | If provided: > 0 and ≤ 10 000 eV                      |
| Phase        | Two-option segmented control  | Yes      | Gas / Condensed; default Condensed                    |
| Input mode   | Toggle                        | Yes      | Formula / Weight fraction; default Formula            |
| Element rows | Dynamic list (1–20 rows)      | Yes      | ≥ 1 valid row required                                |

### 3.2 Element rows — Formula mode

Each row contains:

- **Element selector** — typeahead accepting symbol ("H", "Fe"), full
  name ("hydrogen"), or atomic number ("1"→"26"). Resolves to Z on
  selection. Placeholder: "Symbol or Z"
- **Atom count input** — positive number (may be fractional, e.g. 1.5),
  maximum 1000. Integers for standard stoichiometric compounds.
- **"×" remove button**

An **"Add element" button** appends a new blank row. The form starts with
one blank row in new mode.

### 3.3 Element rows — Weight fraction mode

Each row contains:

- **Element selector** (same as formula mode)
- **Weight % input** — number in (0, 100]; allows up to 4 decimal places
- **Inferred atom count** — read-only display in small text:
  `n_i = w_i / M_i` normalized to unitless relative values. Updated live.
- **"×" remove button**

A **live sum indicator** is shown below the rows:

```
Total: 98.7%  ← shown in error colour when < 99.9% or > 100.1%
Total: 100.0% ✓  ← shown in success colour when within ±0.1%
```

The **"Save" button is disabled** while the sum is outside 99.9–100.1%.

**Conversion to atom counts** at save time:

```
n_i = w_i / M_i
```

where `w_i` is the weight fraction (0–1) of element i and `M_i` is the
standard atomic weight in g/mol. The resulting `n_i` values are stored
directly as `atomCount` (floating point). `M_i` values are maintained as
a small internal JS lookup table for the 118 elements.

**Verification example:**

- H₂O: H weight fraction ≈ 0.1119, O weight fraction ≈ 0.8881.
  n_H = 0.1119 / 1.008 ≈ 0.111, n_O = 0.8881 / 15.999 ≈ 0.0555.
  Ratio n_H / n_O ≈ 2.0 → atom counts H: 2, O: 1. ✓

Switching from weight-fraction mode back to formula mode re-displays the
inferred fractional atom counts (not rounded) so the user can see what
was derived.

### 3.4 Dialog actions

| Control                     | Behavior                                                                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Save**                    | Validates all fields. On success: writes to `localStorage`, closes dialog, adds or updates the entry in the selector. If the edited compound is the currently selected material, recalculates immediately. |
| **Cancel**                  | Discards all changes; closes dialog without modifying `localStorage`.                                                                                                                                      |
| **Delete** (edit mode only) | Shows a secondary confirmation: "Delete compound PMMA? This cannot be undone." Confirming removes from library and selector; if active material, falls back to last-used built-in material.                |

**Duplicate name warning:** If the entered name matches an existing
compound (case-insensitive comparison), an inline warning is shown:
"A compound named 'X' already exists." The user may proceed — names are
not unique keys (IDs are). The warning does not block saving.

---

## 4. Validation Rules

### 4.1 Name

| Rule                     | Error message                          |
| ------------------------ | -------------------------------------- |
| Non-empty after trimming | "Name is required."                    |
| ≤ 80 characters          | "Name must be 80 characters or fewer." |

### 4.2 Density

| Rule                                    | Error message                        |
| --------------------------------------- | ------------------------------------ |
| Non-empty and parses as a finite number | "Density is required."               |
| > 0                                     | "Density must be greater than zero." |
| ≤ 25 g/cm³                              | "Density must be ≤ 25 g/cm³."        |

Accepts decimal (`1.19`) and scientific notation (`8.99e-5`).

> **Rationale for 25 g/cm³ upper bound:** The densest naturally occurring
> element (Osmium) has a bulk density of 22.59 g/cm³. The 25 g/cm³ cap
> covers all known elements and alloys with headroom, while preventing
> clearly erroneous entries (e.g., `2500` entered by unit confusion) that
> would produce physically meaningless stopping-power values.

### 4.3 I-Value (optional)

| Rule                                          | Error message                        |
| --------------------------------------------- | ------------------------------------ |
| If provided: parses as finite positive number | "I-value must be a positive number." |
| If provided: ≤ 10 000 eV                      | "I-value must be ≤ 10 000 eV."       |

Blank → field cleared; `iValue` absent from stored compound.

### 4.4 Elements — both modes

| Rule                                          | Error message                                                    |
| --------------------------------------------- | ---------------------------------------------------------------- |
| At least 1 row                                | "At least one element is required."                              |
| Each element resolves to a valid Z ∈ [1, 118] | "Unknown element: 'X'."                                          |
| No duplicate Z values                         | "Element Z is listed more than once. Combine into a single row." |
| Each atom count/weight % > 0                  | "Count must be greater than zero."                               |
| Each atom count ≤ 1000 (formula mode only)    | "Atom count must be ≤ 1000."                                     |

> **Rationale for 1000 atom-count cap (formula mode):** Real stoichiometric
> formulas rarely exceed single-digit or low double-digit atom counts per
> element. Values above 1000 are almost certainly data-entry errors.
> Weight-fraction mode is exempt because computed `n_i = w_i / M_i` values
> are inherently fractional (< 1 for any element at 100%).

### 4.5 Weight fractions only

| Rule                | Error message / indicator                                              |
| ------------------- | ---------------------------------------------------------------------- |
| Sum ∈ [99.5, 100.5] | Live indicator shows current total; Save is blocked outside this range |

### 4.6 Validation interaction model (#767)

Validation itself is pure (a function of form state), but **when** messages are
shown is deferred so an untouched form is never pre-filled with red text:

- A field's inline error appears only once that field is **blurred** (touched)
  or after a **Save attempt**. Composition errors also surface as soon as the
  composition is edited. Inputs expose `aria-invalid` + `aria-describedby` so
  screen readers announce the error.
- The **Save button stays clickable** (not disabled). Pressing Save on an
  invalid form does not persist; instead it reveals all outstanding errors and
  shows the blocking reason as **visible text** next to the button (`role="alert"`)
  rather than a tooltip-only hint (no tooltips on touch devices).
- The failed-URL recovery flow (§6) reveals errors immediately, since the amber
  notice already asks the user to fix the flagged fields.

"Save disabled" / "blocks Save" throughout this spec refers to this gating:
Save remains pressable but will not persist while the form is invalid.

---

## 5. WASM Integration

### 5.1 Calculate call

When a custom compound is the active material, the calculation call is:

```typescript
const result = service.calculateCustomCompound({
  programId,
  particleId,
  compound: {
    name: stored.name,
    elements: stored.elements, // [{ atomicNumber, atomCount }, ...]
    density: stored.density,
    iValue: stored.iValue, // undefined when not set
  },
  energies, // in MeV/nucl (converted from user's chosen unit)
});
```

The WASM implementation allocates a `dedx_config` workspace, writes
`elements_id` and `elements_atoms` arrays, sets the density and (if
provided) the I-value override, evaluates, and frees the workspace.

### 5.2 Program compatibility and Bragg additivity filtering

Custom compounds use **Bragg's additivity rule**: the compound stopping
power is the weighted sum of elemental stopping powers. For this to work,
a program must have tabulated stopping-power data for **every element** in
the compound. Programs that lack data for one or more elements cannot
compute the compound's stopping power and are filtered out.

#### How the filter works

At WASM init time the compatibility matrix already stores, for every
program, the full list of supported materials (see
[`entity-selection.md`](entity-selection.md) §Compatibility Matrix). From
that list, elemental materials are identified by the non-null
`atomicNumber` field on `MaterialEntity`.

```typescript
// Pseudocode — evaluated reactively when compound elements change
function getCompatiblePrograms(compound: StoredCompound): {
  compatible: ProgramEntity[];
  incompatible: Array<{ program: ProgramEntity; missingZ: number[] }>;
} {
  const result = { compatible: [], incompatible: [] };
  for (const program of allPrograms) {
    const supportedZ = new Set(
      getMaterials(program.id)
        .filter((m) => m.atomicNumber !== undefined)
        .map((m) => m.atomicNumber!),
    );
    const missingZ = compound.elements.map((e) => e.atomicNumber).filter((z) => !supportedZ.has(z));
    if (missingZ.length === 0) {
      result.compatible.push(program);
    } else {
      result.incompatible.push({ program, missingZ });
    }
  }
  return result;
}
```

The particle filter (which programs support the chosen particle) is
applied first, then the element filter is applied on top. Both conditions
must be satisfied for a program to be selectable.

#### UX: incompatible programs

Incompatible programs are **greyed out** in the program selector (same
visual treatment as unavailable programs in entity-selection). A tooltip
on the greyed-out entry lists the missing elements:

> "Missing elemental data for: Li (Z=3), F (Z=9) in this program."

The greyed-out entry is visible but not selectable. In multi-program
Advanced mode, incompatible programs cannot be added to the `programs`
list.

> **Confirmed UX choice:** option A — greyed out with tooltip.

#### Example: LiF pellets (Li Z=3, F Z=9)

For 5 MeV alpha particles (He-4, A=4):

- PSTAR covers protons only → incompatible (wrong particle, filtered first)
- MSTAR covers heavy ions — but MSTAR's elemental tables cover Z=1–92;
  both Li (Z=3) and F (Z=9) are included → compatible ✓
- ICRU 73 covers heavy ions for many elements → check element data
  availability at runtime to determine compatibility

If `calculateCustomCompound()` throws a `LibdedxError` despite passing
the pre-filter (e.g., a program supports individual elements but the
stateful compound path fails at runtime), the error is displayed inline
using the standard error display rules (human-friendly message, "Show
details" toggle revealing the C error code). One program's failure in
multi-program mode does not abort the others.

### 5.3 Interaction with the Advanced Options panel

The `calculateCustomCompound()` signature does not accept `AdvancedOptions`.
Material-level overrides that would normally go through `AdvancedOptions`
are replaced by the compound's own fields. The Advanced Options panel
remains visible in Advanced mode, but certain controls are **disabled**
(not hidden) when a custom compound is the active material:

| Advanced Options control     | Behaviour with custom compound                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- |
| Density override             | **Disabled.** Tooltip: "Density is set in the compound definition."                                      |
| I-value override             | **Disabled.** Tooltip: "Override the compound's I-value in the compound editor."                         |
| Aggregate state toggle       | **Disabled.** Tooltip: "Phase is set in the compound definition."                                        |
| Interpolation scale / method | **Active.** Spline interpolation operates at the JS level and is fully compatible with custom compounds. |
| MSTAR mode                   | **Active.** MSTAR mode is a program-level setting and is unaffected by the material type.                |

Inverse lookup tabs (Range / Inverse STP) are **fully supported** for
custom compounds via dedicated WASM methods (see §5.5).

### 5.5 Inverse lookups and plot data for custom compounds

The existing `getInverseStp()` and `getInverseCsda()` methods accept a
numeric `materialId`. Custom compounds have no built-in material ID, so
these methods cannot be used directly.

**Solution:** Add thin C wrapper functions in `wasm/dedx_extra.{h,c}` that
accept the compound element arrays (the same `elements_id` + `elements_atoms`
pattern as `calculateCustomCompound()`) and call the existing
`dedx_get_inverse_stp()` / `dedx_get_inverse_csda()` functions with a
stateful `dedx_config` workspace. This follows the established pattern
for extending libdedx without modifying its submodule.

New WASM service methods to add to `06-wasm-api-contract.md`:

```typescript
/**
 * Find the energy corresponding to a given stopping power for a custom compound.
 * Implemented via a stateful dedx_config workspace (same pattern as
 * calculateCustomCompound). Added to wasm/dedx_extra.{h,c}.
 */
getInverseStpCustomCompound(params: {
  programId: number;
  particleId: number;
  compound: CustomCompound;
  stoppingPowers: number[];  // in MeV·cm²/g
  side: 0 | 1;
}): InverseStpResult;

/**
 * Find the energy corresponding to a given CSDA range for a custom compound.
 */
getInverseCsdaCustomCompound(params: {
  programId: number;
  particleId: number;
  compound: CustomCompound;
  ranges: number[];          // in g/cm²
}): InverseCsdaResult;

/**
 * Generate a dense energy grid and evaluate stopping power + CSDA range
 * for a custom compound. Implemented JS-side: generates log-spaced grid
 * via getMinEnergy()/getMaxEnergy() and calls calculateCustomCompound()
 * iteratively. No additional C code needed.
 */
getPlotDataCustomCompound(params: {
  programId: number;
  particleId: number;
  compound: CustomCompound;
  pointCount: number;
  logScale: boolean;
}): CalculationResult;
```

The Range and Inverse STP tabs on the Calculator page behave identically
for custom compounds as for built-in materials, using the custom compound
variants above. The `getBraggPeakStp()` hint is similarly extended:

```typescript
getBraggPeakStpCustomCompound(params: {
  programId: number;
  particleId: number;
  compound: CustomCompound;
}): number;
```

> **Implementation note (Stage 3):** `getInverseStpCustomCompound()` and
> `getInverseCsdaCustomCompound()` and `getBraggPeakStpCustomCompound()`
> require new C wrapper functions in `wasm/dedx_extra.{h,c}` compiled
> together with libdedx. `getPlotDataCustomCompound()` is a pure JS wrapper
> over repeated `calculateCustomCompound()` calls — no C changes needed.

### 5.6 Default display unit

The custom compound's `phase` field drives the default stopping-power
display unit, exactly as the built-in `isGasByDefault` flag does:

| Compound phase | Default display unit |
| -------------- | -------------------- |
| `"condensed"`  | keV/µm               |
| `"gas"`        | MeV·cm²/g            |

---

## 6. URL Encoding

Custom compound parameters are emitted only in **Advanced mode** and only
when a custom compound is the **active material**. When a built-in
material is active, the existing numeric `material=<id>` rule applies
unchanged.

### 6.1 ABNF extension

The grammar fragments below extend
[`shareable-urls-formal.md`](shareable-urls-formal.md) (updated to v6
alongside this spec).

> **Prefix choice:** `mat_` (material). Short, readable, and unambiguous
> in context because `material=custom` acts as the gate.

```abnf
; material-pair extended to accept "custom" sentinel
material-pair       = "material=" (int-pos / "custom")

; custom compound params — only valid when material=custom and mode=advanced
mat-name-pair       = "mat_name=" value
                    ; value is percent-encoded via standard URLSearchParams
mat-density-pair    = "mat_density=" number
                    ; number must be > 0; scientific notation allowed (e.g. 8.99e-5)
mat-elements-pair   = "mat_elements=" mat-element *("," mat-element)
mat-element         = int-pos ":" number
                    ; int-pos is atomic number Z ∈ [1, 118]
                    ; number is atom count > 0 (may be fractional)
mat-ival-pair       = "mat_ival=" number
                    ; number must be > 0 and ≤ 10000; omitted when no iValue
mat-phase-pair      = "mat_phase=" ("gas" / "condensed")
                    ; omitted when "condensed" (default)
matsrc-pair         = "matsrc=" ("transient" / "saved")
                    ; provenance hint; omitted when "saved" (default).
                    ; "transient" ⇒ the sender's compound came from another
                    ; shared URL and was never saved to their library.
```

These new pair types are added to the `pair` alternation in the ABNF,
after `iunit-pair` and before `unknown-pair`.

### 6.2 Canonicalization — step 9

After step 8 (inverse-lookup params), emit custom compound params if and
only if `mode=advanced` and `material=custom`:

**Step 9 — Custom compound params** (in this sub-order):

a. `mat_name` — always emitted (percent-encoded)  
b. `mat_density` — always emitted; serialized via `Number.prototype.toString()` (decimal or scientific notation per ECMAScript rules)  
c. `mat_elements` — always emitted; elements ordered by **ascending Z**; atom counts serialized via `Number.prototype.toString()`  
d. `mat_ival` — omitted when absent; otherwise emitted as decimal eV value  
e. `mat_phase` — omitted when `"condensed"` (default); emitted as `"gas"` otherwise  
f. `matsrc` — omitted when `"saved"` (default); emitted as `"transient"` only
when the selected compound is still a session-only transient (loaded from a
shared URL and never saved). Keeps pre-existing shared URLs byte-for-byte
unchanged.

### 6.3 Conditional enablement

- `material=custom` and all `mat_*` params are **silently ignored** when
  `mode != advanced` (consistent with §3.5 of `shareable-urls-formal.md`).
- When `material=custom` is present without the required `mat_*` params,
  fall back to the default material (liquid water, ID 276) and show a
  one-time warning banner: "Custom compound data missing from URL —
  switched to Liquid Water."
- Receiving a URL with `material=custom` does **not** automatically save
  the compound to the local library.

### 6.4 Round-trip URL guarantee

When a URL contains `material=custom` with all required `mat_*` params:

1. A transient `StoredCompound` object is reconstructed from the URL.
2. It is selected as the active material.
3. A dismissible banner is shown with **three** actions: **[Save to
   library] [Edit & save copy] [Dismiss]**.
   - **Save to library** runs the same validation as the editor and (on
     success) adds the compound with a new UUID, then dismisses the banner
     and selects the new entry.
   - **Edit & save copy** opens the compound editor pre-filled with the
     transient's fields and a deduplicated name (`Foo` → `Foo (copy)` →
     `Foo (copy 2)` when the library already holds that name). On Save it
     creates a new library entry, dismisses the transient, and selects the
     new entry; on Cancel the transient stays active and the banner
     remains.
   - **Dismiss** keeps the compound active for the session only.

When the URL carried `matsrc=transient`, the banner copy changes to
"Loaded an unsaved custom compound … from a shared URL." to signal that the
sender never saved it.

A dedicated editor instance lives on the calculator page (not the
entity-selection picker) so "Edit & save copy" works even when the picker
is collapsed.

### 6.5 Parse validation

| Condition                                      | Recovery                                                          |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| `mat_name` missing or empty                    | Fall back to default material; show warning                       |
| `mat_density` missing, ≤ 0, or non-numeric     | Fall back to default material; show warning                       |
| `mat_elements` missing or all elements invalid | Fall back to default material; show warning                       |
| Individual invalid Z (outside [1, 118])        | Drop that element; if at least one valid element remains, proceed |
| Individual invalid atom count (≤ 0)            | Drop that element; same recovery                                  |
| Duplicate Z in URL                             | Collapse by summing counts                                        |
| `mat_ival` out of range                        | Silently ignore; proceed without iValue                           |
| `mat_phase` unknown token                      | Silently ignore; default to `"condensed"`                         |

**Failed-URL recovery (Gap B).** When validation fails, the decoder still
retains the best-effort fields it managed to parse (raw text for the failed
numeric fields). The warning banner then offers **Edit & save copy**, which
opens the editor pre-filled with those partial fields and an amber inline
notice at the top:

> Some URL parameters couldn't be restored: `mat_density invalid`. Fix the
> highlighted fields and Save to keep this compound.

The offending fields are outlined amber; Save stays disabled (re-using the
editor's existing Save gating) until they are corrected.

### 6.6 Example URLs

**Basic custom compound — PMMA:**

```
?urlv=1&particle=1&material=custom&energies=100&eunit=MeV
&mode=advanced&programs=9&qfocus=both
&mat_name=PMMA&mat_density=1.19&mat_elements=1:8,6:5,8:2
```

(elements ordered by ascending Z: H=1, C=6, O=8)

**Custom water with gas phase:**

```
?urlv=1&particle=1&material=custom&energies=100&eunit=MeV
&mode=advanced&programs=9&qfocus=both
&mat_name=Custom%20Water&mat_density=1.0&mat_elements=1:2,8:1
&mat_phase=gas
```

---

## 7. localStorage Schema

```json
{
  "schemaVersion": 1,
  "compounds": [
    {
      "id": "cc_0196b5e6-2ad4-7d57-b42a-c0f4bca9966e",
      "name": "PMMA",
      "normalizedName": "pmma",
      "elements": [
        { "atomicNumber": 1, "atomCount": 8 },
        { "atomicNumber": 6, "atomCount": 5 },
        { "atomicNumber": 8, "atomCount": 2 }
      ],
      "density": 1.19,
      "phase": "condensed",
      "createdAt": "2026-04-13T10:00:00Z",
      "updatedAt": "2026-04-13T10:00:00Z"
    }
  ]
}
```

Elements are stored in ascending Z order. Fractional atom counts (from
weight-fraction input) are stored as-is without rounding. Legacy array-only
payloads are migrated to the v1 envelope at load time.

---

## 8. Export Behavior

### 8.1 CSV export

Column headers are unchanged. The material identifier in the filename and
any header rows uses the compound name suffixed with `(custom)`:

| Context                | Value                       |
| ---------------------- | --------------------------- |
| CSV filename           | `dedx_PMMA_custom_proton_…` |
| Material column header | `PMMA (custom)`             |

### 8.2 PDF export (advanced mode metadata block)

The `MATERIAL` row shows the compound name, "(custom)" marker, density,
and phase (phase shown only when gas):

```
MATERIAL  PMMA (custom)  ρ = 1.19 g/cm³
```

```
MATERIAL  Custom Water (custom, gas)  ρ = 8.99e-5 g/cm³
```

Immediately below the `MATERIAL` row, in the metadata block, an
**elemental composition table** is included. This is the advanced-mode
PDF only (basic PDF does not show the metadata block at all, so the
composition table never appears in basic PDF).

```
COMPOSITION (Bragg additivity):
  Element    Z    Atom count    Weight %
  ────────────────────────────────────────
  H          1    8             8.05 %
  C          6    5             59.99 %
  O          8    2             31.96 %
  ────────────────────────────────────────
  Total            15           100.00 %
```

Columns:

- **Element** — chemical symbol
- **Z** — atomic number
- **Atom count** — value as stored (may be fractional for weight-fraction
  input); displayed to 4 significant figures
- **Weight %** — computed from atom counts and standard atomic weights;
  shown as percentage to 2 decimal places

If an I-value override is stored on the compound, a line below the table reads:

```
  I-value override: 74.00 eV  (built-in Bragg additivity bypassed)
```

---

## 9. Edge Cases

| Scenario                                                           | Behaviour                                                                                                                                                                              |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Custom compound active → user switches to Basic mode (Calculator)  | Material reverts to default (liquid water). Custom compound selection held in memory. Switching back to Advanced mode restores it. URL in Basic mode never contains `material=custom`. |
| Custom compound series active → user switches to Basic mode (Plot) | Series using custom compounds are removed from the series list. They are not automatically restored on Advanced mode re-entry.                                                         |
| User deletes the currently selected compound                       | Falls back to the last-used built-in material (or liquid water if none). Toast: "Compound 'X' deleted — switched to Liquid Water."                                                     |
| User edits the currently selected compound                         | Recalculates immediately on save using the updated definition. URL updates to reflect new `mat_*` params.                                                                              |
| Multi-program mode with a custom compound                          | Each program calls `calculateCustomCompound()` independently. One program's runtime error does not suppress others.                                                                    |
| Custom compound selected on Plot page                              | `getPlotDataCustomCompound()` or equivalent is used to generate the dense energy grid. The series label shows the compound name with the "(custom)" badge.                             |
| Compound name contains `&`, `=`, `%`                               | Percent-encoded in the URL via `encodeURIComponent`. Decoded transparently on parse.                                                                                                   |
| `localStorage` quota exceeded on save                              | Editor shows: "Cannot save: browser storage is full. Delete unused compounds first." The new compound is not persisted.                                                                |
| WASM call fails for custom compound                                | Error displayed inline (human-friendly message, "Show details" for C error code). Result cells show "—". Other programs in multi-program mode are unaffected.                          |
| URL parsed in Basic mode contains `material=custom`                | `mat_*` params silently dropped; material defaults to liquid water. No warning shown (Basic-mode URL is expected to lack advanced params).                                             |
| Two elements with same Z entered by user                           | Editor shows inline error on the duplicate row; Save blocked.                                                                                                                          |

---

## Open Questions

1. **MSTAR + custom compound** — Whether MSTAR's stateful `dedx_config`
   path accepts `elements_id` / `elements_atoms` is unverified at spec
   time. MSTAR is included in the Bragg additivity element filter (§5.2),
   so the check at WASM init time should catch incompatibility early. If
   MSTAR rejects the call at runtime despite passing the pre-filter, the
   error path (§5.2) handles it gracefully. **Stage 3 implementation
   notes must verify MSTAR's custom-compound support with the real WASM.**

---

## Acceptance Checklist

### AC-1: Visibility gating

- [ ] "Custom Compounds" group is absent from the DOM in Basic mode (Calculator)
- [ ] "+ Add compound" button is absent from the DOM in Basic mode (Calculator)
- [ ] "Custom" sub-list is absent from the DOM in Basic mode (Plot)
- [ ] Switching Basic → Advanced mode renders/restores the custom compound group (Calculator), even if Advanced mode had not previously been activated
- [ ] Switching Advanced → Basic mode when a custom compound is active on Calculator reverts to liquid water and clears `material=custom` from the URL
- [ ] Switching Advanced → Basic mode on Plot removes any custom compound series from the series list

### AC-2: Compound editor — create

- [ ] "+ Add compound" opens the modal with all fields blank (except Phase = Condensed)
- [ ] "Name" field receives focus on open
- [ ] Formula mode is the default input mode
- [ ] Saving a valid compound in Formula mode adds it to `localStorage` under `customCompounds`
- [ ] The new compound appears in the material selector immediately after saving (no page reload required)
- [ ] The new compound entry shows name, density, edit icon, and delete icon

### AC-3: Compound editor — validation (Formula mode)

- [ ] Empty name blocks Save with inline error "Name is required."
- [ ] Name > 80 chars blocks Save
- [ ] Blank density blocks Save
- [ ] Density ≤ 0 blocks Save
- [ ] Density > 25 g/cm³ blocks Save with inline error "Density must be ≤ 25 g/cm³."
- [ ] I-value ≤ 0 blocks Save when field is non-empty
- [ ] I-value > 10 000 eV blocks Save
- [ ] Element with Z outside [1, 118] shows "Unknown element" error and blocks Save
- [ ] Duplicate Z in two rows shows inline error on the second row and blocks Save
- [ ] Atom count ≤ 0 blocks Save
- [ ] Atom count > 1000 blocks Save with inline error "Atom count must be ≤ 1000."

### AC-4: Compound editor — validation (Weight fraction mode)

- [ ] Switching to Weight fraction mode shows the sum indicator
- [ ] Sum < 99.9% shows sum indicator in error colour and disables Save
- [ ] Sum > 100.1% shows sum indicator in error colour and disables Save
- [ ] Sum ∈ [99.9, 100.1]% shows sum indicator in success colour and enables Save
- [ ] H₂O input (H ≈ 11.19%, O ≈ 88.81%) produces atom counts H: ~2, O: ~1 within 0.1% relative error
- [ ] PMMA input (C 59.99%, H 8.05%, O 31.96%) produces atom counts within 0.5% relative error of C:5, H:8, O:2

### AC-5: Compound editor — edit

- [ ] Clicking ✏ on a saved compound opens the modal pre-filled with all stored values
- [ ] Editing name/density/composition and saving updates the `localStorage` entry
- [ ] If the edited compound is the active material, the calculation re-runs immediately with new values and the URL updates

### AC-6: Compound deletion

- [ ] Clicking 🗑 shows a confirmation dialog with the compound name
- [ ] Confirming deletion removes the compound from `localStorage` and from the selector
- [ ] Deleting the active compound falls back to last-used built-in material (or liquid water) and shows a toast

### AC-7: Entity selection integration

- [ ] Custom compounds appear in the "Custom Compounds" group in the compact combobox (Calculator)
- [ ] Custom compounds appear in the "Custom" sub-list in the full panel (Plot)
- [ ] Custom compound entries show the "custom" badge visually distinct from built-in entries
- [ ] Text filter in the material selector filters custom compound names correctly
- [ ] Custom compounds are never greyed out regardless of particle or program selection

### AC-7b: Program compatibility filter

- [ ] For a compound with elements A, B, C: only programs with elemental material data for all of A, B, C are selectable
- [ ] Programs missing one or more elements are greyed out (option A provisional) with a tooltip listing the missing elements by symbol and Z
- [ ] The filter updates reactively when element rows change in the editor preview (before saving)
- [ ] LiF compound (Li Z=3, F Z=9) with 5 MeV alpha: programs lacking Li or F elemental data are greyed out; MSTAR is shown as compatible if it has both elements in its material list
- [ ] Particle-incompatible programs are filtered first (existing entity-selection rule), then element filter applied on remaining

### AC-8: Calculation

- [ ] Selecting a custom compound calls `calculateCustomCompound()` with the correct `programId`, `particleId`, `compound`, and `energies`
- [ ] H₂O custom compound (density 1.0 g/cm³, no iValue) produces stopping powers within 2% of built-in liquid water (ID 276) for protons at 100 MeV/nucl in PSTAR (Bragg additivity)
- [ ] LiF compound (density 2.20 g/cm³) with 5 MeV alpha produces a CSDA range value that differs from the bulk-crystal-density calculation proportionally to the density ratio (range scales as 1/ρ)
- [ ] WASM error for a custom compound is displayed inline without aborting other calculations in multi-program mode
- [ ] `getPlotDataCustomCompound()` produces a smooth stopping-power curve on the Plot page for a custom compound

### AC-8b: Inverse lookups with custom compound

- [ ] Range tab is active for a custom compound — `getInverseCsdaCustomCompound()` is called with the correct `compound` argument
- [ ] Inverse STP tab is active for a custom compound — `getInverseStpCustomCompound()` is called
- [ ] `getBraggPeakStpCustomCompound()` result is shown as the valid-range hint below the Inverse STP table

### AC-9: Advanced Options interaction

- [ ] Density override field is disabled and shows the tooltip when a custom compound is active
- [ ] I-value override field is disabled and shows the tooltip when a custom compound is active
- [ ] Aggregate state toggle is disabled and shows the tooltip when a custom compound is active
- [ ] Spline interpolation (interpolation method = spline) still produces results when a custom compound is active
- [ ] MSTAR mode selection takes effect when MSTAR program is selected with a custom compound

### AC-10: URL encoding

- [ ] `material=custom` appears in the URL when a custom compound is active in Advanced mode
- [ ] `mat_name`, `mat_density`, `mat_elements` are present in canonical order (step 9 of canonicalization)
- [ ] `mat_elements` lists elements in ascending Z order
- [ ] `mat_ival` is omitted when the compound has no iValue
- [ ] `mat_phase=gas` is emitted only for gas-phase compounds; omitted for condensed
- [ ] All `mat_*` params are absent from the URL in Basic mode
- [ ] Round-tripping a URL containing a custom compound reproduces identical calculation results
- [ ] A compound name containing `&`, `=`, and spaces round-trips correctly

### AC-11: Shared URL — "from URL" banner

- [ ] Navigating to a URL with `material=custom` and valid `mat_*` params shows the "Compound from shared URL — Save to library / Edit & save copy / Dismiss" banner (three actions)
- [ ] Clicking "Save to library" runs full validation and adds the compound with a new UUID
- [ ] Clicking "Edit & save copy" opens the editor pre-filled with a deduplicated name; saving creates a new entry and dismisses the transient
- [ ] Clicking "Dismiss" keeps the compound active for the session but does not persist it
- [ ] A URL whose `mat_*` params fail validation offers "Edit & save copy", which opens the editor with the partial fields, an amber notice, and Save disabled until the flagged fields are fixed
- [ ] `matsrc=transient` is emitted only when the selected compound is an unsaved transient; the receiver banner copy reflects the unsaved provenance
- [ ] Invalid / incomplete `mat_*` params fall back to liquid water and show the warning banner

### AC-12: localStorage persistence

- [ ] Compounds survive page reload
- [ ] Compounds survive navigation between Calculator and Plot pages
- [ ] `localStorage` full on save → editor shows the full-storage error; no partial write

### AC-13: Export

- [ ] CSV filename includes `_custom` when a custom compound is active
- [ ] Advanced PDF metadata `MATERIAL` row shows "CompoundName (custom) — X g/cm³"
- [ ] Gas-phase custom compound shows "(custom, gas)" in the PDF MATERIAL row
- [ ] Advanced PDF includes elemental composition table (Element, Z, Atom count, Weight %) immediately below MATERIAL row
- [ ] Atom count column shows up to 4 significant figures
- [ ] Weight % column sums to 100.00% (rounded display)
- [ ] If an I-value override is stored, "I-value override: X eV (built-in Bragg additivity bypassed)" line appears below the composition table
- [ ] PMMA (C₅H₈O₂, density 1.20 g/cm³): PDF shows H 8 atoms 8.05%, C 5 atoms 59.99%, O 2 atoms 31.96% ± 0.01%

---

## Reactive Triggers Matrix

For every new reactive input this feature adds, the implementer must verify
that each ✅ cell has a wired `$effect` before declaring `TASK DONE`.

> **Plot columns apply to Advanced mode only.** Custom compounds are not
> rendered in the Plot entity panel in Basic mode (see §2.4). The ❌
> guard in "Calculator (Basic)" applies equally to the Plot page in Basic
> mode — no `$effect` tied to custom-compound state should fire while
> Basic mode is active on either page.

| Input / State                                   |                Calculator (Basic)                |         Calculator (Advanced)         | Plot preview (Adv. only) | Plot series (Adv. only) |      Multi-prog table       |
| ----------------------------------------------- | :----------------------------------------------: | :-----------------------------------: | :----------------------: | :---------------------: | :-------------------------: |
| Selected custom compound                        | ❌ (guarded — Basic mode hides custom compounds) |            ✅ recalculates            | ✅ recalculates preview  | ✅ recalculates series  | ✅ recalculates all columns |
| Compound formula / composition (on Save)        |       N/A (editor not accessible in Basic)       | ✅ recalculates if compound is active |            ✅            |           ✅            |             ✅              |
| `mat_density` (compound's stored density)       |                       N/A                        | ✅ recalculates if compound is active |            ✅            |           ✅            |             ✅              |
| `mat_ival` (compound's stored I-value override) |                       N/A                        | ✅ recalculates if compound is active |            ✅            |           ✅            |             ✅              |
| `mat_phase` (compound aggregate state)          |                       N/A                        | ✅ affects unit defaults + WASM call  |           N/A            |           N/A           |             N/A             |

Legend: ✅ = triggers recalculation / update; ❌ = guarded (must not
affect — applies to Basic mode on both Calculator and Plot pages);
N/A = not applicable to this context.

> **Note:** Density override, I-value override, and aggregate-state toggle in
> the Advanced Options panel are **disabled** when a custom compound is active
> (see AC-9 above). The compound's own stored values take precedence.

---

## Acceptance Scenarios

> These scenarios supplement the AC-1 – AC-13 checklist above.
> Each specifies a DOM observable with an explicit `data-testid` for Playwright.
> The implementer **must** add every listed `data-testid` attribute to the DOM.

### Scenario 1: Create LiF-pellet compound and verify CSDA range @smoke

**Given** the user is on `/calculator` with Advanced mode **on** and an
**alpha particle** (He-4) selected — the particle used in the LiF pellet
user story (5 MeV alpha, CSDA range verification)

**When** the user clicks `[data-testid="compound-add-btn"]`

**Then**

- DOM: `[data-testid="compound-editor-modal"]` is visible
- DOM: `[data-testid="compound-name-input"]` has focus

**When** the user fills in:

- Name = `"LiF-pellet"`
- Formula = `"LiF"` (Li: Z=3, count=1; F: Z=9, count=1)
- Density = `"2.20"` (cold-pressed pellet density, lower than bulk 2.635 g/cm³)

and clicks `[data-testid="compound-save-btn"]`

**Then**

- DOM: `[data-testid="compound-editor-modal"]` is no longer visible
- DOM: `[data-testid="compound-group"]` contains an item with text `"LiF-pellet"`

**When** the user selects `"LiF-pellet"` as the active material and enters
energy `"5"` MeV

**Then**

- The calculation fires and `[data-testid="result-table"]` shows a non-empty
  CSDA range value
- The range for 5 MeV alpha in LiF (ρ = 2.20 g/cm³) is physically plausible:
  the alpha particle stops well within the pellet (CSDA range < 1 mm)

```typescript
test("custom compound: create LiF-pellet and verify CSDA range @smoke", async ({ page }) => {
  // Navigate with Advanced mode on and alpha particle selected
  await page.goto("/calculator?advanced=1");
  // Select alpha (He-4) particle via entity selector
  // (implementation detail: select the alpha particle from the Particle combobox)

  await page.click('[data-testid="compound-add-btn"]');
  await expect(page.locator('[data-testid="compound-editor-modal"]')).toBeVisible();

  await page.fill('[data-testid="compound-name-input"]', "LiF-pellet");
  await page.fill('[data-testid="compound-formula-input"]', "LiF");
  await page.fill('[data-testid="compound-density-input"]', "2.20");
  await page.click('[data-testid="compound-save-btn"]');

  await expect(page.locator('[data-testid="compound-editor-modal"]')).not.toBeVisible();
  await expect(page.locator('[data-testid="compound-group"]')).toContainText("LiF-pellet");

  // Select LiF-pellet as the active material and enter 5 MeV
  // (implementation detail: click the LiF-pellet entry in compound-group,
  //  then type 5 in the energy input row)

  await expect
    .poll(
      async () => {
        const cell = await page.locator('[data-testid="csda-cell-0"]').textContent();
        return parseFloat(cell ?? "0");
      },
      { timeout: 10000 },
    )
    .toBeGreaterThan(0);
});
```

---

### Scenario 2: Create Custom Water compound and verify calculation @smoke

**Given** the user is on `/calculator` with Advanced mode **on** and Proton /
Water / PSTAR selected

**When** the user clicks `[data-testid="compound-add-btn"]`

**Then**

- DOM: `[data-testid="compound-editor-modal"]` is visible
- DOM: `[data-testid="compound-name-input"]` has focus

**When** the user fills in Name = `"TestH2O"`, formula = `"H2O"`,
density = `"1.0"`, and clicks `[data-testid="compound-save-btn"]`

**Then**

- DOM: `[data-testid="compound-editor-modal"]` is no longer visible
- DOM: `[data-testid="compound-group"]` contains an item with text `"TestH2O"`
- The calculation fires and `[data-testid="result-table"]` shows non-empty
  stopping-power values (the custom H₂O compound produces results within 2%
  of built-in water)

```typescript
test("custom compound: create H2O and see calculation @smoke", async ({ page }) => {
  await page.goto("/calculator?advanced=1&particle=1&material=276");
  await page.click('[data-testid="compound-add-btn"]');
  await expect(page.locator('[data-testid="compound-editor-modal"]')).toBeVisible();

  await page.fill('[data-testid="compound-name-input"]', "TestH2O");
  await page.fill('[data-testid="compound-formula-input"]', "H2O");
  await page.fill('[data-testid="compound-density-input"]', "1.0");
  await page.click('[data-testid="compound-save-btn"]');

  await expect(page.locator('[data-testid="compound-editor-modal"]')).not.toBeVisible();
  await expect(page.locator('[data-testid="compound-group"]')).toContainText("TestH2O");

  // Switch to the new compound and verify calculation fires
  // (entity-selection interaction — implementation detail)
  await expect
    .poll(
      async () => {
        const cell = await page.locator('[data-testid="stp-cell-0"]').textContent();
        return parseFloat(cell ?? "0");
      },
      { timeout: 10000 },
    )
    .toBeGreaterThan(0);
});
```

---

### Scenario 3: URL round-trip — compound survives reload

**Given** a custom compound named `"PMMA-custom"` (C₅H₈O₂, ρ = 1.20 g/cm³)
exists in `localStorage` and is the active material in Advanced mode

**When** the URL sync fires (≤ 500 ms after selection)

**Then**

- `window.location.search` contains `material=custom`
- `window.location.search` contains `mat_name=PMMA-custom`
- `window.location.search` contains `mat_density=1.2`
- `window.location.search` contains `mat_elements=` with elements in ascending Z order

**When** the user reloads the page

**Then**

- DOM: `[data-testid="compound-group"]` shows `"PMMA-custom"` as selected
- Stopping-power values reload correctly (same as before reload)
- DOM: `[data-testid="compound-from-url-banner"]` is **not** shown (compound
  already in library — only shown for unknown compounds from shared URLs)

---

### Scenario 4: Compound from shared URL — banner + save flow @regression

**Given** the user navigates to a URL with `material=custom&mat_name=LiF-pellet&mat_density=2.64&mat_elements=3:1,9:1`
and `"LiF-pellet"` is **not** in `localStorage`

**Then**

- DOM: `[data-testid="compound-from-url-banner"]` is visible with text
  containing `"LiF-pellet"`
- Calculation runs immediately with the URL-encoded compound values
- DOM: `[data-testid="result-table"]` shows non-empty results

**When** the user clicks "Save to library" in the banner

**Then**

- `localStorage.customCompounds` contains a new entry with `name: "LiF-pellet"`
- DOM: `[data-testid="compound-from-url-banner"]` is no longer visible
- DOM: `[data-testid="compound-group"]` contains `"LiF-pellet"`

---

### Scenario 5: Validation — invalid formula blocks Save @regression

**Given** the compound editor modal is open

**When** the user enters formula `"Xx2O"` (unrecognised element symbol `Xx`)
and clicks `[data-testid="compound-save-btn"]`

**Then**

- DOM: `[data-testid="compound-editor-modal"]` remains visible
- DOM: `[data-testid="compound-validation-error"]` is visible with text
  containing `"Unknown element"` or `"Xx"`
- No entry is added to `localStorage.customCompounds`

---

### Scenario 5b: Validation — density out of bounds blocks Save @regression

**Given** the compound editor modal is open with a valid name and formula

**When** the user enters density `"30"` (above the 25 g/cm³ maximum) and
clicks `[data-testid="compound-save-btn"]`

**Then**

- DOM: `[data-testid="compound-editor-modal"]` remains visible
- DOM: `[data-testid="compound-validation-error"]` is visible with text
  containing `"25"` (referencing the upper bound)
- No entry is added to `localStorage.customCompounds`

**When** the user corrects the density to `"2.20"` and clicks
`[data-testid="compound-save-btn"]`

**Then**

- DOM: `[data-testid="compound-editor-modal"]` is no longer visible
- `localStorage.customCompounds` contains the new entry

```typescript
test("custom compound: density > 25 blocks save @regression", async ({ page }) => {
  await page.goto("/calculator?advanced=1");
  await page.click('[data-testid="compound-add-btn"]');
  await expect(page.locator('[data-testid="compound-editor-modal"]')).toBeVisible();

  await page.fill('[data-testid="compound-name-input"]', "TooHeavy");
  await page.fill('[data-testid="compound-formula-input"]', "Fe");
  await page.fill('[data-testid="compound-density-input"]', "30");
  await page.click('[data-testid="compound-save-btn"]');

  // Modal must stay open with error
  await expect(page.locator('[data-testid="compound-editor-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="compound-validation-error"]')).toContainText("25");

  // Fix density and save successfully
  await page.fill('[data-testid="compound-density-input"]', "7.87");
  await page.click('[data-testid="compound-save-btn"]');
  await expect(page.locator('[data-testid="compound-editor-modal"]')).not.toBeVisible();
});
```

---

### Scenario 6: Custom compound created on Calculator is available on Plot page @regression

**Given** a custom compound `"PMMA-custom"` (C₅H₈O₂, ρ = 1.20 g/cm³) has
been created on the Calculator page and saved to `localStorage`

**When** the user navigates to the `/plot` page with Advanced mode **on**

**Then**

- DOM: `[data-testid="plot-compound-group"]` is present in the materials
  sidebar panel
- DOM: `[data-testid="plot-compound-group"]` contains an item with text
  `"PMMA-custom"`

**When** the user adds `"PMMA-custom"` as a plot series

**Then**

- The series appears in the series list
- The plot generates a curve with stopping-power data (non-empty)
- The series label shows `"PMMA-custom"` with the "(custom)" badge

**When** the user switches to **Basic mode** (via the mode toggle)

**Then**

- DOM: `[data-testid="plot-compound-group"]` is **absent from the DOM**
  (not merely hidden)
- The `"PMMA-custom"` series is removed from the series list

```typescript
test("custom compound: created on Calculator is available on Plot @regression", async ({
  page,
}) => {
  // Step 1: Create compound on Calculator page
  await page.goto("/calculator?advanced=1");
  await page.click('[data-testid="compound-add-btn"]');
  await page.fill('[data-testid="compound-name-input"]', "PMMA-custom");
  await page.fill('[data-testid="compound-formula-input"]', "C5H8O2");
  await page.fill('[data-testid="compound-density-input"]', "1.20");
  await page.click('[data-testid="compound-save-btn"]');
  await expect(page.locator('[data-testid="compound-editor-modal"]')).not.toBeVisible();

  // Step 2: Navigate to Plot page with Advanced mode preserved
  await page.goto("/plot?advanced=1");

  // Compound must appear in the Plot entity panel
  await expect(page.locator('[data-testid="plot-compound-group"]')).toBeVisible();
  await expect(page.locator('[data-testid="plot-compound-group"]')).toContainText("PMMA-custom");

  // Step 3: Add as series and verify curve renders
  // (implementation detail: click the PMMA-custom entry to add it as a series)

  await expect
    .poll(
      async () => {
        return page.locator('[data-testid="plot-series-list"] li').count();
      },
      { timeout: 10000 },
    )
    .toBeGreaterThan(0);

  // Step 4: Switch to Basic mode — custom compound group must disappear
  // (implementation detail: click the Basic/Advanced toggle)
  await expect(page.locator('[data-testid="plot-compound-group"]')).not.toBeAttached();
});
```

---

## Cross-Page Parity Checklist

> **Rule (from `.opencode/lessons-learned.md` Entry 3 and 9):** Custom Compounds
> affect both the Calculator page and the Plot page (a custom compound can be
> the selected material for a plot series). All four Advanced Mode pillars must
> be wired on **both** pages.

### Pages affected

- [src/routes/calculator/+page.svelte](../../src/routes/calculator/+page.svelte) —
  entity selection gains "Custom Compounds" group; `calculateCustomCompound()`
  replaces `calculate()` when a custom compound is active.
- [src/routes/plot/+page.svelte](../../src/routes/plot/+page.svelte) —
  series entity selection includes custom compounds; `getPlotDataCustomCompound()`
  used for the series curve.

### Required pillars (for each affected page)

| Pillar                                                                    | Calculator  | Plot        |
| ------------------------------------------------------------------------- | ----------- | ----------- |
| Panel gating (`isAdvancedMode.value` guard on custom-compound group)      | ✅ required | ✅ required |
| URL init (`material=custom` + `mat_*` parsed inside the URL `$effect`)    | ✅ required | ✅ required |
| Persistence (`material=custom` + `mat_*` emitted when compound is active) | ✅ required | ✅ required |
| Reactive-dep snapshot (read compound state before any `.then()`)          | ✅ required | ✅ required |

**Implementer contract:** Before declaring `TASK DONE`, verify every ✅ cell
above and confirm that the Reactive Triggers Matrix rows marked ✅ for Plot have
their corresponding `$effect` wired in `src/routes/plot/+page.svelte`.

---

## Stage 6.10 Preflight Addendum (Implementation Gate)

This section is the mandatory preflight gate for Stage 6.10 implementation work.

### 6.10.1 Acceptance scenarios (DOM-observable, Given/When/Then)

1. **Create**
   - **Given** Advanced mode on and compound editor closed
   - **When** user saves a valid new compound
   - **Then** `[data-testid="compound-editor-modal"]` closes and `[data-testid="compound-group"]` contains the new name.
2. **Edit**
   - **Given** existing custom compound row is visible
   - **When** user edits density/name and saves
   - **Then** row text updates in `[data-testid="compound-group"]` and active result cells in `[data-testid="result-table"]` change after recalculation.
3. **Duplicate**
   - **Given** existing custom compound row is visible
   - **When** user duplicates it and saves as a new entry
   - **Then** two distinct rows are visible (same or similar name allowed per duplicate-name policy) and stored IDs differ.
4. **Delete**
   - **Given** selected custom compound is active
   - **When** user confirms delete
   - **Then** row is removed from DOM and material falls back to built-in default; `material=custom` and all `mat_*` params are removed from URL.
5. **Select and use in Calculator**
   - **Given** at least one saved custom compound
   - **When** user selects it and enters energy
   - **Then** calculation path runs and result cells become non-empty numeric values.
6. **Persistence after reload**
   - **Given** saved custom compound is selected
   - **When** user reloads `/calculator` or `/plot`
   - **Then** compound remains available in selector and can be re-selected without re-creation.
7. **Referenced custom compound missing**
   - **Given** URL/state references a custom compound ID/name not present in storage
   - **When** page initializes
   - **Then** app falls back to built-in default material, renders `[data-testid="compound-from-url-banner"]` warning, and avoids crashes/stale selection DOM.

### 6.10.2 Data model (TypeScript-facing storage + references)

```typescript
type CustomCompoundId = `cc_${string}`; // new IDs: cc_ + uuidv7 (stable, opaque)

interface StoredCustomCompoundV1 {
  id: CustomCompoundId | string; // migration accepts legacy uuid v4 strings
  name: string; // display label, not unique
  normalizedName: string; // lowercased+trimmed+space-collapsed for duplicate detection
  elements: Array<{ atomicNumber: number; atomCount: number }>; // sorted by atomicNumber asc
  density: number; // g/cm³
  iValue?: number; // eV
  phase: "gas" | "condensed";
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

interface CustomCompoundStoreEnvelopeV1 {
  schemaVersion: 1;
  compounds: StoredCustomCompoundV1[];
}

type MaterialRef = { kind: "builtin"; id: number } | { kind: "custom"; id: string }; // persisted UI selection references by id
```

- **Stable ID strategy:** ID generated once at create-time; rename/edit never changes ID.
- **Name uniqueness:** names are not unique keys; duplicate names allowed with warning.
- **Duplicate-name policy:** case-insensitive + trim + collapsed-space comparison warns but does not block save.
- **URL/reference representation:** canonical URL uses `material=custom` + `mat_*` payload; persisted UI selection uses `{ kind:"custom", id }`.

### 6.10.3 Validation matrix

| Category         | Valid examples           | Invalid examples                     | Rule                                                |
| ---------------- | ------------------------ | ------------------------------------ | --------------------------------------------------- |
| Formula tokens   | `H2O`, `C5H8O2`, `LiF`   | `Xx2O`, `H0`, `C-1H4`                | Elements must resolve to Z 1..118 and counts > 0    |
| Weight fractions | `H=11.19, O=88.81`       | `H=50, O=30` (sum 80), `H=-1, O=101` | Sum must be 99.9..100.1; each fraction > 0          |
| Density          | `1.0`, `2.20`, `8.99e-5` | `0`, `-1`, `30`, `abc`               | finite, >0, ≤25                                     |
| I-value          | `74`, `150`, blank       | `0`, `-5`, `20000`, `abc`            | optional; if present finite, >0, ≤10000             |
| Duplicate names  | `PMMA` + `PMMA`          | N/A (warning-only)                   | Warn on normalized match; IDs keep entries distinct |

Normalization/canonicalization rules:

- Trim leading/trailing whitespace from name; collapse internal repeated spaces.
- Store `normalizedName = name.trim().replace(/\s+/g, " ").toLowerCase()`.
- Sort elements ascending by `atomicNumber` before persist/URL encode.
- Serialize numeric fields with `Number.toString()` (no locale formatting).

### 6.10.4 WASM boundary contract

Frontend-only (must **not** require new WASM behavior):

- CRUD, duplicate flow, local validation, name normalization.
- localStorage persistence/migration and missing-reference fallback UX.
- URL parse/encode for `mat_*` payload and warning banners.

Requires existing libdedx/WASM capability (must verify before implementation):

- Forward calculations for selected custom compound.
- Plot/inverse/custom lookup paths only if already exposed by current `LibdedxService`.

Mandatory rule for implementers:

- Verify capability from `docs/06-wasm-api-contract.md`, `src/lib/wasm/**`,
  interface + mocks + tests before coding.
- If capability is missing, stop and record as "requires new WASM contract change";
  do not invent or silently assume a new WASM function in Stage 6.10.

### 6.10.5 Persistence and migration

- **Primary key:** `localStorage["customCompounds"]` stores `CustomCompoundStoreEnvelopeV1`.
- **Schema key:** `schemaVersion` inside envelope (not separate key).
- **Migration expectation:** unknown/legacy shape migrates best-effort to v1; invalid rows are dropped with warning, never crash startup.
- **Rename semantics:** rename updates `name`, `normalizedName`, `updatedAt`; keeps `id` stable.
- **Deletion semantics:** remove by `id`; if deleted compound is selected/referenced, fallback to default built-in and clear stale custom reference.
- **Missing/deleted references (URL or persisted selection):**
  - show one-time warning banner,
  - fallback to built-in default material,
  - remove stale custom reference from persisted selection state on next save.
- **Backward compatibility:** accept legacy array-only storage by wrapping into v1 envelope.
- **Forward compatibility:** if `schemaVersion` is newer than supported, read-only fallback (do not mutate unknown fields), custom selection disabled with warning.

### 6.10.6 Test plan (coverage expectations)

- **Unit tests (required):**
  - data-model validation, normalization, migration transforms, duplicate-name warning logic.
- **Component tests (required):**
  - editor create/edit/duplicate/delete states, warning/error rendering, disabled-save conditions.
- **E2E smoke (`@smoke`, required minimal set):**
  - create + select + calculate,
  - persistence after reload,
  - missing-reference fallback flow.
- **E2E regression (`@regression`):**
  - edit, duplicate, delete edge cases,
  - URL round-trip and malformed `mat_*` recovery,
  - duplicate-name warning flow.
- **CI expectation:** smoke tests run on every PR; full regression remains in main E2E suite.

---

## Appendix: data-testid Reference

All `data-testid` attributes listed here **must** be added by the implementer.

| `data-testid` value         | Element                                                  | Notes                                                                          |
| --------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `compound-add-btn`          | "+ Add compound" button                                  | Absent from DOM in Basic mode                                                  |
| `compound-editor-modal`     | Editor modal container                                   | Hidden / removed when closed                                                   |
| `compound-name-input`       | Name text input                                          | Receives focus on modal open                                                   |
| `compound-formula-input`    | Formula text input (formula mode)                        | —                                                                              |
| `compound-density-input`    | Density number input                                     | —                                                                              |
| `compound-ival-input`       | I-value number input                                     | Optional field                                                                 |
| `compound-save-btn`         | Save / Create button                                     | Disabled when validation fails                                                 |
| `compound-validation-error` | Inline validation error message                          | Shown on invalid formula / missing fields / out-of-range density or atom count |
| `compound-sum-indicator`    | Weight-fraction sum indicator (weight-fraction mode)     | Error colour when sum ∉ [99.9, 100.1]%                                         |
| `compound-group`            | "Custom Compounds" group in entity selector (Calculator) | Absent from DOM in Basic mode                                                  |
| `plot-compound-group`       | "Custom" sub-list in the materials panel (Plot page)     | Absent from DOM in Basic mode                                                  |
| `compound-from-url-banner`  | "Compound from shared URL" banner                        | Shown only when compound is not in localStorage                                |
