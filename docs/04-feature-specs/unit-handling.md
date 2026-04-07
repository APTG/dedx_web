# Feature: Unit Handling

> **Status:** Draft v2 (7 April 2026)
>
> This spec covers energy unit selection, SI prefix handling, inline unit
> detection from typed text, and output unit conversion for stopping power
> and CSDA range. It is referenced by [`calculator.md`](calculator.md) and
> will be referenced by `plot.md`.
>
> **Origin:** Energy unit logic was initially inline in `calculator.md` v1–v2.
> Extracted here in calculator.md v3 to give it a dedicated home.
>
> **v2** (7 April 2026): Major rewrite. Per-row unit detection replaces
> master-level auto-switch. Filled in output unit handling (§5) and SI
> prefix auto-scaling (§6). Default stopping power unit is keV/µm for
> non-gas materials, MeV·cm²/g for gases. CSDA range defaults to
> auto-scaled length units (cm, mm, µm, nm). Added unrecognized unit
> suffix error handling. Added per-row ↔ master unit mode logic.
> Added "Reset to single unit" advanced feature.

---

## User Story

**As a** radiation physicist,
**I want to** type energy values with familiar units (e.g., "250 keV",
"1.5 GeV/nucl") and have the app understand them automatically,
**so that** I don't have to mentally convert between SI prefixes or
remember to change a unit selector first.

**As a** student,
**I want to** see results in human-readable units (mm instead of 0.001 m,
µm instead of 0.001 mm),
**so that** the numbers make intuitive sense without manual conversion.

---

## 1. Design Principles

Refer to `docs/01-project-vision.md` §4.1 ("Correct and Clear Units")
for overarching principles. Key points restated here for convenience:

- Energy input must have an explicit, always-visible unit selector.
- Available input unit options depend on the selected particle.
- Output values auto-scale to human-readable SI prefixes.
- MeV/nucl ≠ MeV/u — the distinction matters for precision CSDA range work.
- Per-row output units scale independently (each row picks its own best prefix).

---

## 2. Energy Unit Selector — Particle-Dependent Options

The **master energy unit selector** (segmented control / radio buttons) shows
different options depending on the **selected particle type**. For ions,
the mass number (A) from `ParticleEntity.massNumber` determines the options;
for the electron (ID 1001), only MeV is available (per-nucleon units are
meaningless for leptons).

The derivation chain is:

```
EntitySelectionState.particle      // ParticleEntity — covers ions and electron
  → particle.id + particle.massNumber (A)
  → determine available energy units (see Rules table)
  → update segmented control options
```

### Rules

| Particle type | Available units | Rationale |
|--------------|----------------|-----------|
| **Proton** (A = 1) | **MeV** only | MeV/nucl is numerically identical to MeV when A=1; showing it adds clutter without value. |
| **Electron** (particle ID 1001) | **MeV** only | MeV/nucl and MeV/u are meaningless for leptons (nucleon count is undefined). |
| **Heavy ions** (A > 1) | **MeV**, **MeV/nucl** | Both are commonly used. MeV/nucl = E_total / A. |
| **Heavy ions, advanced mode** | **MeV**, **MeV/nucl**, **MeV/u** | MeV/u = E_total / m_u (atomic mass in daltons). Matters for precision CSDA range. Advanced-mode toggle TBD. |

### Master vs. Per-Row Mode

The master unit selector operates in two modes:

| Mode | Condition | Master selector state | How rows get their unit |
|------|-----------|----------------------|------------------------|
| **Master mode** (default) | No row has an explicit typed unit suffix | **Active** — user can click to change | All rows use the master unit |
| **Per-row mode** | At least one row has a typed unit suffix (e.g., "10 keV") | **Greyed out / disabled** | Each row has its own unit dropdown |

Transition from master → per-row: happens automatically when the user types
a recognized unit suffix on any row (see §3).

Transition from per-row → master: only via the **"Reset to single unit"**
button in the Advanced section (see §7).

### Unit Preservation on Particle Change

When the user changes the selected particle and the previously selected unit is no longer
available (e.g., switching from Carbon with "MeV/nucl" selected to
Proton where only "MeV" is available):

1. The master unit selector resets to **MeV** (always available).
2. The input values are **not modified** — numeric values stay the same.
3. Values are reinterpreted as MeV, triggering recalculation.
4. If per-row mode is active and any row has a per-nucleon unit that is
   no longer available (e.g., MeV/nucl for a proton), that row's unit
   resets to MeV and a validation message is shown.
5. No explicit notification is needed for the master selector — the visual
   update is sufficient feedback.

---

## 3. Inline Unit Detection (Unit-from-Text)

Users may type energy values with a unit suffix. The parser detects these
suffixes **per row** and assigns each row its own unit.

### Supported Suffixes

| Suffix (case-insensitive) | Resolved base unit | SI prefix multiplier |
|---------------------------|-------------------|---------------------|
| `eV` | MeV | ×1e-6 |
| `keV` | MeV | ×1e-3 |
| `MeV` | MeV | ×1 |
| `GeV` | MeV | ×1e3 |
| `MeV/nucl` | MeV/nucl | ×1 |
| `GeV/nucl` | MeV/nucl | ×1e3 |
| `keV/nucl` | MeV/nucl | ×1e-3 |
| `MeV/u` | MeV/u | ×1 |
| `GeV/u` | MeV/u | ×1e3 |
| `keV/u` | MeV/u | ×1e-3 |

### Per-Row Parsing Rules

1. After the debounce timer fires (same 300ms as calculation debounce),
   scan each row for a trailing unit suffix.
2. A suffix is recognized when separated from the number by optional
   whitespace: `100 keV`, `100keV`, `100 MeV/nucl` all match.
3. Each row is parsed **independently**. Different rows may have different
   units — this is fully supported (not an error).

4. **Row with a recognized suffix:**
   - The row's unit is set to the detected base unit.
   - The per-row unit dropdown shows the detected unit.
   - The numeric value is the number before the suffix, multiplied by the
     SI prefix multiplier. E.g., `100 keV` → value 100, unit keV,
     normalized to 0.1 MeV for display in the "→ MeV/nucl" column.
   - The suffix is **not stripped** from the user's typed text — it remains
     visible. The user sees exactly what they typed. The parsed value and
     unit are shown in the adjacent columns.

5. **Row with an unrecognized suffix:**
   - If the text after a number does not match any supported suffix
     (e.g., `100 bebok`), the row is treated as **invalid**.
   - Validation summary shows: "Line N: unrecognized unit 'bebok'".
   - The row is excluded from calculation.

6. **Row without any suffix** (plain number, e.g., `100`):
   - In **master mode**: the row uses the master unit selector's value.
   - In **per-row mode**: the row uses the master unit's last value
     before per-row mode was activated. The per-row unit dropdown shows
     this inherited unit and the user can change it via the dropdown.

7. **Entering per-row mode:**
   - When the first row with a recognized suffix is detected, the system
     switches from master mode to per-row mode.
   - The master unit selector becomes **greyed out / disabled**.
   - All rows without a suffix inherit the current master unit value
     and gain their own per-row unit dropdowns.
   - Each row's per-row dropdown is initialized to its detected or
     inherited unit.

8. **Per-row unit dropdown changes:**
   - In per-row mode, each row shows a small unit dropdown next to the
     parsed value. Changing the dropdown reinterprets that row's numeric
     value in the new unit.
   - This is a dropdown (not segmented control) since per-row space is
     limited and the minimum-clicks principle does not apply to this
     secondary interaction.

9. **Editing a suffix in an existing row:**
   - If the user changes `10 MeV` to `10 keV` (by editing the text),
     the parser re-detects the suffix on debounce and updates the row's
     unit dropdown to keV automatically.
   - If the user removes the suffix entirely (e.g., `10 MeV` → `10`),
     the row reverts to the inherited master unit.
   - If this was the last row with an explicit suffix, the system
     switches back to master mode and re-enables the master selector.

### Edge Cases

- A line containing only a unit suffix with no number (e.g., "MeV") is
  treated as invalid input, not a unit detection trigger.
- If a row's detected base unit is not available for the current particle
  (e.g., user types "100 MeV/nucl" with Proton selected), show a validation
  message on that row: "MeV/nucl is not available for Proton (A=1)."
  The row is excluded from calculation.
- Unit detection does not fire if the input is populated from URL
  parameters (URL values use explicit unit encoding — see calculator.md
  URL State Encoding).

---

## 4. Conversion Formulas

All conversions use the particle's `massNumber` (A) and `atomicMass` (m_u)
from `ParticleEntity`. **Note:** These conversions apply only to ions (A ≥ 1);
electrons use MeV exclusively, so no per-nucleon conversion is needed.

| From | To | Formula |
|------|----|---------|
| MeV | MeV/nucl | E_nucl = E_total / A |
| MeV | MeV/u | E_u = E_total / m_u |
| MeV/nucl | MeV | E_total = E_nucl × A |
| MeV/nucl | MeV/u | E_u = E_nucl × A / m_u |
| MeV/u | MeV | E_total = E_u × m_u |
| MeV/u | MeV/nucl | E_nucl = E_u × m_u / A |

These are implemented by `LibdedxService.convertEnergy()` (pure JS, no
WASM call). See `docs/06-wasm-api-contract.md` §3.

---

## 5. Output Unit Handling

### 5.1 Stopping Power — Default Unit

The C API outputs mass stopping power in **MeV·cm²/g**. The default
display unit depends on the selected material's phase:

| Material phase | Default stopping power unit | Rationale |
|----------------|---------------------------|-----------|
| **Solid or liquid** | **keV/µm** | Most intuitive for condensed-phase materials (medical physics, shielding). Directly gives energy deposited per micrometre of traversal. |
| **Gas** | **MeV·cm²/g** | keV/µm is misleading for gases at varied pressures (density-dependent). Mass stopping power is pressure-independent and standard for gases. |

The material phase is determined from `MaterialEntity.isGasByDefault`:
- `true` → gas → MeV·cm²/g default.
- `false` or `undefined` → solid/liquid → keV/µm default.

**Phase notification:** When a material is selected, show a subtle
indicator next to the material name: "💧 liquid", "ite solid", or
"💨 gas". This informs the user at a glance and explains why the stopping
power unit may change when switching materials.

> **Future:** Users should be able to override the default and switch
> between keV/µm, MeV/cm, and MeV·cm²/g via a dropdown in the column
> header. For v1, only the automatic default is shown.

### 5.2 Stopping Power — Conversion

Converting from MeV·cm²/g (mass stopping power) to linear stopping power
(keV/µm or MeV/cm) requires the material density ρ (g/cm³):

| From | To | Formula |
|------|----|---------|
| MeV·cm²/g | MeV/cm | S_linear = S_mass × ρ |
| MeV·cm²/g | keV/µm | S_kevum = S_mass × ρ × 10 |
| MeV/cm | keV/µm | S_kevum = S_linear × 1e-1 |

Where ρ = `LibdedxService.getDensity(materialId)`.

The conversion is pure JS — multiply each `CalculationResult.stoppingPowers[i]`
by ρ × 10 (for keV/µm) or by ρ (for MeV/cm).

### 5.3 CSDA Range — Default Unit

The C API outputs CSDA range in **g/cm²** (mass-thickness). The default
display unit is **length** — converted from g/cm² using material density:

$$\text{range\_cm} = \frac{\text{range\_gcm2}}{\rho}$$

The resulting length is then auto-scaled to the best SI prefix (see §6).
This applies to **all materials, including gases** — the user always sees
a physical distance.

> **Rationale:** Physicists think about how far a particle travels in
> centimetres (or millimetres, micrometres), not in areal density. Even
> for gases, the length at standard density is informative.

### 5.4 CSDA Range — Conversion

| From | To | Formula |
|------|----|---------|
| g/cm² | cm | range_cm = range_gcm2 / ρ |
| cm | mm | range_mm = range_cm × 10 |
| cm | µm | range_µm = range_cm × 1e4 |
| cm | nm | range_nm = range_cm × 1e7 |
| cm | m | range_m = range_cm / 100 |

Where ρ = `LibdedxService.getDensity(materialId)`.

---

## 6. SI Prefix Auto-Scaling (Output)

Output values are auto-scaled to the most human-readable SI prefix.
Each row picks its prefix **independently** — rows with different
magnitudes may show different prefixes.

### Length Auto-Scaling (CSDA Range)

After converting from g/cm² to cm (§5.4), select the best prefix:

| Value range (cm) | Display unit | Example |
|-------------------|-------------|---------|
| ≥ 100 | m | 1.234 m |
| ≥ 0.1 | cm | 1.234 cm |
| ≥ 0.01 | mm | 1.234 mm |
| ≥ 1e-5 | µm | 1.234 µm |
| < 1e-5 | nm | 1.234 nm |

The rule: choose the prefix where the displayed number is in the range
**1.000 – 9999** (i.e., 1 to 4 digits before the decimal point).

### Stopping Power Display

When the default is keV/µm (non-gas materials), no auto-scaling is needed —
keV/µm is already the standard unit for condensed-phase stopping power
in medical physics.

When the default is MeV·cm²/g (gas materials), no auto-scaling is applied
either — MeV·cm²/g is the standard unit.

> **Future:** If user-selectable output units are added, auto-scaling
> within the chosen unit family (e.g., eV/µm → keV/µm → MeV/µm) could
> be considered.

### Number Formatting

All output values (stopping power and CSDA range) use **4 significant
figures** with SI prefix auto-scaling. **Scientific notation is not used
for output** — SI prefixes replace it.

Examples:
- `0.0001234 cm` → `1.234 µm` (not `1.234e-4 cm`)
- `12340 cm` → `123.4 m` (not `1.234e+4 cm`)
- `45.76 keV/µm` → `45.76 keV/µm` (no scaling needed)

For **input** values, scientific notation is accepted and displayed as
entered (e.g., `1.5E-2` stays as `1.5E-2` in the typed text).

---

## 7. "Reset to Single Unit" (Advanced)

In the Advanced options section, a **"Reset to single unit"** button is
available when per-row mode is active. Clicking it:

1. Converts all row values to the **current master unit** (MeV by default).
   Each row's numeric value is recalculated from its per-row unit to the
   master unit. E.g., a row with "100 keV" becomes "0.1" (in MeV).
2. **Strips all unit suffixes** from the typed text — each row becomes a
   plain number.
3. Clears all per-row unit dropdowns.
4. Re-enables the master unit selector.
5. The system returns to **master mode**.

This is a **destructive operation** — the original typed text (with
suffixes) is replaced. A confirmation is not needed since the values are
preserved numerically (just re-expressed in the master unit).

---

## Dependencies

- **`ParticleEntity.massNumber`** and **`ParticleEntity.atomicMass`** from the
  WASM API contract (`docs/06-wasm-api-contract.md`)
- **`MaterialEntity.isGasByDefault`** and **`MaterialEntity.density`** from the
  WASM API contract — needed for output unit defaults and conversions
- **`LibdedxService.convertEnergy()`** for energy unit conversions
- **`LibdedxService.getDensity()`** for stopping power and range conversion
- **`LibdedxService.convertStpUnits()`** for stopping power unit conversion
  (via C library `convert_units()`)
- **`EnergyUnit`**, **`StpUnit`**, **`RangeUnit`** types from the API contract
- Energy unit selector widget in calculator and plot pages

---

## Acceptance Criteria

### Energy Unit Selector (particle-dependent)
- [ ] Available units depend on the selected particle type (from `ParticleEntity.id` and `ParticleEntity.massNumber`).
- [ ] Proton (A=1): only MeV shown.
- [ ] Electron (particle ID 1001): only MeV shown.
- [ ] Heavy ions (A>1): MeV and MeV/nucl shown.
- [ ] Changing particle resets unit to MeV if the previous unit is no longer available.

### Master vs. Per-Row Mode
- [ ] When all rows are plain numbers (no suffix), the master selector is active.
- [ ] Typing a recognized unit suffix on any row disables the master selector and shows per-row unit dropdowns on all rows.
- [ ] Removing all unit suffixes (so no row has one) re-enables the master selector.
- [ ] In per-row mode, each row's dropdown reflects its detected or inherited unit.
- [ ] Changing a row's dropdown reinterprets that row's value in the new unit.

### Inline Unit Detection
- [ ] Typing `10 MeV` on row 1 and `10 keV` on row 2 results in per-row mode. Row 1 shows "MeV" in its dropdown, row 2 shows "keV". The "→ MeV/nucl" column shows 10 and 0.01 respectively.
- [ ] Editing `10 MeV` to `10 keV` on a row updates that row's dropdown to keV automatically after debounce.
- [ ] Typing `100 bebok` marks the row as invalid: "Line N: unrecognized unit 'bebok'". The row is excluded from calculation.
- [ ] A line with only a unit suffix and no number (e.g., "MeV") is treated as invalid input.
- [ ] A row with a per-nucleon unit (e.g., "10 MeV/nucl") for a proton or electron shows a validation error.
- [ ] Unit detection does not fire on URL-populated input.

### Output — Stopping Power
- [ ] Default stopping power unit is keV/µm for non-gas materials.
- [ ] Default stopping power unit is MeV·cm²/g for gas materials.
- [ ] Switching from a solid/liquid material to a gas material changes the stopping power unit and recalculates.
- [ ] Material phase is indicated next to the material name (gas/solid/liquid badge).

### Output — CSDA Range
- [ ] CSDA range is displayed in length units (converted from g/cm² using material density).
- [ ] Each row independently auto-scales to the best SI prefix (nm, µm, mm, cm, m).
- [ ] The auto-scaling rule places the displayed number in the range 1.000–9999.

### Output — Number Formatting
- [ ] Output values use 4 significant figures.
- [ ] SI prefix auto-scaling is used instead of scientific notation for output.
- [ ] Input values are displayed as entered by the user (including scientific notation if typed).

### Reset to Single Unit
- [ ] "Reset to single unit" button appears in Advanced section when per-row mode is active.
- [ ] Clicking it converts all values to the master unit, strips suffixes, and re-enables the master selector.

### Conversion Correctness
- [ ] MeV ↔ MeV/nucl conversion uses integer mass number A.
- [ ] MeV ↔ MeV/u conversion uses atomic mass m_u in daltons.
- [ ] Round-trip conversion (MeV → MeV/nucl → MeV) preserves value to float precision.
- [ ] Stopping power keV/µm = MeV·cm²/g × ρ × 10 where ρ is material density in g/cm³.
- [ ] CSDA range cm = g/cm² ÷ ρ.

---

## Open Questions

1. **Advanced mode toggle for MeV/u:** How does the user enable MeV/u
   for heavy ions? Via the existing "Advanced" section, or always shown
   for A>1? *Deferred — not in v1.*

2. **User-selectable output units:** Should the user be able to override
   the auto-selected stopping power unit (e.g., switch from keV/µm to
   MeV·cm²/g for a solid material)? *Deferred — v1 uses automatic
   defaults only. The column header will eventually become a dropdown.*

3. **Aggregate state override:** When the user overrides a gas material
   to "condensed" state in advanced options, should the default stopping
   power unit also switch to keV/µm? *Likely yes — TBD when
   `advanced-options.md` is written.*
