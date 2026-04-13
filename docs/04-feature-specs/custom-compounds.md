# Feature: Custom Compounds

> **Status:** Draft v1 (13 April 2026)
>
> **v1** (13 April 2026): Initial draft — compound library (localStorage),
> compound editor (formula mode + weight-fraction mode), entity-selection
> integration, WASM `calculateCustomCompound()` wiring, Advanced Options
> interaction rules, URL encoding contract (`material=custom` + `ccomp_*`
> params, step 9 in canonicalization), round-trip URL guarantee, export
> metadata, validation rules, and acceptance checklist.
>
> **Related specs:**
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

## User Stories

**As a** researcher who uses PMMA as a tissue phantom in proton-beam
dosimetry,
**I want to** define PMMA (C₅H₈O₂, density 1.19 g/cm³) as a custom
compound and calculate its stopping power,
**so that** I can compare it with the built-in library entry and my own
measured values to verify agreement.

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
as a JSON array of `StoredCompound` objects:

```typescript
interface StoredCompound {
  /** Stable UUID v4 identifier. Generated at creation time. */
  id: string;
  /** Display name shown in the material selector (non-empty, ≤ 80 chars). */
  name: string;
  /**
   * Elemental composition.
   * atomCount is the number of atoms of this element per formula unit.
   * May be fractional (e.g. when derived from weight fractions).
   */
  elements: Array<{ atomicNumber: number; atomCount: number }>;
  /** Material density in g/cm³. Required and positive. */
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
  /** ISO 8601 creation/last-edit timestamp. */
  createdAt: string;
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

| Element | Detail |
|---------|--------|
| Group header | "Custom Compounds" — always visible in Advanced mode regardless of the active text filter |
| Compound entry | Name (bold) + density in g/cm³ (secondary text) + edit icon (✏) + delete icon (🗑) |
| Text filter | Filters custom compound entries by name (same filter input as built-in materials) |
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

When the app is in **Basic mode**, the "Custom Compounds" group and
"+ Add compound" button are **not rendered** (absent from the DOM, not
merely hidden). If a custom compound was the active material when the user
switches to Basic mode, the active material falls back to the default
(liquid water, ID 276). The custom compound selection is preserved in
memory and restored when Advanced mode is re-enabled.

---

## 3. Compound Editor

The compound editor is a **modal dialog** triggered by:
- "+ Add compound" → opens in **new** mode (blank form)
- ✏ edit icon on a saved compound → opens in **edit** mode (pre-filled)

### 3.1 Field summary

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| Name | Text input | Yes | Non-empty, ≤ 80 characters |
| Density | Numeric input + "g/cm³" label | Yes | > 0; accepts decimal and scientific notation |
| I-Value | Numeric input + "eV" label | No | If provided: > 0 and ≤ 10 000 eV |
| Phase | Two-option segmented control | Yes | Gas / Condensed; default Condensed |
| Input mode | Toggle | Yes | Formula / Weight fraction; default Formula |
| Element rows | Dynamic list (1–20 rows) | Yes | ≥ 1 valid row required |

### 3.2 Element rows — Formula mode

Each row contains:
- **Element selector** — typeahead accepting symbol ("H", "Fe"), full
  name ("hydrogen"), or atomic number ("1"→"26"). Resolves to Z on
  selection. Placeholder: "Symbol or Z"
- **Atom count input** — positive number (may be fractional, e.g. 1.5).
  Integers for standard stoichiometric compounds.
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

| Control | Behavior |
|---------|----------|
| **Save** | Validates all fields. On success: writes to `localStorage`, closes dialog, adds or updates the entry in the selector. If the edited compound is the currently selected material, recalculates immediately. |
| **Cancel** | Discards all changes; closes dialog without modifying `localStorage`. |
| **Delete** (edit mode only) | Shows a secondary confirmation: "Delete compound PMMA? This cannot be undone." Confirming removes from library and selector; if active material, falls back to last-used built-in material. |

**Duplicate name warning:** If the entered name matches an existing
compound (case-insensitive comparison), an inline warning is shown:
"A compound named 'X' already exists." The user may proceed — names are
not unique keys (IDs are). The warning does not block saving.

---

## 4. Validation Rules

### 4.1 Name

| Rule | Error message |
|------|---------------|
| Non-empty after trimming | "Name is required." |
| ≤ 80 characters | "Name must be 80 characters or fewer." |

### 4.2 Density

| Rule | Error message |
|------|---------------|
| Non-empty and parses as a finite number | "Density is required." |
| > 0 | "Density must be greater than zero." |

Accepts decimal (`1.19`) and scientific notation (`8.99e-5`).

### 4.3 I-Value (optional)

| Rule | Error message |
|------|---------------|
| If provided: parses as finite positive number | "I-value must be a positive number." |
| If provided: ≤ 10 000 eV | "I-value must be ≤ 10 000 eV." |

Blank → field cleared; `iValue` absent from stored compound.

### 4.4 Elements — both modes

| Rule | Error message |
|------|---------------|
| At least 1 row | "At least one element is required." |
| Each element resolves to a valid Z ∈ [1, 118] | "Unknown element: 'X'." |
| No duplicate Z values | "Element Z is listed more than once. Combine into a single row." |
| Each atom count/weight % > 0 | "Count must be greater than zero." |

### 4.5 Weight fractions only

| Rule | Error message / indicator |
|------|--------------------------|
| Sum ∈ [99.9, 100.1] | Live indicator shows current total; Save disabled outside this range |

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
    elements: stored.elements,  // [{ atomicNumber, atomCount }, ...]
    density: stored.density,
    iValue: stored.iValue,       // undefined when not set
  },
  energies,  // in MeV/nucl (converted from user's chosen unit)
});
```

The WASM implementation allocates a `dedx_config` workspace, writes
`elements_id` and `elements_atoms` arrays, sets the density and (if
provided) the I-value override, evaluates, and frees the workspace.

### 5.2 Program compatibility

Custom compounds are offered for **all programs** in the selector — there
is no pre-filtering. Some programs may not support custom compound
definitions at runtime. If `calculateCustomCompound()` throws a
`LibdedxError`, the error is displayed inline using the standard error
display rules (human-friendly message with a "Show details" toggle
revealing the C error code). The error for one program in multi-program
mode does not abort the others.

### 5.3 Interaction with the Advanced Options panel

The `calculateCustomCompound()` signature does not accept `AdvancedOptions`.
Material-level overrides that would normally go through `AdvancedOptions`
are replaced by the compound's own fields. The Advanced Options panel
remains visible in Advanced mode, but certain controls are **disabled**
(not hidden) when a custom compound is the active material:

| Advanced Options control | Behaviour with custom compound |
|--------------------------|-------------------------------|
| Density override | **Disabled.** Tooltip: "Density is set in the compound definition." |
| I-value override | **Disabled.** Tooltip: "Override the compound's I-value in the compound editor." |
| Aggregate state toggle | **Disabled.** Tooltip: "Phase is set in the compound definition." |
| Interpolation scale / method | **Active.** Spline interpolation operates at the JS level and is fully compatible with custom compounds. |
| MSTAR mode | **Active.** MSTAR mode is a program-level setting and is unaffected by the material type. |

### 5.4 Default display unit

The custom compound's `phase` field drives the default stopping-power
display unit, exactly as the built-in `isGasByDefault` flag does:

| Compound phase | Default display unit |
|----------------|---------------------|
| `"condensed"` | keV/µm |
| `"gas"` | MeV·cm²/g |

---

## 6. URL Encoding

Custom compound parameters are emitted only in **Advanced mode** and only
when a custom compound is the **active material**. When a built-in
material is active, the existing numeric `material=<id>` rule applies
unchanged.

### 6.1 Proposed ABNF extension

> **Note:** The following grammar fragments extend
> [`shareable-urls-formal.md`](shareable-urls-formal.md). That document
> should be updated to v6 when this spec is finalized.

```abnf
; material-pair extended to accept "custom" sentinel
material-pair       = "material=" (int-pos / "custom")

; custom compound params — only valid when material=custom and mode=advanced
ccomp-name-pair     = "ccomp_name=" value
                    ; value is percent-encoded via standard URLSearchParams
ccomp-density-pair  = "ccomp_density=" number
                    ; number must be > 0; scientific notation allowed (e.g. 8.99e-5)
ccomp-elements-pair = "ccomp_elements=" ccomp-element *("," ccomp-element)
ccomp-element       = int-pos ":" number
                    ; int-pos is atomic number Z ∈ [1, 118]
                    ; number is atom count > 0 (may be fractional)
ccomp-ival-pair     = "ccomp_ival=" number
                    ; number must be > 0 and ≤ 10000; omitted when no iValue
ccomp-phase-pair    = "ccomp_phase=" ("gas" / "condensed")
                    ; omitted when "condensed" (default)
```

These new pair types are added to the `pair` alternation in the ABNF.

### 6.2 Canonicalization — step 9

After step 8 (inverse-lookup params), emit custom compound params if and
only if `mode=advanced` and `material=custom`:

**Step 9 — Custom compound params** (in this sub-order):

a. `ccomp_name` — always emitted (percent-encoded)  
b. `ccomp_density` — always emitted; serialized via `Number.prototype.toString()` (decimal or scientific notation per ECMAScript rules)  
c. `ccomp_elements` — always emitted; elements ordered by **ascending Z**; atom counts serialized via `Number.prototype.toString()`  
d. `ccomp_ival` — omitted when absent; otherwise emitted as decimal eV value  
e. `ccomp_phase` — omitted when `"condensed"` (default); emitted as `"gas"` otherwise

### 6.3 Conditional enablement

- `material=custom` and all `ccomp_*` params are **silently ignored** when
  `mode != advanced` (consistent with §3.5 of `shareable-urls-formal.md`).
- When `material=custom` is present without the required `ccomp_*` params,
  fall back to the default material (liquid water, ID 276) and show a
  one-time warning banner: "Custom compound data missing from URL —
  switched to Liquid Water."
- Receiving a URL with `material=custom` does **not** automatically save
  the compound to the local library.

### 6.4 Round-trip URL guarantee

When a URL contains `material=custom` with all required `ccomp_*` params:

1. A transient `StoredCompound` object is reconstructed from the URL.
2. It is selected as the active material.
3. A dismissible banner is shown: **"Compound from shared URL — [Save to
   library] [Dismiss]"**. Clicking "Save to library" runs the same
   validation as the editor and (on success) adds the compound with a
   new UUID. Dismissing keeps it active for the session only.

### 6.5 Parse validation

| Condition | Recovery |
|-----------|----------|
| `ccomp_name` missing or empty | Fall back to default material; show warning |
| `ccomp_density` missing, ≤ 0, or non-numeric | Fall back to default material; show warning |
| `ccomp_elements` missing or all elements invalid | Fall back to default material; show warning |
| Individual invalid Z (outside [1, 118]) | Drop that element; if at least one valid element remains, proceed |
| Individual invalid atom count (≤ 0) | Drop that element; same recovery |
| Duplicate Z in URL | Collapse by summing counts |
| `ccomp_ival` out of range | Silently ignore; proceed without iValue |
| `ccomp_phase` unknown token | Silently ignore; default to `"condensed"` |

### 6.6 Example URLs

**Basic custom compound — PMMA:**
```
?urlv=1&particle=1&material=custom&energies=100&eunit=MeV
&mode=advanced&programs=9&qfocus=both
&ccomp_name=PMMA&ccomp_density=1.19&ccomp_elements=1:8,6:5,8:2
```
(elements ordered by ascending Z: H=1, C=6, O=8)

**Custom water with gas phase:**
```
?urlv=1&particle=1&material=custom&energies=100&eunit=MeV
&mode=advanced&programs=9&qfocus=both
&ccomp_name=Custom%20Water&ccomp_density=1.0&ccomp_elements=1:2,8:1
&ccomp_phase=gas
```

---

## 7. localStorage Schema

```json
{
  "customCompounds": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "PMMA",
      "elements": [
        { "atomicNumber": 1, "atomCount": 8 },
        { "atomicNumber": 6, "atomCount": 5 },
        { "atomicNumber": 8, "atomCount": 2 }
      ],
      "density": 1.19,
      "iValue": null,
      "phase": "condensed",
      "createdAt": "2026-04-13T10:00:00Z"
    },
    {
      "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "name": "Borated PE",
      "elements": [
        { "atomicNumber": 1, "atomCount": 2.0 },
        { "atomicNumber": 5, "atomCount": 0.0435 },
        { "atomicNumber": 6, "atomCount": 1.0 }
      ],
      "density": 0.95,
      "iValue": null,
      "phase": "condensed",
      "createdAt": "2026-04-13T11:30:00Z"
    }
  ]
}
```

Elements are stored in ascending Z order. Fractional atom counts (from
weight-fraction input) are stored as-is without rounding.

---

## 8. Export Behavior

### 8.1 CSV export

Column headers are unchanged. The material identifier in the filename and
any header rows uses the compound name suffixed with `(custom)`:

| Context | Value |
|---------|-------|
| CSV filename | `dedx_PMMA_custom_proton_…` |
| Material column header | `PMMA (custom)` |

### 8.2 PDF export (advanced mode metadata block)

The `MATERIAL` row shows the compound name, "(custom)" marker, and
density:

```
MATERIAL:   PMMA (custom) — 1.19 g/cm³
```

The full elemental composition is not listed in the PDF metadata block
(to keep it concise). Phase is not shown unless it is Gas (in which case
"(gas)" is appended after "custom").

---

## 9. Edge Cases

| Scenario | Behaviour |
|----------|-----------|
| Custom compound active → user switches to Basic mode | Material reverts to default (liquid water). Custom compound selection held in memory. Switching back to Advanced mode restores it. URL in Basic mode never contains `material=custom`. |
| User deletes the currently selected compound | Falls back to the last-used built-in material (or liquid water if none). Toast: "Compound 'X' deleted — switched to Liquid Water." |
| User edits the currently selected compound | Recalculates immediately on save using the updated definition. URL updates to reflect new `ccomp_*` params. |
| Multi-program mode with a custom compound | Each program calls `calculateCustomCompound()` independently. One program's runtime error does not suppress others. |
| Custom compound selected on Plot page | `getPlotDataCustomCompound()` or equivalent is used to generate the dense energy grid. The series label shows the compound name with the "(custom)" badge. |
| Compound name contains `&`, `=`, `%` | Percent-encoded in the URL via `encodeURIComponent`. Decoded transparently on parse. |
| `localStorage` quota exceeded on save | Editor shows: "Cannot save: browser storage is full. Delete unused compounds first." The new compound is not persisted. |
| WASM call fails for custom compound | Error displayed inline (human-friendly message, "Show details" for C error code). Result cells show "—". Other programs in multi-program mode are unaffected. |
| URL parsed in Basic mode contains `material=custom` | `ccomp_*` params silently dropped; material defaults to liquid water. No warning shown (Basic-mode URL is expected to lack advanced params). |
| Two elements with same Z entered by user | Editor shows inline error on the duplicate row; Save blocked. |

---

## Open Questions

1. **`getPlotDataCustomCompound()`** — The WASM contract defines
   `calculateCustomCompound()` but not a plot-data equivalent. The
   implementation will need a dense-grid variant (analogous to
   `getPlotData()`) or repeated `calculateCustomCompound()` calls over
   the log-spaced grid. This should be resolved in the WASM contract
   before Stage 3.

2. **MSTAR + custom compound** — Whether MSTAR supports the `dedx_config`
   custom-compound path is unknown at spec time. If MSTAR rejects the
   call, the runtime error path (§5.2) handles it gracefully. The
   implementation notes for Stage 3 should verify this.

3. **Inverse lookups + custom compound** — The
   `getInverseStp()` / `getInverseCsda()` WASM contract methods take a
   numeric `materialId`, not a `CustomCompound`. Custom compound support
   for inverse-lookup tabs is **deferred to a future spec revision**. For
   now, the inverse tabs show "Not available for custom compounds" when a
   custom compound is the active material.

---

## Acceptance Checklist

### AC-1: Visibility gating
- [ ] "Custom Compounds" group is absent from the DOM in Basic mode
- [ ] "+ Add compound" button is absent from the DOM in Basic mode
- [ ] Switching Basic → Advanced mode does not restore the custom compound group if Advanced mode had never been activated
- [ ] Switching Advanced → Basic mode when a custom compound is active reverts the active material to liquid water and clears `material=custom` from the URL

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
- [ ] I-value ≤ 0 blocks Save when field is non-empty
- [ ] I-value > 10 000 eV blocks Save
- [ ] Element with Z outside [1, 118] shows "Unknown element" error and blocks Save
- [ ] Duplicate Z in two rows shows inline error on the second row and blocks Save
- [ ] Atom count ≤ 0 blocks Save

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

### AC-8: Calculation
- [ ] Selecting a custom compound calls `calculateCustomCompound()` with the correct `programId`, `particleId`, `compound`, and `energies`
- [ ] H₂O custom compound (density 1.0 g/cm³, no iValue) produces stopping powers within 2% of built-in liquid water (ID 276) for protons at 100 MeV/nucl in PSTAR
- [ ] WASM error for a custom compound is displayed inline without aborting other calculations in multi-program mode

### AC-9: Advanced Options interaction
- [ ] Density override field is disabled and shows the tooltip when a custom compound is active
- [ ] I-value override field is disabled and shows the tooltip when a custom compound is active
- [ ] Aggregate state toggle is disabled and shows the tooltip when a custom compound is active
- [ ] Spline interpolation (interpolation method = spline) still produces results when a custom compound is active
- [ ] MSTAR mode selection takes effect when MSTAR program is selected with a custom compound

### AC-10: URL encoding
- [ ] `material=custom` appears in the URL when a custom compound is active in Advanced mode
- [ ] `ccomp_name`, `ccomp_density`, `ccomp_elements` are present in canonical order (step 9 of canonicalization)
- [ ] `ccomp_elements` lists elements in ascending Z order
- [ ] `ccomp_ival` is omitted when the compound has no iValue
- [ ] `ccomp_phase=gas` is emitted only for gas-phase compounds; omitted for condensed
- [ ] All `ccomp_*` params are absent from the URL in Basic mode
- [ ] Round-tripping a URL containing a custom compound reproduces identical calculation results
- [ ] A compound name containing `&`, `=`, and spaces round-trips correctly

### AC-11: Shared URL — "from URL" banner
- [ ] Navigating to a URL with `material=custom` and valid `ccomp_*` params shows the "Compound from shared URL — Save to library / Dismiss" banner
- [ ] Clicking "Save to library" runs full validation and adds the compound with a new UUID
- [ ] Clicking "Dismiss" keeps the compound active for the session but does not persist it
- [ ] Invalid / incomplete `ccomp_*` params fall back to liquid water and show the warning banner

### AC-12: localStorage persistence
- [ ] Compounds survive page reload
- [ ] Compounds survive navigation between Calculator and Plot pages
- [ ] `localStorage` full on save → editor shows the full-storage error; no partial write

### AC-13: Export
- [ ] CSV filename includes `_custom` when a custom compound is active
- [ ] Advanced PDF metadata `MATERIAL` row shows "CompoundName (custom) — X g/cm³"
- [ ] Gas-phase custom compound shows "(custom, gas)" in the PDF MATERIAL row
