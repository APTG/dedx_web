# Feature: Unit Handling

> **Status:** Stub v1 (7 April 2026)
>
> This spec covers energy unit selection, SI prefix handling, inline unit
> detection from typed text, and output unit conversion for stopping power
> and CSDA range. It is referenced by [`calculator.md`](calculator.md) and
> will be referenced by `plot.md`.
>
> **Origin:** Energy unit logic was initially inline in `calculator.md` v1–v2.
> Extracted here in calculator.md v3 to give it a dedicated home.

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
- Available input unit options depend on the selected particle (ion or electron).
- Output values auto-scale to human-readable SI prefixes.
- MeV/nucl ≠ MeV/u — the distinction matters for precision CSDA range work.

---

## 2. Energy Unit Selector — Particle-Dependent Options

The energy unit selector (segmented control / radio buttons) shows
different options depending on the **selected particle type**. For ions,
the mass number (A) from `IonEntity.massNumber` determines the options;
for the electron (ID 1001), only MeV is available (per-nucleon units are
meaningless for leptons).

The derivation chain is:

```
EntitySelectionState.particle      // IonEntity — covers ions and electron
  → particle.id + particle.massNumber (A)
  → determine available energy units (see Rules table)
  → update segmented control options
```

### Rules

| Particle type | Available units | Rationale |
|--------------|----------------|-----------|
| **Proton** (A = 1) | **MeV** only | MeV/nucl is numerically identical to MeV when A=1; showing it adds clutter without value. |
| **Electron** (ion ID 1001) | **MeV** only | MeV/nucl and MeV/u are meaningless for leptons (nucleon count is undefined). |
| **Heavy ions** (A > 1) | **MeV**, **MeV/nucl** | Both are commonly used. MeV/nucl = E_total / A. |
| **Heavy ions, advanced mode** | **MeV**, **MeV/nucl**, **MeV/u** | MeV/u = E_total / m_u (atomic mass in daltons). Matters for precision CSDA range. Advanced-mode toggle TBD. |

### Unit Preservation on Particle Change

When the user changes the selected particle and the previously selected unit is no longer
available (e.g., switching from Carbon with "MeV/nucl" selected to
Proton where only "MeV" is available):

1. The unit selector resets to **MeV** (always available).
2. The textarea content is **not modified** — numeric values stay the same.
3. Values are reinterpreted as MeV, triggering recalculation.
4. No explicit notification is needed — the unit selector visually updates,
   which is sufficient feedback.

---

## 3. Inline Unit Detection (Unit-from-Text)

Users may type energy values with a unit suffix in the textarea. The
parser should detect these suffixes and auto-switch the unit selector.

### Supported Suffixes

| Suffix (case-insensitive) | Resolved unit | SI prefix multiplier |
|---------------------------|--------------|---------------------|
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

### Parsing Rules

1. After the debounce timer fires (same 300ms as calculation debounce),
   scan each line for a trailing unit suffix.
2. A suffix is recognized when separated from the number by optional
   whitespace: `100 keV`, `100keV`, `100 MeV/nucl` all match.
3. **All lines with a suffix must agree on the base unit** (MeV vs
   MeV/nucl vs MeV/u). If lines disagree, no auto-switch occurs — show
   a validation warning: "Mixed units detected; please use the unit
   selector."
4. If all suffixed lines agree:
   - Auto-switch the unit selector to the detected base unit (if available
     for the current particle; otherwise warn).
   - **Strip the suffix** from each line and replace with the converted
     numeric value. E.g., `100 keV` → `0.1` (when selector is MeV).
   - Lines without a suffix are left as-is (assumed to already be in the
     selector's unit).
5. The suffix stripping and conversion is a **one-time transform** on
   debounce, not continuous. After the transform, the textarea contains
   plain numbers and the unit selector reflects the detected unit.

### Edge Cases

- A line containing only a unit suffix with no number (e.g., "MeV") is
  treated as invalid input, not a unit detection trigger.
- If the detected base unit is not available for the current particle (e.g.,
  user types "100 MeV/nucl" with Proton selected), show a validation
  message: "MeV/nucl is not available for Proton (A=1). Values
  interpreted as MeV."
- Unit detection does not fire if the textarea is populated from URL
  parameters (URL values are always plain numbers with a separate `eunit`
  parameter).

---

## 4. Conversion Formulas

All conversions use the particle's `massNumber` (A) and `atomicMass` (m_u)
from `IonEntity`. **Note:** These conversions apply only to ions (A ≥ 1);
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

> **TODO:** This section will specify output unit conversion for stopping
> power (MeV·cm²/g ↔ MeV/cm ↔ keV/µm) and CSDA range (g/cm² ↔ cm),
> including auto-scaling to human-readable SI prefixes. Deferred to a
> future draft — `calculator.md` v1 displays native C output units only.

---

## 6. SI Prefix Auto-Scaling (Output)

> **TODO:** This section will specify how numeric output values are
> auto-scaled to the most readable SI prefix (nm, µm, mm, cm, m for
> lengths; eV, keV, MeV, GeV for energies). See project vision §4.1.

---

## Dependencies

- **`IonEntity.massNumber`** and **`IonEntity.atomicMass`** from the
  WASM API contract (`docs/06-wasm-api-contract.md`)
- **`LibdedxService.convertEnergy()`** for unit conversions
- **`EnergyUnit`**, **`StpUnit`**, **`RangeUnit`** types from the API contract
- Energy unit selector widget in calculator and plot pages

---

## Acceptance Criteria

### Energy Unit Selector (particle-dependent)
- [ ] Available units depend on the selected particle type (from `IonEntity.id` and `IonEntity.massNumber`).
- [ ] Proton (A=1): only MeV shown.
- [ ] Electron (ion ID 1001): only MeV shown.
- [ ] Heavy ions (A>1): MeV and MeV/nucl shown.
- [ ] Changing particle resets unit to MeV if the previous unit is no longer available.

### Inline Unit Detection
- [ ] Typing `100 keV` in the textarea auto-switches the selector to MeV and replaces text with `0.1` after debounce.
- [ ] Typing `250 GeV/nucl` auto-switches to MeV/nucl and replaces text with `250000` after debounce.
- [ ] Mixed units across lines produce a validation warning, no auto-switch.
- [ ] Lines without a unit suffix are left unchanged.
- [ ] Unit detection does not fire on URL-populated textarea content.

### Conversion Correctness
- [ ] MeV ↔ MeV/nucl conversion uses integer mass number A.
- [ ] MeV ↔ MeV/u conversion uses atomic mass m_u in daltons.
- [ ] Round-trip conversion (MeV → MeV/nucl → MeV) preserves value to float precision.

---

## Open Questions

1. **Advanced mode toggle for MeV/u:** How does the user enable MeV/u
   for heavy ions? Via the existing "Advanced" section, or always shown
   for A>1? *Deferred — not in v1.*

2. **SI prefix in output columns:** Should the user be able to override
   auto-scaled output units, or only see the auto-selected prefix?
   *Deferred to a future draft of §5–§6.*

3. **keV/MeV/GeV as input prefix vs. as output display:** Input supports
   typed SI prefixes (§3). Should the energy *column* in the result table
   also auto-scale (e.g., display "250 keV" instead of "0.25 MeV")?
   *Deferred.*
